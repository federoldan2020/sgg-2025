/* eslint-disable @next/next/no-html-link-for-pages */
"use client";

import { useEffect, useMemo, useState } from "react";
import { api, ORG, getErrorMessage } from "@/servicios/api";

type RolTercero = "PROVEEDOR" | "PRESTADOR" | "AFILIADO" | "OTRO";
type Tipo = "FACTURA" | "PRESTACION" | "NOTA_CREDITO" | "NOTA_DEBITO";
type Estado = "borrador" | "emitido" | "contabilizado" | "pagado" | "anulado";

type Item = {
  id: string;
  fecha: string;
  tipo: Tipo;
  clase?: "A" | "B" | "C" | "M" | "X" | null;
  puntoVenta?: number | null;
  numero?: number | null;
  total: number;
  estado: Estado;
  cuentaId?: string;
  rol: RolTercero;
  tercero?: { id: string; nombre: string; cuit?: string | null } | null;
};

type PageResp = {
  items: Item[];
  total: number;
  page: number;
  pages: number;
};

const fmtMoney = (n: number | null | undefined) =>
  Number(n ?? 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  });

const fmtDate = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString("es-AR") : "—";

export default function ComprobantesListadoPage() {
  const [q, setQ] = useState("");
  const [rol, setRol] = useState<RolTercero | "">("");
  const [estado, setEstado] = useState<Estado | "">("");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<PageResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [anulando, setAnulando] = useState<string | null>(null);

  const query = useMemo(() => {
    const u = new URLSearchParams();
    if (rol) u.set("rol", rol);
    if (estado) u.set("estado", estado);
    if (q.trim()) u.set("q", q.trim());
    u.set("page", String(page));
    u.set("pageSize", "20");
    return `/terceros/comprobantes?${u.toString()}`;
  }, [q, rol, estado, page]);

  const load = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await api<PageResp>(query);
      setData(res);
    } catch (e) {
      setMsg(getErrorMessage(e));
      setData({ items: [], total: 0, page: 1, pages: 1 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const anular = async (id: string) => {
    if (!confirm("¿Anular el comprobante? Esta acción no se puede revertir.")) return;
    try {
      setAnulando(id);
      await api<{ ok?: boolean }>(`/terceros/comprobantes/${id}/anular`, {
        method: "POST",
        body: JSON.stringify({ organizacionId: ORG }),
      });
      await load();
    } catch (e) {
      setMsg(`Error al anular: ${getErrorMessage(e)}`);
    } finally {
      setAnulando(null);
    }
  };

  const handleClearFilters = () => {
    setQ("");
    setRol("");
    setEstado("");
    setPage(1);
  };

  const hasActiveFilters = Boolean(q.trim() || rol || estado);

  const getEstadoBadgeClass = (st: Estado) => {
    switch (st) {
      case "borrador":
        return "estado-borrador";
      case "emitido":
        return "estado-emitido";
      case "contabilizado":
        return "estado-contabilizado";
      case "pagado":
        return "estado-pagado";
      case "anulado":
        return "estado-anulado";
      default:
        return "estado-default";
    }
  };

  const getTipoIcon = (tipo: Tipo) => {
    switch (tipo) {
      case "FACTURA":
        return "📄";
      case "PRESTACION":
        return "🏥";
      case "NOTA_CREDITO":
        return "📋";
      case "NOTA_DEBITO":
        return "📝";
      default:
        return "📄";
    }
  };

  const getRolColor = (r: RolTercero) => {
    switch (r) {
      case "PROVEEDOR":
        return "rol-proveedor";
      case "PRESTADOR":
        return "rol-prestador";
      case "AFILIADO":
        return "rol-afiliado";
      case "OTRO":
        return "rol-otro";
      default:
        return "rol-default";
    }
  };

  return (
    <div className="page-container">
      {/* Header de página */}
      <div className="page-header">
        <div className="page-title-section">
          <h1 className="page-title">Comprobantes</h1>
          <p className="page-subtitle">Gestión y consulta de comprobantes del sistema</p>
        </div>
        <div className="page-actions">
          <a href="/terceros/comprobantes/nuevo" className="btn btn-primary">
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
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14,2 14,8 20,8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <line x1="10" y1="9" x2="8" y2="9" />
            </svg>
            Nuevo Comprobante
          </a>
        </div>
      </div>

      {/* Mensaje de error */}
      {msg && (
        <div className="alert alert-error">
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
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <div className="alert-text">{msg}</div>
          </div>
        </div>
      )}

      <div className="page-content">
        {/* Filtros y controles */}
        <div className="comprobantes-controls">
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
                placeholder="Buscar por tercero, CUIT o número..."
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
              <label className="filter-label">Rol del Tercero</label>
              <select
                className="filter-select"
                value={rol}
                onChange={(e) => {
                  setRol(e.target.value as RolTercero | "");
                  setPage(1);
                }}
              >
                <option value="">Todos los roles</option>
                <option value="PROVEEDOR">Proveedor</option>
                <option value="PRESTADOR">Prestador</option>
                <option value="AFILIADO">Afiliado</option>
                <option value="OTRO">Otro</option>
              </select>
            </div>

            <div className="filter-group">
              <label className="filter-label">Estado</label>
              <select
                className="filter-select"
                value={estado}
                onChange={(e) => {
                  setEstado(e.target.value as Estado | "");
                  setPage(1);
                }}
              >
                <option value="">Todos los estados</option>
                <option value="borrador">Borrador</option>
                <option value="emitido">Emitido</option>
                <option value="contabilizado">Contabilizado</option>
                <option value="pagado">Pagado</option>
                <option value="anulado">Anulado</option>
              </select>
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
                {data?.total === 0
                  ? "0 comprobantes"
                  : `${data?.total ?? 0} comprobantes encontrados`}
              </span>
            )}
          </div>
        </div>

        {/* Tabla de resultados */}
        <div className="comprobantes-table-container">
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
              <div className="loading-text">Cargando comprobantes...</div>
            </div>
          ) : !data || data.items.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">{hasActiveFilters ? "🔍" : "📄"}</div>
              <div className="empty-state-title">
                {hasActiveFilters ? "Sin resultados" : "No hay comprobantes"}
              </div>
              <div className="empty-state-text">
                {hasActiveFilters
                  ? "No se encontraron comprobantes que coincidan con los filtros aplicados"
                  : "Comienza creando el primer comprobante del sistema"}
              </div>
              {hasActiveFilters ? (
                <button onClick={handleClearFilters} className="btn btn-secondary">
                  Limpiar filtros
                </button>
              ) : (
                <a href="/terceros/comprobantes/nuevo" className="btn btn-primary">
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
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14,2 14,8 20,8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <line x1="10" y1="9" x2="8" y2="9" />
                  </svg>
                  Crear primer comprobante
                </a>
              )}
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Comprobante</th>
                    <th>Fecha</th>
                    <th>Tercero</th>
                    <th>Rol</th>
                    <th>Número</th>
                    <th className="table-col-numeric">Total</th>
                    <th className="table-col-center">Estado</th>
                    <th className="table-col-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((r) => {
                    const nro = [r.puntoVenta ?? "", r.numero ?? ""].filter(Boolean).join("-");
                    return (
                      <tr key={r.id}>
                        <td>
                          <div className="comprobante-info">
                            <div className="comprobante-icon">{getTipoIcon(r.tipo)}</div>
                            <div className="comprobante-details">
                              <div className="comprobante-tipo">
                                {r.tipo}
                                {r.clase && <span className="comprobante-clase">{r.clase}</span>}
                              </div>
                              <div className="comprobante-id">ID: {r.id}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="fecha-badge">{fmtDate(r.fecha)}</span>
                        </td>
                        <td>
                          <div className="tercero-info">
                            <div className="tercero-nombre">{r.tercero?.nombre ?? "Sin tercero"}</div>
                            {r.tercero?.cuit && (
                              <div className="tercero-cuit">CUIT: {r.tercero.cuit}</div>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className={`rol-badge ${getRolColor(r.rol)}`}>{r.rol}</span>
                        </td>
                        <td>
                          <span className="numero-badge">{nro || "—"}</span>
                        </td>
                        <td className="table-col-numeric">
                          <span className="monto-badge">{fmtMoney(r.total)}</span>
                        </td>
                        <td className="table-col-center">
                          <span className={`estado-badge ${getEstadoBadgeClass(r.estado)}`}>
                            {r.estado}
                          </span>
                        </td>
                        <td className="table-col-center">
                          <div className="actions-group">
                            {r.cuentaId && (
                              <a
                                href={`/finanzas/cuentas/${r.cuentaId}`}
                                className="btn btn-secondary btn-sm"
                                title="Ver cuenta asociada"
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
                                Cuenta
                              </a>
                            )}
                            {r.estado !== "anulado" && (
                              <button
                                className={`btn btn-sm ${
                                  anulando === r.id ? "btn-disabled" : "btn-danger"
                                }`}
                                onClick={() => anular(r.id)}
                                disabled={anulando === r.id}
                                title="Anular comprobante"
                              >
                                {anulando === r.id ? (
                                  <>
                                    <svg
                                      className="spinner"
                                      width="14"
                                      height="14"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    >
                                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                                    </svg>
                                    Anulando...
                                  </>
                                ) : (
                                  <>
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
                                      <circle cx="12" cy="12" r="10" />
                                      <line x1="15" y1="9" x2="9" y2="15" />
                                      <line x1="9" y1="9" x2="15" y2="15" />
                                    </svg>
                                    Anular
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Paginación */}
        {!loading && data && data.items.length > 0 && (
          <div className="pagination-container">
            <div className="pagination-info">
              <span className="pagination-text">
                Página {data.page} de {data.pages} ({data.total} resultados)
              </span>
            </div>
            <div className="pagination-controls">
              <button
                className="pagination-btn"
                onClick={() => setPage(1)}
                disabled={data.page <= 1}
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
                disabled={data.page <= 1}
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
              <span className="pagination-current">{data.page}</span>
              <button
                className="pagination-btn"
                onClick={() => setPage((p) => p + 1)}
                disabled={data.page >= data.pages}
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
                onClick={() => setPage(data.pages)}
                disabled={data.page >= data.pages}
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
    </div>
  );
}