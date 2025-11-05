"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, ORG, getErrorMessage } from "@/servicios/api";

type RolTercero = "PROVEEDOR" | "PRESTADOR" | "AFILIADO" | "OTRO";
type Estado = "borrador" | "confirmado" | "anulado";

type Item = {
  id: string;
  fecha: string;
  total: number;
  estado: Estado;
  rol: RolTercero;
  cuentaId?: string;
  numeroOP?: number;
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

const getEstadoIcon = (estado: Estado) => {
  switch (estado) {
    case "borrador":
      return "📝";
    case "confirmado":
      return "✅";
    case "anulado":
      return "❌";
    default:
      return "📄";
  }
};

const getRolColor = (rol?: RolTercero) => {
  switch (rol) {
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

const getEstadoColor = (estado: Estado) => {
  switch (estado) {
    case "borrador":
      return "estado-borrador";
    case "confirmado":
      return "estado-confirmado";
    case "anulado":
      return "estado-anulado";
    default:
      return "estado-default";
  }
};

export default function OrdenesPagoListadoPage() {
  const [q, setQ] = useState("");
  const [rol, setRol] = useState<RolTercero | "">("");
  const [estado, setEstado] = useState<Estado | "">("");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<PageResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const query = useMemo(() => {
    const u = new URLSearchParams();
    u.set("organizacionId", ORG);
    if (rol) u.set("rol", rol);
    if (estado) u.set("estado", estado);
    if (q.trim()) u.set("q", q.trim());
    u.set("page", String(page));
    u.set("pageSize", "20");
    return `/terceros/ordenes-pago?${u.toString()}`;
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
  }, [query]);

  const anular = async (id: string) => {
    if (!confirm("¿Anular la orden de pago? Esto revertirá aplicaciones."))
      return;
    try {
      setLoading(true);
      await api<{ ok?: boolean }>(`/terceros/ordenes-pago/${id}/anular`, {
        method: "POST",
        body: JSON.stringify({ organizacionId: ORG }),
      });
      await load();
    } catch (e) {
      alert(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    if (!data?.items.length) return;
    const rows: string[][] = [
      ["N°", "Fecha", "Tercero", "CUIT", "Rol", "Total", "Estado"],
      ...data.items.map((item) => [
        String(item.numeroOP ?? ""),
        fmtDate(item.fecha),
        item.tercero?.nombre ?? "",
        item.tercero?.cuit ?? "",
        item.rol,
        String(item.total),
        item.estado,
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ordenes-pago_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setQ("");
    setRol("");
    setEstado("");
    setPage(1);
  };

  const hasFilters = q.trim() || rol || estado;

  return (
    <div className="page-container">
      {/* Header de página */}
      <div className="page-header">
        <div className="page-title-section">
          <div className="breadcrumb-nav">
            <Link href="/finanzas" className="breadcrumb-link">
              Finanzas
            </Link>
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
            <span className="breadcrumb-current">Órdenes de Pago</span>
          </div>
          <h1 className="page-title">Órdenes de Pago</h1>
          <p className="page-subtitle">
            Gestión de pagos a terceros y proveedores
          </p>
        </div>
        <div className="page-actions">
          <button
            className={`btn ${
              data?.items.length ? "btn-secondary" : "btn-disabled"
            }`}
            onClick={exportCSV}
            disabled={!data?.items.length}
            title="Exportar a CSV"
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
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-15" />
              <polyline points="7,10 12,15 17,10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Exportar
          </button>
          <button className="btn btn-primary">
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
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Nueva Orden
          </button>
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
        {/* Filtros */}
        <div className="form-section">
          <div className="form-section-header">
            <div>
              <h2 className="form-section-title">Filtros de Búsqueda</h2>
              <p className="form-section-subtitle">
                Encuentra órdenes por tercero, rol o estado
              </p>
            </div>
            {hasFilters && (
              <button
                className="btn btn-ghost"
                onClick={clearFilters}
                title="Limpiar filtros"
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
                  <path d="M3 6h18l-2 13H5L3 6z" />
                  <path d="m19 6-3-3H8L5 6" />
                </svg>
                Limpiar
              </button>
            )}
          </div>

          <div className="form-grid form-grid-4">
            <div className="form-group">
              <label className="form-label">Buscar</label>
              <div className="form-input-group">
                <svg
                  className="form-input-icon"
                  width="16"
                  height="16"
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
                  className="form-input form-input-with-icon"
                  placeholder="Nombre o CUIT del tercero..."
                  value={q}
                  onChange={(e) => {
                    setPage(1);
                    setQ(e.target.value);
                  }}
                />
                {q && (
                  <button
                    className="form-input-clear"
                    onClick={() => {
                      setQ("");
                      setPage(1);
                    }}
                    title="Limpiar búsqueda"
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
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Rol</label>
              <select
                className="form-select"
                value={rol}
                onChange={(e) => {
                  setPage(1);
                  setRol(e.target.value as RolTercero | "");
                }}
              >
                <option value="">Todos los roles</option>
                <option value="PROVEEDOR">Proveedor</option>
                <option value="PRESTADOR">Prestador</option>
                <option value="AFILIADO">Afiliado</option>
                <option value="OTRO">Otro</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Estado</label>
              <select
                className="form-select"
                value={estado}
                onChange={(e) => {
                  setPage(1);
                  setEstado(e.target.value as Estado | "");
                }}
              >
                <option value="">Todos los estados</option>
                <option value="borrador">Borrador</option>
                <option value="confirmado">Confirmado</option>
                <option value="anulado">Anulado</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">&nbsp;</label>
              <button
                className={`btn btn-lg ${
                  loading ? "btn-disabled" : "btn-primary"
                }`}
                onClick={() => {
                  setPage(1);
                  void load();
                }}
                disabled={loading}
              >
                {loading ? (
                  <>
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
                  </>
                ) : (
                  <>
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
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                    Aplicar Filtros
                  </>
                )}
              </button>
            </div>
          </div>

          {hasFilters && (
            <div className="active-filters">
              <span className="active-filters-label">Filtros activos:</span>
              <div className="active-filters-list">
                {q && (
                  <span className="filter-tag">
                    <span className="filter-tag-label">Búsqueda:</span>
                    <span className="filter-tag-value">{q}</span>
                    <button
                      className="filter-tag-remove"
                      onClick={() => {
                        setQ("");
                        setPage(1);
                      }}
                    >
                      ×
                    </button>
                  </span>
                )}
                {rol && (
                  <span className="filter-tag">
                    <span className="filter-tag-label">Rol:</span>
                    <span className="filter-tag-value">{rol}</span>
                    <button
                      className="filter-tag-remove"
                      onClick={() => {
                        setRol("");
                        setPage(1);
                      }}
                    >
                      ×
                    </button>
                  </span>
                )}
                {estado && (
                  <span className="filter-tag">
                    <span className="filter-tag-label">Estado:</span>
                    <span className="filter-tag-value">{estado}</span>
                    <button
                      className="filter-tag-remove"
                      onClick={() => {
                        setEstado("");
                        setPage(1);
                      }}
                    >
                      ×
                    </button>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Resumen */}
        {data && (
          <div className="summary-section">
            <div className="summary-item">
              <div className="summary-icon">
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
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14,2 14,8 20,8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10,9 9,9 8,9" />
                </svg>
              </div>
              <div className="summary-content">
                <div className="summary-label">Total de Órdenes</div>
                <div className="summary-value">{data.total}</div>
              </div>
            </div>
            <div className="summary-item">
              <div className="summary-icon">
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
                  <line x1="12" y1="1" x2="12" y2="23" />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </div>
              <div className="summary-content">
                <div className="summary-label">Monto Total</div>
                <div className="summary-value">
                  {fmtMoney(
                    data.items.reduce((sum, item) => sum + item.total, 0)
                  )}
                </div>
              </div>
            </div>
            <div className="summary-item">
              <div className="summary-icon">
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
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <div className="summary-content">
                <div className="summary-label">Mostrando</div>
                <div className="summary-value">{data.items.length}</div>
              </div>
            </div>
          </div>
        )}

        {/* Tabla */}
        <div className="ordenes-section">
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
              <div className="loading-text">Cargando órdenes...</div>
            </div>
          ) : !data || data.items.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">💰</div>
              <div className="empty-state-title">Sin órdenes de pago</div>
              <div className="empty-state-text">
                {hasFilters
                  ? "No se encontraron órdenes con los filtros aplicados"
                  : "No hay órdenes de pago registradas"}
              </div>
              {hasFilters && (
                <button className="btn btn-secondary" onClick={clearFilters}>
                  Limpiar filtros
                </button>
              )}
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table ordenes-table">
                <thead>
                  <tr>
                    <th>N° Orden</th>
                    <th>Fecha</th>
                    <th>Tercero</th>
                    <th>Rol</th>
                    <th className="table-col-numeric">Total</th>
                    <th>Estado</th>
                    <th className="table-col-actions">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => (
                    <tr key={item.id} className="orden-row">
                      <td>
                        <span className="numero-op">
                          {item.numeroOP ? `#${item.numeroOP}` : "—"}
                        </span>
                      </td>
                      <td>
                        <span className="fecha-badge">
                          {fmtDate(item.fecha)}
                        </span>
                      </td>
                      <td>
                        <div className="tercero-info">
                          <div className="tercero-nombre">
                            {item.tercero?.nombre ?? "—"}
                          </div>
                          {item.tercero?.cuit && (
                            <div className="tercero-cuit">
                              {item.tercero.cuit}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={`rol-badge ${getRolColor(item.rol)}`}>
                          {item.rol}
                        </span>
                      </td>
                      <td className="table-col-numeric">
                        <span className="monto-value">
                          {fmtMoney(item.total)}
                        </span>
                      </td>
                      <td>
                        <div className="estado-info">
                          <span className="estado-icon">
                            {getEstadoIcon(item.estado)}
                          </span>
                          <span
                            className={`estado-badge ${getEstadoColor(
                              item.estado
                            )}`}
                          >
                            {item.estado}
                          </span>
                        </div>
                      </td>
                      <td className="table-col-actions">
                        <div className="action-buttons">
                          {item.cuentaId && (
                            <Link
                              href={`/finanzas/cuentas/${item.cuentaId}`}
                              className="btn btn-ghost btn-sm"
                              title="Ver cuenta corriente"
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
                                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                              </svg>
                              Cuenta
                            </Link>
                          )}
                          {item.estado !== "anulado" && (
                            <button
                              className="btn btn-ghost btn-sm btn-danger"
                              onClick={() => void anular(item.id)}
                              disabled={loading}
                              title="Anular orden de pago"
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
                                <circle cx="12" cy="12" r="10" />
                                <line x1="15" y1="9" x2="9" y2="15" />
                                <line x1="9" y1="9" x2="15" y2="15" />
                              </svg>
                              Anular
                            </button>
                          )}
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
        {data && data.pages > 1 && (
          <div className="pagination-section">
            <div className="pagination-info">
              <span className="pagination-text">
                Página {data.page} de {data.pages}
              </span>
              <span className="pagination-total">
                Total: {data.total} órdenes
              </span>
            </div>
            <div className="pagination-controls">
              <button
                className={`btn btn-ghost ${
                  data.page <= 1 ? "btn-disabled" : ""
                }`}
                disabled={loading || data.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
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
                Anterior
              </button>
              <span className="pagination-current">
                {data.page} / {data.pages}
              </span>
              <button
                className={`btn btn-ghost ${
                  data.page >= data.pages ? "btn-disabled" : ""
                }`}
                disabled={loading || data.page >= data.pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Siguiente
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
}