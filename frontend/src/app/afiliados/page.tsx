/* eslint-disable @next/next/no-html-link-for-pages */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import { api, getErrorMessage } from "@/servicios/api";

// ---------------- Types esperados del backend ----------------
type AfiliadoListItem = {
  id: string | number;
  dni: string | number | null;
  apellido: string | null;
  nombre: string | null;
  estado: "activo" | "baja";
  coseguro?: boolean;
  colaterales?: boolean;
  padronesActivos?: { id: string | number; padron: string }[];
  deudaActual?: string;
};

type AfiliadosPagedResp = {
  items: AfiliadoListItem[];
  total: number;
  page: number;
  limit: number;
};

// ---------------- Helpers UI ----------------
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

function mapItem(it: AfiliadoListItem) {
  const padrones = (it.padronesActivos ?? []).map((p) => ({
    id: p.id,
    nro: p.padron,
    vigente: "",
  }));
  return {
    id: it.id,
    apellidoNombre: displayNombre(it.apellido, it.nombre),
    dni: formatDni(it.dni),
    padrones, // ← mantenemos estilo, ahora con id
    coseguro: !!it.coseguro,
    colaterales: !!it.colaterales,
    deudaActual: it.deudaActual ?? "",
    estado: it.estado,
  };
}

// ---------------- Page ----------------
export default function AfiliadosListadoPage() {
  // Filtros y búsqueda
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 350);
  const [estado, setEstado] = useState<"todos" | "activos" | "baja">("todos");
  const [soloCoseguro, setSoloCoseguro] = useState(false);
  const [soloColaterales, setSoloColaterales] = useState(false);

  // Paginación
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  // Datos
  const [rows, setRows] = useState<ReturnType<typeof mapItem>[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Parámetros calculados
  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (debouncedQ.trim()) p.set("q", debouncedQ.trim());
    if (estado !== "todos")
      p.set("estado", estado === "activos" ? "activo" : "baja");
    if (soloCoseguro) p.set("conCoseguro", "true");
    if (soloColaterales) p.set("conColaterales", "true");
    p.set("page", String(page));
    p.set("limit", String(limit));
    return p.toString();
  }, [debouncedQ, estado, soloCoseguro, soloColaterales, page, limit]);

  // Fetch
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setMsg(null);
      try {
        const resp = await api<AfiliadosPagedResp>(
          `/afiliados/paged?${params}`,
          {
            method: "GET",
          }
        );
        if (cancelled) return;
        setTotal(resp.total ?? 0);
        setRows((resp.items ?? []).map(mapItem));
      } catch (e: unknown) {
        if (!cancelled) {
          setRows([]);
          setTotal(0);
          setMsg(getErrorMessage(e));
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
    setEstado("todos");
    setSoloCoseguro(false);
    setSoloColaterales(false);
    setPage(1);
  };

  const hasActiveFilters =
    q.trim() || estado !== "todos" || soloCoseguro || soloColaterales;

  // ===== Modales & acciones (baja / editar) =====
  type RowUi = ReturnType<typeof mapItem>;

  const [bajaOpen, setBajaOpen] = useState<{ open: boolean; row?: RowUi }>({
    open: false,
  });
  const [editOpen, setEditOpen] = useState<{ open: boolean; row?: RowUi }>({
    open: false,
  });

  const [bajaScope, setBajaScope] = useState<"uno" | "todos">("uno");
  const [bajaPadronId, setBajaPadronId] = useState<string | number | undefined>(
    undefined
  );
  const [bajaFecha, setBajaFecha] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [bajaMotivo, setBajaMotivo] = useState<string>("renuncia");

  const [editPadronId, setEditPadronId] = useState<string | number | undefined>(
    undefined
  );
  const [editData, setEditData] = useState<{
    situacion: string;
    sistema: string;
    centro: string;
    sector: string;
    clase: string;
  }>({
    situacion: "",
    sistema: "",
    centro: "",
    sector: "",
    clase: "",
  });

  const [busy, setBusy] = useState(false);

  const abrirBaja = (row: RowUi) => {
    setBajaScope("uno");
    setBajaPadronId(row.padrones[0]?.id);
    setBajaFecha(new Date().toISOString().slice(0, 10));
    setBajaMotivo("renuncia");
    setBajaOpen({ open: true, row });
  };

  const abrirEditar = (row: RowUi) => {
    setEditPadronId(row.padrones[0]?.id);
    setEditData({
      situacion: "",
      sistema: "",
      centro: "",
      sector: "",
      clase: "",
    });
    setEditOpen({ open: true, row });
  };

  const recargarListado = async () => {
    const resp = await api<AfiliadosPagedResp>(`/afiliados/paged?${params}`, {
      method: "GET",
    });
    setTotal(resp.total ?? 0);
    setRows((resp.items ?? []).map(mapItem));
  };

  const confirmarBaja = async () => {
    if (!bajaOpen.row) return;
    const ids =
      bajaScope === "todos"
        ? bajaOpen.row.padrones.map((p) => p.id)
        : bajaPadronId != null
        ? [bajaPadronId]
        : [];

    if (!ids.length) {
      setMsg("No hay padrones activos para dar de baja.");
      setBajaOpen({ open: false });
      return;
    }

    try {
      setBusy(true);
      // 1) Soft delete → dispara novedad J17=0 en backend
      // 2) Patch motivo/fecha para registrar causa y fecha exacta
      for (const id of ids) {
        await api(`/padrones/${id}`, { method: "DELETE" }); // soft + novedad J17 baja
        await api(`/padrones/${id}`, {
          method: "PATCH",
          body: JSON.stringify({
            fechaBaja: bajaFecha,
            motivoBaja: bajaMotivo,
          }),
        });
      }
      setMsg("SUCCESS:Baja realizada correctamente");
      setBajaOpen({ open: false });
      await recargarListado();
    } catch (e) {
      setMsg(`ERROR:${getErrorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const confirmarEditar = async () => {
    if (!editPadronId) {
      setMsg("Seleccioná un padrón a modificar.");
      return;
    }
    const body: any = {};
    if (editData.situacion.trim()) body.situacion = editData.situacion.trim();
    if (editData.clase.trim()) body.clase = editData.clase.trim();
    if (editData.centro.trim())
      body.centro = Number(editData.centro) || undefined;
    if (editData.sector.trim())
      body.sector = Number(editData.sector) || undefined;
    if (editData.sistema.trim()) body.sistema = editData.sistema as any; // 'ESC' | 'SG' | 'SGR'

    try {
      setBusy(true);
      await api(`/padrones/${editPadronId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setMsg("SUCCESS:Padrón actualizado");
      setEditOpen({ open: false });
      await recargarListado();
    } catch (e) {
      setMsg(`ERROR:${getErrorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-container">
      {/* Header de página */}
      <div className="page-header">
        <div className="page-title-section">
          <h1 className="page-title">Listado de Afiliados</h1>
          <p className="page-subtitle">
            Gestión y consulta de afiliados del sistema
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

      {/* Mensaje de error */}
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

      <div className="page-content">
        {/* Filtros y controles */}
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
              <label className="filter-label">Estado</label>
              <select
                className="filter-select"
                aria-label="Filtro de estado"
                value={estado}
                onChange={(e) => {
                  setEstado(e.target.value as any);
                  setPage(1);
                }}
              >
                <option value="todos">Todos los estados</option>
                <option value="activos">Solo activos</option>
                <option value="baja">Solo dados de baja</option>
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

            {(hasActiveFilters as any) && (
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

        {/* Tabla de resultados */}
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
              <div className="loading-text">Cargando afiliados...</div>
            </div>
          ) : rows.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                {hasActiveFilters ? "🔍" : "👥"}
              </div>
              <div className="empty-state-title">
                {hasActiveFilters
                  ? "Sin resultados"
                  : "No hay afiliados registrados"}
              </div>
              <div className="empty-state-text">
                {hasActiveFilters
                  ? "No se encontraron afiliados que coincidan con los filtros aplicados"
                  : "Comienza agregando el primer afiliado al sistema"}
              </div>
              {hasActiveFilters ? (
                <button
                  onClick={handleClearFilters}
                  className="btn btn-secondary"
                >
                  Limpiar filtros
                </button>
              ) : (
                // eslint-disable-next-line @next/next/no-html-link-for-pages
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
                  Agregar primer afiliado
                </a>
              )}
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Afiliado</th>
                    <th>DNI</th>
                    <th>Estado</th>
                    <th>Padrones Activos</th>
                    <th className="table-col-center">Coseguro</th>
                    <th className="table-col-center">Colaterales</th>
                    <th className="table-col-numeric">Deuda Actual</th>
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
                            r.estado === "activo"
                              ? "status-active"
                              : "status-inactive"
                          }`}
                        >
                          {r.estado === "activo" ? (
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="20,6 9,17 4,12" />
                            </svg>
                          ) : (
                            <svg
                              width="12"
                              height="12"
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
                          )}
                          {r.estado === "activo" ? "Activo" : "Baja"}
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
                          {r.coseguro ? (
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="20,6 9,17 4,12" />
                            </svg>
                          ) : (
                            <svg
                              width="12"
                              height="12"
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
                          )}
                          {r.coseguro ? "Sí" : "No"}
                        </span>
                      </td>
                      <td className="table-col-center">
                        <span
                          className={`feature-badge ${
                            r.colaterales ? "feature-yes" : "feature-no"
                          }`}
                        >
                          {r.colaterales ? (
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="20,6 9,17 4,12" />
                            </svg>
                          ) : (
                            <svg
                              width="12"
                              height="12"
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
                          )}
                          {r.colaterales ? "Sí" : "No"}
                        </span>
                      </td>
                      <td className="table-col-numeric">
                        <span className="deuda-amount">
                          {r.deudaActual || "—"}
                        </span>
                      </td>
                      <td className="table-col-center">
                        <div
                          className="btn-group"
                          style={{ display: "inline-flex", gap: 8 }}
                        >
                          <a
                            href={`/afiliados/${r.id}`}
                            className="btn btn-secondary btn-sm"
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
                            Ver detalle
                          </a>

                          <button
                            className="btn btn-secondary btn-sm"
                            title="Dar de baja afiliado o uno de sus padrones"
                            onClick={() => abrirBaja(r)}
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
                              <polyline points="20,6 9,17 4,12" />
                            </svg>
                            Baja
                          </button>

                          <button
                            className="btn btn-secondary btn-sm"
                            title="Modificar datos de un padrón del afiliado"
                            onClick={() => abrirEditar(r)}
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
                              <path d="M12 20h9" />
                              <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                            </svg>
                            Modificar
                          </button>
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

      {/* ===== Modal Baja ===== */}
      {bajaOpen.open && bajaOpen.row && (
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
          onClick={() => !busy && setBajaOpen({ open: false })}
        >
          <div
            className="modal"
            style={{
              background: "#fff",
              borderRadius: 12,
              minWidth: 420,
              maxWidth: 560,
              padding: 16,
              boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: 0, marginBottom: 8 }}>Dar de baja</h3>
            <p style={{ marginTop: 0, color: "#555" }}>
              {bajaOpen.row.apellidoNombre} — DNI {bajaOpen.row.dni || "—"}
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
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    <li>
                      La baja de padrón genera novedad J17 = 0 (para el período
                      correspondiente).
                    </li>
                    {bajaOpen.row.coseguro && (
                      <li>
                        El afiliado tiene <b>coseguro</b>. Si el padrón elegido
                        es el de imputación, recordá tramitar la baja de
                        coseguro/colaterales.
                      </li>
                    )}
                    {bajaOpen.row.colaterales && (
                      <li>
                        El afiliado tiene <b>colaterales</b> asociados al
                        coseguro.
                      </li>
                    )}
                    {bajaScope === "todos" && (
                      <li>
                        Al dar de baja <b>todos los padrones</b> el afiliado
                        quedará en estado <b>“baja”</b>.
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <div>
                <label
                  className="filter-label"
                  style={{ display: "block", fontSize: 12, color: "#666" }}
                >
                  Alcance
                </label>
                <div style={{ display: "flex", gap: 12 }}>
                  <label
                    className="checkbox-label"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <input
                      type="radio"
                      name="alcance-baja"
                      checked={bajaScope === "uno"}
                      onChange={() => setBajaScope("uno")}
                    />
                    <span>Solo un padrón</span>
                  </label>
                  <label
                    className="checkbox-label"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <input
                      type="radio"
                      name="alcance-baja"
                      checked={bajaScope === "todos"}
                      onChange={() => setBajaScope("todos")}
                    />
                    <span>
                      Todos los padrones activos ({bajaOpen.row.padrones.length}
                      )
                    </span>
                  </label>
                </div>
              </div>

              {bajaScope === "uno" && (
                <div>
                  <label
                    className="filter-label"
                    style={{ display: "block", fontSize: 12, color: "#666" }}
                  >
                    Padrón
                  </label>
                  <select
                    className="filter-select"
                    value={String(bajaPadronId ?? "")}
                    onChange={(e) => setBajaPadronId(e.target.value)}
                  >
                    {bajaOpen.row.padrones.map((p) => (
                      <option key={String(p.id)} value={String(p.id)}>
                        {p.nro}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {bajaScope === "todos" && (
                <div
                  className="padrones-container"
                  style={{ display: "flex", gap: 6, flexWrap: "wrap" }}
                >
                  {bajaOpen.row.padrones.map((p) => (
                    <span
                      key={String(p.id)}
                      className="padron-chip"
                      title="Se dará de baja"
                    >
                      {p.nro}
                    </span>
                  ))}
                </div>
              )}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                <div>
                  <label
                    className="filter-label"
                    style={{ display: "block", fontSize: 12, color: "#666" }}
                  >
                    Fecha de baja
                  </label>
                  <input
                    type="date"
                    value={bajaFecha}
                    onChange={(e) => setBajaFecha(e.target.value)}
                    className="filter-select"
                  />
                </div>
                <div>
                  <label
                    className="filter-label"
                    style={{ display: "block", fontSize: 12, color: "#666" }}
                  >
                    Motivo
                  </label>
                  <select
                    value={bajaMotivo}
                    onChange={(e) => setBajaMotivo(e.target.value)}
                    className="filter-select"
                  >
                    <option value="renuncia">Renuncia</option>
                    <option value="jubilacion">Jubilación</option>
                    <option value="fallecimiento">Fallecimiento</option>
                    <option value="cambio_padron">Cambio de padrón</option>
                    <option value="otros">Otros</option>
                  </select>
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 16,
              }}
            >
              <div style={{ fontSize: 12, color: "#777" }}>
                Se registrará J17=0 y se guardará motivo/fecha en cada padrón
                afectado.
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setBajaOpen({ open: false })}
                  disabled={busy}
                >
                  Cancelar
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => void confirmarBaja()}
                  disabled={busy}
                >
                  {busy ? "Procesando..." : "Confirmar baja"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== Modal Editar Padrón ===== */}
      {editOpen.open && editOpen.row && (
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
          onClick={() => !busy && setEditOpen({ open: false })}
        >
          <div
            className="modal"
            style={{
              background: "#fff",
              borderRadius: 12,
              minWidth: 420,
              maxWidth: 600,
              padding: 16,
              boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: 0, marginBottom: 8 }}>Modificar padrón</h3>
            <p style={{ marginTop: 0, color: "#555" }}>
              {editOpen.row.apellidoNombre} — DNI {editOpen.row.dni || "—"}
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
                  Modificar <b>sistema/centro/sector/clase</b> puede impactar en
                  la generación de novedades (canales J22/J38 por imputación).
                  Revisá el período en curso.
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <div>
                <label
                  className="filter-label"
                  style={{ display: "block", fontSize: 12, color: "#666" }}
                >
                  Padrón
                </label>
                <select
                  className="filter-select"
                  value={String(editPadronId ?? "")}
                  onChange={(e) => setEditPadronId(e.target.value)}
                >
                  {editOpen.row.padrones.map((p) => (
                    <option key={String(p.id)} value={String(p.id)}>
                      {p.nro}
                    </option>
                  ))}
                </select>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                <div>
                  <label
                    className="filter-label"
                    style={{ display: "block", fontSize: 12, color: "#666" }}
                  >
                    Situación
                  </label>
                  <input
                    className="filter-select"
                    placeholder="TITULAR / SUPLENTE / ..."
                    value={editData.situacion}
                    onChange={(e) =>
                      setEditData((d) => ({ ...d, situacion: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label
                    className="filter-label"
                    style={{ display: "block", fontSize: 12, color: "#666" }}
                  >
                    Sistema
                  </label>
                  <select
                    className="filter-select"
                    value={editData.sistema}
                    onChange={(e) =>
                      setEditData((d) => ({ ...d, sistema: e.target.value }))
                    }
                  >
                    <option value="">—</option>
                    <option value="ESC">ESC</option>
                    <option value="SG">SG</option>
                    <option value="SGR">SGR</option>
                  </select>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 12,
                }}
              >
                <div>
                  <label
                    className="filter-label"
                    style={{ display: "block", fontSize: 12, color: "#666" }}
                  >
                    Centro
                  </label>
                  <input
                    className="filter-select"
                    inputMode="numeric"
                    placeholder="número"
                    value={editData.centro}
                    onChange={(e) =>
                      setEditData((d) => ({ ...d, centro: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label
                    className="filter-label"
                    style={{ display: "block", fontSize: 12, color: "#666" }}
                  >
                    Sector
                  </label>
                  <input
                    className="filter-select"
                    inputMode="numeric"
                    placeholder="número"
                    value={editData.sector}
                    onChange={(e) =>
                      setEditData((d) => ({ ...d, sector: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label
                    className="filter-label"
                    style={{ display: "block", fontSize: 12, color: "#666" }}
                  >
                    Clase
                  </label>
                  <input
                    className="filter-select"
                    placeholder="texto"
                    value={editData.clase}
                    onChange={(e) =>
                      setEditData((d) => ({ ...d, clase: e.target.value }))
                    }
                  />
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 16,
              }}
            >
              <div style={{ fontSize: 12, color: "#777" }}>
                Guardá los cambios para impactar en el padrón seleccionado.
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setEditOpen({ open: false })}
                  disabled={busy}
                >
                  Cancelar
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => void confirmarEditar()}
                  disabled={busy}
                >
                  {busy ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
