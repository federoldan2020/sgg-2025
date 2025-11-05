/* eslint-disable @next/next/no-html-link-for-pages */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import { api, getErrorMessage } from "@/servicios/api";

/** ======================= Tipos del backend (listado) ======================= */
type AfiliadoListItem = {
  id: string | number;
  dni: string | number | null;
  apellido: string | null;
  nombre: string | null;
  estado: "activo" | "baja";
  coseguro?: boolean;
  colaterales?: boolean;
  padronesActivos?: { id: string | number; padron: string }[];
};

type AfiliadosPagedResp = {
  items: AfiliadoListItem[];
  total: number;
  page: number;
  limit: number;
};

/** ======================= Tipos (modal configurar) ======================= */
type EstadoCoseguro = "activo" | "baja" | "ninguno";

type AfiliadoLite = {
  id: string | number;
  dni?: string | number | null;
  apellido?: string | null;
  nombre?: string | null;
};

type PadronLite = { id: string | number; padron: string; activo?: boolean };

type CoseguroCfg = {
  estado: EstadoCoseguro;
  fechaAlta?: string | null;
  fechaBaja?: string | null;
  padronCoseguroId?: string | number | null; // J22
  padronColatId?: string | number | null; // J38
};

type CoseguroInitResp = {
  afiliado: AfiliadoLite;
  padrones: PadronLite[];
  coseguro: CoseguroCfg | null;
};

