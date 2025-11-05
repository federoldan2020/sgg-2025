"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, getErrorMessage } from "@/servicios/api";

type Rol = "PROVEEDOR" | "PRESTADOR" | "AFILIADO" | "OTRO";

type Row = {
  id: string;
  nombre: string;
  fantasia?: string | null;
  cuit?: string | null;
  codigo?: string | null;
  tipoPersona?: "FISICA" | "JURIDICA" | "OTRO" | null;
  condIva?:
    | "INSCRIPTO"
    | "MONOTRIBUTO"
    | "EXENTO"
    | "CONSUMIDOR_FINAL"
    | "NO_RESPONSABLE"
    | null;
  activo: boolean;
  roles: { rol: Rol }[];
};

type PageResp = {
  items: Row[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
};

type CuentaLite = {
  id: string;
  rol: Rol;
  activo: boolean;
  saldoInicial?: number | null;
  saldoActual?: number | null;
};

const fmtARS = (n: number | null | undefined) =>
  Number(n ?? 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  });

const getRolColor = (rol: Rol) => {
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

const getRolIcon = (rol: Rol) => {
  switch (rol) {
    case "PROVEEDOR":
      return "🏢";
    case "PRESTADOR":
      return "🏥";
    case "AFILIADO":
      return "👤";
    case "OTRO":
      return "📝";
    default:
      return "❓";
  }
};

export default function TercerosListadoPage() {
  const router = useRouter();

  const [q, setQ] = useState("");
  const [rol, setRol] = useState<Rol | "">("");
  const [activo, setActivo] = useState<"" | "true" | "false">("");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<PageResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // estado de panel y cache de cuentas por tercero
  const [openCuentasFor, setOpenCuentasFor] = useState<string | null>(null);
  const [cuentas, setCuentas] = useState<Record<string, CuentaLite[]>>({});
  const [loadingCuentas, setLoadingCuentas] = useState<Record<string, boolean>>(
    {}
  );

  const query = useMemo(() => {
    const u = new URLSearchParams();
    if (q.trim()) u.set("q", q.trim());
    if (rol) u.set("rol", rol);
    if (activo) u.set("activo", String(activo));
    u.set("page", String(page));
    u.set("pageSize", "20");
    return `/terceros?${u.toString()}`;
  }, [q, rol, activo, page]);

  const load = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await api<PageResp>(query);
      setData(res);
    } catch (e) {
      setMsg(getErrorMessage(e));
      setData({ items: [], total: 0, page: 1, pageSize: 20, pages: 1 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [query]);

  // carga (o usa cache) de cuentas de un tercero
  const ensureCuentas = async (terceroId: string): Promise<CuentaLite[]> => {
    if (cuentas[terceroId]) return cuentas[terceroId];
    setLoadingCuentas((m) => ({ ...m, [terceroId]: true }));
    try {
      const res = await api<{ cuentas: CuentaLite[] }>(
        `/cuentas-tercero/por-tercero?terceroId=${encodeURIComponent(
          terceroId
        )}`
      );
      const arr = res.cuentas || [];
      setCuentas((m) => ({ ...m, [terceroId]: arr }));
      return arr;
    } catch (e) {
      setMsg(`Error al cargar cuentas: ${getErrorMessage(e)}`);
      return [];
    } finally {
      setLoadingCuentas((m) => ({ ...m, [terceroId]: false }));
    }
  };

  // handler del botón "Ver cuenta"
  const verCuenta = async (terceroId: string) => {
    const arr = await ensureCuentas(terceroId);
    if (arr.length === 1) {
      router.push(`/finanzas/cuentas/${arr[0].id}`);
    } else {
      // abre panel para que elijan cuál
      setOpenCuentasFor((curr) => (curr === terceroId ? null : terceroId));
    }
  };

  const exportCSV = () => {
    if (!data?.items.length) return;
    const rows: string[][] = [
      [
        "Nombre",
        "Fantasía",
        "CUIT",
        "Código",
        "Tipo",
        "Condición IVA",
        "Roles",
        "Estado",
      ],
      ...data.items.map((item) => [
        item.nombre,
        item.fantasia ?? "",
        item.cuit ?? "",
        item.codigo ?? "",
        item.tipoPersona ?? "",
        item.condIva ?? "",
        (item.roles ?? []).map((r) => r.rol).join(", "),
        item.activo ? "Activo" : "Inactivo",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `terceros_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setQ("");
    setRol("");
    setActivo("");
    setPage(1);
  };

  const hasFilters = q.trim() || rol || activo;

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div className="page-title-section">
          <div className="breadcrumb-nav">
            <Link href="/" className="breadcrumb-link">
              Inicio
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
            <span className="breadcrumb-current">Terceros</span>
          </div>
          <h1 className="page-title">Terceros</h1>
          <p className="page-subtitle">
            Gestión de proveedores, prestadores y afiliados
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
          <Link href="/terceros/new" className="btn btn-primary">
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
            Nuevo Tercero
          </Link>
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
                Encuentra terceros por nombre, CUIT, rol o estado
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
                  placeholder="Nombre, fantasía, CUIT o código..."
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setPage(1);
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
                  setRol(e.target.value as Rol | "");
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

            <div className="form-group">
              <label className="form-label">Estado</label>
              <select
                className="form-select"
                value={activo}
                onChange={(e) => {
                  setActivo(e.target.value as "" | "true" | "false");
                  setPage(1);
                }}
              >
                <option value="">Todos los estados</option>
                <option value="true">Activos</option>
                <option value="false">Inactivos</option>
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
                    Buscando...
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
                {activo && (
                  <span className="filter-tag">
                    <span className="filter-tag-label">Estado:</span>
                    <span className="filter-tag-value">
                      {activo === "true" ? "Activos" : "Inactivos"}
                    </span>
                    <button
                      className="filter-tag-remove"
                      onClick={() => {
                        setActivo("");
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
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <div className="summary-content">
                <div className="summary-label">Total de Terceros</div>
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
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </div>
              <div className="summary-content">
                <div className="summary-label">Activos</div>
                <div className="summary-value">
                  {data.items.filter((item) => item.activo).length}
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
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
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
        <div className="terceros-section">
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
              <div className="loading-text">Cargando terceros...</div>
            </div>
          ) : !data || data.items.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">👥</div>
              <div className="empty-state-title">Sin terceros</div>
              <div className="empty-state-text">
                {hasFilters
                  ? "No se encontraron terceros con los filtros aplicados"
                  : "No hay terceros registrados. Crea tu primer tercero para empezar"}
              </div>
              {hasFilters && (
                <button className="btn btn-secondary" onClick={clearFilters}>
                  Limpiar filtros
                </button>
              )}
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table terceros-table">
                <thead>
                  <tr>
                    <th>Tercero</th>
                    <th>CUIT</th>
                    <th>Roles</th>
                    <th>Estado</th>
                    <th className="table-col-actions">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((tercero) => {
                    const isOpen = openCuentasFor === tercero.id;
                    const cuentasRow = cuentas[tercero.id] || [];
                    const cargando = loadingCuentas[tercero.id];

                    return (
                      <tr key={tercero.id} className="tercero-row">
                        <td>
                          <div className="tercero-info">
                            <div className="tercero-nombre">
                              {tercero.nombre}
                            </div>
                            {tercero.fantasia && (
                              <div className="tercero-fantasia">
                                ({tercero.fantasia})
                              </div>
                            )}
                            {tercero.codigo && (
                              <div className="tercero-codigo">
                                Código: {tercero.codigo}
                              </div>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className="cuit-value">
                            {tercero.cuit || "—"}
                          </span>
                        </td>
                        <td>
                          <div className="roles-list">
                            {(tercero.roles ?? []).map((r, i) => (
                              <span
                                key={i}
                                className={`rol-badge ${getRolColor(r.rol)}`}
                              >
                                <span className="rol-icon">
                                  {getRolIcon(r.rol)}
                                </span>
                                {r.rol}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td>
                          <span
                            className={`estado-badge ${
                              tercero.activo
                                ? "estado-activo"
                                : "estado-inactivo"
                            }`}
                          >
                            {tercero.activo ? "Activo" : "Inactivo"}
                          </span>
                        </td>
                        <td className="table-col-actions">
                          <div className="action-buttons">
                            <Link
                              href={`/terceros/${tercero.id}`}
                              className="btn btn-ghost btn-sm"
                              title="Ver tercero"
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
                              Ver
                            </Link>
                            <Link
                              href={`/terceros/${tercero.id}`}
                              className="btn btn-ghost btn-sm"
                              title="Editar tercero"
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
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                              Editar
                            </Link>
                            <button
                              className="btn btn-primary btn-sm"
                              title="Ver cuentas"
                              onClick={() => verCuenta(tercero.id)}
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
                                <rect x="1" y="3" width="15" height="13" />
                                <path d="m16 8 2 2-2 2" />
                                <path d="M21 12H9" />
                              </svg>
                              Cuentas
                            </button>
                          </div>

                          {/* Panel cuentas expandible */}
                          {isOpen && (
                            <div className="cuentas-panel">
                              {cargando ? (
                                <div className="loading-state">
                                  <div className="loading-icon">
                                    <svg
                                      className="spinner"
                                      width="24"
                                      height="24"
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
                                  <div className="loading-text">
                                    Cargando cuentas...
                                  </div>
                                </div>
                              ) : cuentasRow.length === 0 ? (
                                <div className="empty-state-small">
                                  <div className="empty-state-icon-small">
                                    💳
                                  </div>
                                  <div className="empty-state-text">
                                    Este tercero no tiene cuentas registradas.
                                  </div>
                                </div>
                              ) : (
                                <div className="cuentas-grid">
                                  {cuentasRow.map((cuenta) => (
                                    <button
                                      key={cuenta.id}
                                      className="cuenta-card"
                                      title={`Ver extracto cuenta ${cuenta.rol}`}
                                      onClick={() =>
                                        router.push(
                                          `/finanzas/cuentas/${cuenta.id}`
                                        )
                                      }
                                    >
                                      <div className="cuenta-card-header">
                                        <span
                                          className={`cuenta-rol ${getRolColor(
                                            cuenta.rol
                                          )}`}
                                        >
                                          <span className="rol-icon">
                                            {getRolIcon(cuenta.rol)}
                                          </span>
                                          {cuenta.rol}
                                        </span>
                                        <span
                                          className={`cuenta-estado ${
                                            cuenta.activo
                                              ? "activa"
                                              : "inactiva"
                                          }`}
                                        >
                                          {cuenta.activo
                                            ? "Activa"
                                            : "Inactiva"}
                                        </span>
                                      </div>
                                      <div className="cuenta-card-body">
                                        <div className="cuenta-saldo-line">
                                          <span className="cuenta-saldo-label">
                                            Saldo actual
                                          </span>
                                          <span
                                            className={`cuenta-saldo-value ${
                                              (cuenta.saldoActual ?? 0) >= 0
                                                ? "positive"
                                                : "negative"
                                            }`}
                                          >
                                            {fmtARS(cuenta.saldoActual)}
                                          </span>
                                        </div>
                                        <div className="cuenta-saldo-line">
                                          <span className="cuenta-saldo-label">
                                            Saldo inicial
                                          </span>
                                          <span className="cuenta-saldo-value">
                                            {fmtARS(cuenta.saldoInicial)}
                                          </span>
                                        </div>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
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
        {data && data.pages > 1 && (
          <div className="pagination-section">
            <div className="pagination-info">
              <span className="pagination-text">
                Página {data.page} de {data.pages}
              </span>
              <span className="pagination-total">
                Total: {data.total} terceros
              </span>
            </div>
            <div className="pagination-controls">
              <button
                className={`btn btn-ghost ${
                  data.page <= 1 ? "btn-disabled" : ""
                }`}
                disabled={loading || data.page <= 1}
                onClick={() => setPage(1)}
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
                  <polygon points="19 20 9 12 19 4 19 20" />
                  <line x1="5" y1="19" x2="5" y2="5" />
                </svg>
              </button>
              <button
                className={`btn btn-ghost ${
                  data.page <= 1 ? "btn-disabled" : ""
                }`}
                disabled={loading || data.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
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
                title="Página siguiente"
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
              <button
                className={`btn btn-ghost ${
                  data.page >= data.pages ? "btn-disabled" : ""
                }`}
                disabled={loading || data.page >= data.pages}
                onClick={() => setPage(data.pages)}
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
                  <line x1="19" y1="5" x2="19" y2="19" />
                  <polygon points="5 4 15 12 5 20 5 4" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