/** ======================= Helpers UI ======================= */
function useDebouncedValue<T>(value: T, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function formatDni(dni: string | number | null | undefined) {
  if (dni == null) return "";
  const s = String(dni).replace(/\D+/g, "");
  if (!s) return "";
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function displayNombre(apellido: string | null, nombre: string | null) {
  const a = (apellido ?? "").trim();
  const n = (nombre ?? "").trim();
  if (a && n) return `${a}, ${n}`;
  if (a || n) return (a || n)!;
  return "(sin nombre)";
}

function mapRow(it: AfiliadoListItem) {
  return {
    id: it.id,
    apellidoNombre: displayNombre(it.apellido, it.nombre),
    dni: formatDni(it.dni),
    estadoAfiliado: it.estado, // activo | baja
    coseguro: !!it.coseguro,
    colaterales: !!it.colaterales,
    padrones: (it.padronesActivos ?? []).map((p) => ({
      id: p.id,
      nro: p.padron,
      vigente: "",
    })),
  };
}

/** ======================= Page ======================= */
export default function CosegurosListadoPage() {
  /** ===== Filtros/paginación ===== */
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 350);
  const [estadoAf, setEstadoAf] = useState<"todos" | "activos" | "baja">(
    "todos"
  );
  const [soloCoseguro, setSoloCoseguro] = useState(true);
  const [soloColaterales, setSoloColaterales] = useState(false);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  /** ===== Datos ===== */
  type RowUi = ReturnType<typeof mapRow>;
  const [rows, setRows] = useState<RowUi[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  /** ===== Modal Configurar ===== */
  const [cfgOpen, setCfgOpen] = useState<{ open: boolean; row?: RowUi }>({
    open: false,
  });
  const [cfgBusy, setCfgBusy] = useState(false);
  const [cfgAfiliado, setCfgAfiliado] = useState<AfiliadoLite | null>(null);
  const [cfgPadrones, setCfgPadrones] = useState<PadronLite[]>([]);
  const [cfgData, setCfgData] = useState<CoseguroCfg>({
    estado: "ninguno",
    padronCoseguroId: null,
    padronColatId: null,
  });
  const [cfgHasColaterales, setCfgHasColaterales] = useState<boolean>(false);

  /** ===== Parámetros de fetch ===== */
  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (debouncedQ.trim()) p.set("q", debouncedQ.trim());
    if (estadoAf !== "todos")
      p.set("estado", estadoAf === "activos" ? "activo" : "baja");
    if (soloCoseguro) p.set("conCoseguro", "true");
    if (soloColaterales) p.set("conColaterales", "true");
    p.set("page", String(page));
    p.set("limit", String(limit));
    return p.toString();
  }, [debouncedQ, estadoAf, soloCoseguro, soloColaterales, page, limit]);

  /** ===== Fetch listado ===== */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setMsg(null);
      try {
        const resp = await api<AfiliadosPagedResp>(
          `/afiliados/paged?${params}`,
          { method: "GET" }
        );
        if (cancelled) return;
        setTotal(resp.total ?? 0);
        setRows((resp.items ?? []).map(mapRow));
      } catch (e: unknown) {
        if (!cancelled) {
          setRows([]);
          setTotal(0);
          setMsg(`ERROR:${getErrorMessage(e)}`);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const canPrev = page > 1 && !loading;
  const canNext = page < totalPages && !loading;

  const onChangeLimit = (val: number) => {
    setLimit(val);
    setPage(1);
  };

  const handleClearFilters = () => {
    setQ("");
    setEstadoAf("todos");
    setSoloCoseguro(false);
    setSoloColaterales(false);
    setPage(1);
  };

  const hasActiveFilters =
    q.trim() || estadoAf !== "todos" || soloCoseguro || soloColaterales;

  /** ===== Abrir modal configurar (trae detalle + colaterales activos) ===== */
  const abrirConfigurar = async (row: RowUi) => {
    setCfgOpen({ open: true, row });
    setCfgBusy(true);
    setMsg(null);
    try {
      const info = await api<CoseguroInitResp>(`/coseguro/${row.id}`, {
        method: "GET",
      });

      setCfgAfiliado(info.afiliado ?? { id: row.id });
      setCfgPadrones(info.padrones ?? []);

      const padronCoseguroId =
        info.coseguro?.padronCoseguroId ??
        (info.coseguro as any)?.padronCoseguro?.id ??
        null;

      const padronColatId =
        info.coseguro?.padronColatId ??
        (info.coseguro as any)?.padronColat?.id ??
        null;

      const baseCfg: CoseguroCfg = {
        estado: info.coseguro?.estado ?? "ninguno",
        padronCoseguroId,
        padronColatId,
      };
      setCfgData(baseCfg);

      // colaterales activos del afiliado (para habilitar J38)
      try {
        const cols = await api<any[]>(
          `/colaterales/afiliados/${row.id}/colaterales?soloActivos=true`,
          { method: "GET" }
        );
        setCfgHasColaterales(Array.isArray(cols) && cols.length > 0);
      } catch {
        setCfgHasColaterales(false);
      }
    } catch (e) {
      setMsg(`ERROR:${getErrorMessage(e)}`);
      setCfgOpen({ open: false });
    } finally {
      setCfgBusy(false);
    }
  };

  /** ===== Guardar configuración =====
   * - J22 (coseguro): /coseguro/upsert
   * - J38 (colaterales): /colaterales/afiliados/:id/imputacion (sólo si hay colaterales)
   */
  const guardarCfg = async () => {
    if (!cfgOpen.row || !cfgAfiliado) return;
    setMsg(null);

    const afiliadoIdNum = Number(cfgAfiliado.id);
    const estadoActivo = cfgData.estado === "activo";

    try {
      setCfgBusy(true);

      // --- Validaciones UI previas ---
      if (estadoActivo && !cfgData.padronCoseguroId) {
        throw new Error("Seleccioná padrón de imputación para J22.");
      }
      if (estadoActivo && cfgData.padronColatId && !cfgHasColaterales) {
        // No aborta todo: avisamos y no imputamos J38
        setMsg(
          "ERROR:No podés imputar J38 porque el afiliado no tiene colaterales activos."
        );
      }

      // --- 1) J22: upsert coseguro ---
      try {
        await api(`/coseguro/upsert`, {
          method: "POST",
          body: JSON.stringify({
            afiliadoId: afiliadoIdNum,
            estado: cfgData.estado,
            padronCoseguroId: estadoActivo
              ? cfgData.padronCoseguroId
                ? Number(cfgData.padronCoseguroId)
                : null
              : null, // en baja, limpiamos imputación
          }),
        });
      } catch (e: any) {
        // ¿conflicto por reasignación?
        const msg = getErrorMessage(e);
        if (
          (e?.status === 409 || /REQUIERE_REASIGNACION_J22/.test(msg)) &&
          typeof window !== "undefined"
        ) {
          const confirmar = window.confirm(
            "El afiliado ya tiene J22 activo en otro padrón.\n¿Querés reasignarlo a este padrón? Se generarán las novedades correspondientes."
          );
          if (!confirmar) throw e;

          await api(`/coseguro/upsert`, {
            method: "POST",
            body: JSON.stringify({
              afiliadoId: afiliadoIdNum,
              estado: cfgData.estado,
              padronCoseguroId: estadoActivo
                ? cfgData.padronCoseguroId
                  ? Number(cfgData.padronCoseguroId)
                  : null
                : null,
              reasignar: true,
            }),
          });
        } else {
          throw e;
        }
      }

      // --- 2) J38: imputación sólo si corresponde ---
      if (estadoActivo && cfgData.padronColatId && cfgHasColaterales) {
        try {
          await api(`/colaterales/afiliados/${afiliadoIdNum}/imputacion`, {
            method: "POST",
            body: JSON.stringify({
              padronId: Number(cfgData.padronColatId),
            }),
          });
        } catch (e) {
          // No abortamos todo: dejamos mensaje informativo
          setMsg(
            `ERROR:No se pudo guardar la imputación J38. ${getErrorMessage(e)}`
          );
        }
      }

      // Mensaje y refresco del listado
      setMsg("SUCCESS:Configuración guardada");
      setCfgOpen({ open: false });

      // Refrescar fila: recargamos listado con los mismos filtros
      const resp = await api<AfiliadosPagedResp>(`/afiliados/paged?${params}`, {
        method: "GET",
      });
      setTotal(resp.total ?? 0);
      setRows((resp.items ?? []).map(mapRow));
    } catch (e) {
      setMsg(`ERROR:${getErrorMessage(e)}`);
    } finally {
      setCfgBusy(false);
    }
  };

  /** ======================= Render ======================= */
  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div className="page-title-section">
          <h1 className="page-title">Coseguros</h1>
          <p className="page-subtitle">
            ABM de coseguro y colaterales por afiliado
          </p>
        </div>
        <div className="page-actions">
          <a href="/padrones/nuevo" className="btn btn-primary">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="19" y1="8" x2="19" y2="14" />
              <line x1="22" y1="11" x2="16" y2="11" />
            </svg>
            Nuevo Afiliado
          </a>
        </div>
      </div>

      {/* Mensajes globales */}
      {msg && (
        <div
          className={`alert ${
            msg.startsWith("SUCCESS:")
              ? "alert-success"
              : msg.startsWith("ERROR:")
              ? "alert-error"
              : "alert-warning"
          }`}
        >
          <div className="alert-content">
            <div className="alert-icon">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                {msg.startsWith("SUCCESS:") ? (
                  <polyline points="16 12 11 17 8 14" />
                ) : msg.startsWith("ERROR:") ? (
                  <>
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </>
                ) : (
                  <line x1="12" y1="8" x2="12" y2="12" />
                )}
              </svg>
            </div>
            <div className="alert-text">
              {msg.replace(/^(SUCCESS:|ERROR:)/, "")}
            </div>
          </div>
        </div>
      )}

      {/* Controles / filtros */}
      <div className="page-content">
        <div className="afiliados-controls">
          <div className="search-section">
            <div className="search-input-container">
              <svg
                className="search-icon"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                className="search-input"
                placeholder="Buscar por DNI o apellido..."
                aria-label="Buscar afiliados"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
              />
              {q && (
                <button
                  onClick={() => {
                    setQ("");
                    setPage(1);
                  }}
                  className="search-clear"
                  title="Limpiar búsqueda"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          <div className="filters-section">
            <div className="filter-group">
              <label className="filter-label">Estado del afiliado</label>
              <select
                className="filter-select"
                aria-label="Filtro de estado afiliado"
                value={estadoAf}
                onChange={(e) => {
                  setEstadoAf(e.target.value as any);
                  setPage(1);
                }}
              >
                <option value="todos">Todos</option>
                <option value="activos">Solo activos</option>
                <option value="baja">Solo baja</option>
              </select>
            </div>

            <div className="checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  className="checkbox-input"
                  checked={soloCoseguro}
                  onChange={(e) => {
                    setSoloCoseguro(e.target.checked);
                    setPage(1);
                  }}
                />
                <span className="checkbox-text">Con coseguro</span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  className="checkbox-input"
                  checked={soloColaterales}
                  onChange={(e) => {
                    setSoloColaterales(e.target.checked);
                    setPage(1);
                  }}
                />
                <span className="checkbox-text">Con colaterales</span>
              </label>
            </div>

            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="btn btn-secondary"
                title="Limpiar todos los filtros"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 6h18" />
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
                Limpiar filtros
              </button>
            )}
          </div>

          <div className="pagination-controls">
            <div className="results-info">
              {loading ? (
                <div className="loading-indicator">
                  <svg
                    className="spinner"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  Cargando...
                </div>
              ) : (
                <span className="results-text">
                  {total === 0
                    ? "0 resultados"
                    : `${(page - 1) * limit + 1}-${Math.min(
                        page * limit,
                        total
                      )} de ${total}`}
                </span>
              )}
            </div>
            <select
              className="pagination-select"
              aria-label="Filas por página"
              value={String(limit)}
              onChange={(e) => onChangeLimit(Number(e.target.value))}
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n} por página
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tabla */}
        <div className="afiliados-table-container">
          {loading ? (
            <div className="loading-state">
              <div className="loading-icon">
                <svg
                  className="spinner"
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              </div>
              <div className="loading-text">Cargando coseguros...</div>
            </div>
          ) : rows.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                {hasActiveFilters ? "🔍" : "🩺"}
              </div>
              <div className="empty-state-title">
                {hasActiveFilters
                  ? "Sin resultados"
                  : "No hay datos de coseguro"}
              </div>
              <div className="empty-state-text">
                {hasActiveFilters
                  ? "No se encontraron afiliados que coincidan con los filtros aplicados"
                  : "Activá coseguro desde el detalle del afiliado o desde este listado"}
              </div>
              {hasActiveFilters && (
                <button
                  onClick={handleClearFilters}
                  className="btn btn-secondary"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Afiliado</th>
                    <th>DNI</th>
                    <th>Estado Af.</th>
                    <th>Padrones Activos</th>
                    <th className="table-col-center">Coseguro</th>
                    <th className="table-col-center">Colaterales</th>
                    <th className="table-col-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={String(r.id)}>
                      <td>
                        <div className="afiliado-info">
                          <div className="afiliado-avatar">
                            <svg
                              width="20"
                              height="20"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                              <circle cx="12" cy="7" r="4" />
                            </svg>
                          </div>
                          <div className="afiliado-name">
                            {r.apellidoNombre}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="dni-badge">{r.dni || "—"}</span>
                      </td>
                      <td>
                        <span
                          className={`status-badge ${
                            r.estadoAfiliado === "activo"
                              ? "status-active"
                              : "status-inactive"
                          }`}
                        >
                          {r.estadoAfiliado === "activo" ? "Activo" : "Baja"}
                        </span>
                      </td>
                      <td>
                        <div className="padrones-container">
                          {r.padrones.length > 0 ? (
                            r.padrones.map((p) => (
                              <span
                                key={String(p.id)}
                                className="padron-chip"
                                title={p.vigente || ""}
                              >
                                {p.nro}
                              </span>
                            ))
                          ) : (
                            <span className="no-data">Sin padrones</span>
                          )}
                        </div>
                      </td>
                      <td className="table-col-center">
                        <span
                          className={`feature-badge ${
                            r.coseguro ? "feature-yes" : "feature-no"
                          }`}
                        >
                          {r.coseguro ? "Sí" : "No"}
                        </span>
                      </td>
                      <td className="table-col-center">
                        <span
                          className={`feature-badge ${
                            r.colaterales ? "feature-yes" : "feature-no"
                          }`}
                        >
                          {r.colaterales ? "Sí" : "No"}
                        </span>
                      </td>
                      <td className="table-col-center">
                        <div
                          className="btn-group"
                          style={{ display: "inline-flex", gap: 8 }}
                        >
                          <button
                            className="btn btn-secondary btn-sm"
                            title="Configurar coseguro (activar / padrones J22/J38)"
                            onClick={() => void abrirConfigurar(r)}
                            disabled={r.padrones.length === 0}
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M12 1v4" />
                              <path d="M12 19v4" />
                              <path d="m4.22 4.22 2.83 2.83" />
                              <path d="m16.95 16.95 2.83 2.83" />
                              <path d="M1 12h4" />
                              <path d="M19 12h4" />
                              <path d="m4.22 19.78 2.83-2.83" />
                              <path d="m16.95 7.05 2.83-2.83" />
                            </svg>
                            Configurar
                          </button>
                          <a
                            href={`/coseguro/${r.id}`}
                            className="btn btn-secondary btn-sm"
                            title="Gestionar coseguro y colaterales"
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                            Gestionar
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Paginación */}
        {!loading && rows.length > 0 && (
          <div className="pagination-container">
            <div className="pagination-info">
              <span className="pagination-text">
                Página {page} de {totalPages} ({total} resultados)
              </span>
            </div>
            <div className="pagination-controls">
              <button
                className="pagination-btn"
                onClick={() => setPage(1)}
                disabled={!canPrev}
                title="Primera página"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="11,17 6,12 11,7" />
                  <polyline points="18,17 13,12 18,7" />
                </svg>
              </button>
              <button
                className="pagination-btn"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={!canPrev}
                title="Página anterior"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="15,18 9,12 15,6" />
                </svg>
              </button>
              <span className="pagination-current">{page}</span>
              <button
                className="pagination-btn"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={!canNext}
                title="Página siguiente"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="9,18 15,12 9,6" />
                </svg>
              </button>
              <button
                className="pagination-btn"
                onClick={() => setPage(totalPages)}
                disabled={!canNext}
                title="Última página"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="13,17 18,12 13,7" />
                  <polyline points="6,17 11,12 6,7" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ======================= Modal Configurar Coseguro ======================= */}
      {cfgOpen.open && cfgOpen.row && (
        <div
          role="dialog"
          aria-modal="true"
          className="modal-backdrop"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "grid",
            placeItems: "center",
            zIndex: 1000,
          }}
          onClick={() => !cfgBusy && setCfgOpen({ open: false })}
        >
          <div
            className="modal"
            style={{
              background: "#fff",
              borderRadius: 12,
              minWidth: 460,
              maxWidth: 640,
              padding: 16,
              boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: 0, marginBottom: 8 }}>Configurar coseguro</h3>
            <p style={{ marginTop: 0, color: "#555" }}>
              {cfgOpen.row.apellidoNombre} — DNI {cfgOpen.row.dni || "—"}
            </p>

            {/* Warning moderno */}
            <div className="alert alert-warning" style={{ marginBottom: 12 }}>
              <div className="alert-content">
                <div className="alert-icon">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <circle cx="12" cy="16" r="1" />
                  </svg>
                </div>
                <div className="alert-text">
                  Activar o desactivar coseguro puede generar novedades{" "}
                  <b>J22</b> y/o <b>J38</b> según día de corte.
                </div>
              </div>
            </div>

            {/* Estado + toggles */}
            <div style={{ display: "grid", gap: 12 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="filter-label" style={{ color: "#666" }}>
                    Estado
                  </span>
                  <span
                    className={`status-badge ${
                      cfgData.estado === "activo"
                        ? "status-active"
                        : cfgData.estado === "baja"
                        ? "status-inactive"
                        : ""
                    }`}
                  >
                    {cfgData.estado.toUpperCase()}
                  </span>
                </div>

                <label
                  className="checkbox-label"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={cfgData.estado === "activo"}
                    onChange={(e) =>
                      setCfgData((d) => ({
                        ...d,
                        estado: e.target.checked ? "activo" : "baja",
                      }))
                    }
                    disabled={cfgBusy}
                  />
                  <span>Activo</span>
                </label>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
                  gap: 12,
                }}
              >
                {/* J22 */}
                <div>
                  <label
                    className="filter-label"
                    style={{ display: "block", fontSize: 12, color: "#666" }}
                  >
                    Imputación J22 (coseguro)
                  </label>
                  <select
                    className="filter-select"
                    value={String(cfgData.padronCoseguroId ?? "")}
                    onChange={(e) =>
                      setCfgData((d) => ({
                        ...d,
                        padronCoseguroId: e.target.value
                          ? Number(e.target.value)
                          : null,
                      }))
                    }
                    disabled={cfgBusy || cfgData.estado !== "activo"}
                    title={
                      cfgData.estado !== "activo"
                        ? "Activá el coseguro para imputar J22"
                        : undefined
                    }
                  >
                    <option value="">— Seleccionar padrón —</option>
                    {(cfgPadrones.length
                      ? cfgPadrones
                      : cfgOpen.row.padrones
                    ).map((p: any) => (
                      <option key={String(p.id)} value={String(p.id)}>
                        {p.padron ?? p.nro}
                      </option>
                    ))}
                  </select>
                </div>

                {/* J38 */}
                <div>
                  <label
                    className="filter-label"
                    style={{ display: "block", fontSize: 12, color: "#666" }}
                  >
                    Imputación J38 (colaterales)
                  </label>
                  <select
                    className="filter-select"
                    value={String(cfgData.padronColatId ?? "")}
                    onChange={(e) =>
                      setCfgData((d) => ({
                        ...d,
                        padronColatId: e.target.value
                          ? Number(e.target.value)
                          : null,
                      }))
                    }
                    disabled={
                      cfgBusy ||
                      cfgData.estado !== "activo" ||
                      !cfgHasColaterales
                    }
                    title={
                      cfgData.estado !== "activo"
                        ? "Activá el coseguro para imputar J38"
                        : !cfgHasColaterales
                        ? "No hay colaterales activos para imputar J38"
                        : undefined
                    }
                  >
                    <option value="">— Seleccionar padrón —</option>
                    {(cfgPadrones.length
                      ? cfgPadrones
                      : cfgOpen.row.padrones
                    ).map((p: any) => (
                      <option key={String(p.id)} value={String(p.id)}>
                        {p.padron ?? p.nro}
                      </option>
                    ))}
                  </select>
                  {cfgData.estado === "activo" && !cfgHasColaterales && (
                    <div style={{ fontSize: 12, color: "#a00", marginTop: 6 }}>
                      Para imputar J38, primero agregá colaterales activos.
                    </div>
                  )}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: 6,
                }}
              >
                <a
                  href={`/coseguro/${cfgOpen.row.id}`}
                  className="btn btn-secondary"
                  title="Abrir gestión completa de coseguro y colaterales"
                >
                  Abrir gestión completa
                </a>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setCfgOpen({ open: false })}
                    disabled={cfgBusy}
                  >
                    Cancelar
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => void guardarCfg()}
                    disabled={cfgBusy}
                  >
                    {cfgBusy ? "Guardando..." : "Guardar"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
