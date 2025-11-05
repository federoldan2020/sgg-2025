"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, ORG, getErrorMessage } from "@/servicios/api";

type RolTercero = "PROVEEDOR" | "PRESTADOR" | "AFILIADO" | "OTRO";

type TerceroLite = {
  id: string;
  nombre: string;
  fantasia?: string | null;
  cuit?: string | null;
  codigo?: string | null;
  activo: boolean;
};

type CuentaLite = {
  id: string;
  rol: RolTercero;
  activo: boolean;
  saldoInicial: number | null;
  saldoActual: number | null;
};

type PorTerceroResp = {
  tercero: { id: string; nombre: string; cuit: string | null } | null;
  cuentas: CuentaLite[];
};

function useDebounced<T>(v: T, ms = 300) {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

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

const formatMoney = (amount: number | null) => {
  return (amount ?? 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  });
};

export default function CuentasIndexPage() {
  const [rol, setRol] = useState<RolTercero | "">("");
  const [q, setQ] = useState("");
  const debQ = useDebounced(q, 250);

  const [terceros, setTerceros] = useState<TerceroLite[]>([]);
  const [open, setOpen] = useState(false);
  const [terceroSel, setTerceroSel] = useState<TerceroLite | null>(null);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [resp, setResp] = useState<PorTerceroResp | null>(null);

  // buscar terceros por CUIT/nombre (con filtro opcional de rol)
  useEffect(() => {
    const run = async () => {
      const term = debQ.trim();
      if (!term) {
        setTerceros([]);
        return;
      }
      try {
        const url =
          `/terceros/buscar?q=${encodeURIComponent(term)}` +
          (rol ? `&rol=${rol}` : "") +
          `&limit=20`;
        const rows = await api<TerceroLite[]>(url);
        setTerceros(rows);
      } catch {
        // silent
      }
    };
    void run();
  }, [debQ, rol]);

  // cargar cuentas del tercero seleccionado
  const cargarCuentas = async (
    t: TerceroLite | null,
    r: RolTercero | "" = ""
  ) => {
    setResp(null);
    setErr(null);
    if (!t) return;
    setLoading(true);
    try {
      const url =
        `/cuentas-tercero/por-tercero?terceroId=${t.id}` +
        (r ? `&rol=${r}` : "");
      const data = await api<PorTerceroResp>(url);
      setResp(data);
    } catch (e) {
      setErr(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const onPick = (t: TerceroLite) => {
    setTerceroSel(t);
    setQ(`${t.nombre}${t.cuit ? " · " + t.cuit : ""}`);
    setOpen(false);
    void cargarCuentas(t, rol || "");
  };

  const clearSelection = () => {
    setTerceroSel(null);
    setQ("");
    setResp(null);
    setErr(null);
  };

  const cuentas = resp?.cuentas ?? [];
  const sinCuentas = useMemo(
    () => terceroSel && cuentas.length === 0,
    [terceroSel, cuentas]
  );

  const totalSaldo = useMemo(
    () => cuentas.reduce((sum, cuenta) => sum + (cuenta.saldoActual ?? 0), 0),
    [cuentas]
  );

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
            <span className="breadcrumb-current">Cuentas Corrientes</span>
          </div>
          <h1 className="page-title">Cuentas Corrientes</h1>
          <p className="page-subtitle">
            Consulta los saldos y movimientos por tercero
          </p>
        </div>
        <div className="page-actions">
          <div className="org-badge">
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
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9,22 9,12 15,12 15,22" />
            </svg>
            {ORG}
          </div>
        </div>
      </div>

      <div className="page-content">
        {/* Buscador */}
        <div className="form-section">
          <div className="form-section-header">
            <div>
              <h2 className="form-section-title">Buscar Tercero</h2>
              <p className="form-section-subtitle">
                Ingresa CUIT, nombre o razón social para encontrar las cuentas
              </p>
            </div>
            {terceroSel && (
              <button
                className="btn btn-ghost"
                onClick={clearSelection}
                title="Limpiar selección"
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

          <div className="form-grid form-grid-3">
            <div className="form-group form-group-autocomplete">
              <label className="form-label">Tercero</label>
              <div className="autocomplete-container">
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
                    value={q}
                    onChange={(e) => {
                      setQ(e.target.value);
                      setOpen(true);
                      if (!e.target.value) setTerceroSel(null);
                    }}
                    onFocus={() => setOpen(Boolean(q.trim()))}
                    placeholder="CUIT, nombre o razón social..."
                  />
                  {q && (
                    <button
                      className="form-input-clear"
                      onClick={clearSelection}
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

                {open && terceros.length > 0 && (
                  <div className="autocomplete-dropdown">
                    {terceros.map((t) => (
                      <div
                        key={t.id}
                        className="autocomplete-item"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => onPick(t)}
                      >
                        <div className="tercero-info">
                          <div className="tercero-nombre">{t.nombre}</div>
                          {t.fantasia && (
                            <div className="tercero-fantasia">
                              ({t.fantasia})
                            </div>
                          )}
                          {t.cuit && (
                            <div className="tercero-cuit">CUIT: {t.cuit}</div>
                          )}
                        </div>
                        <div
                          className={`tercero-status ${
                            t.activo ? "activo" : "inactivo"
                          }`}
                        >
                          {t.activo ? "Activo" : "Inactivo"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Filtrar por rol</label>
              <select
                className="form-select"
                value={rol}
                onChange={(e) => {
                  const r = e.target.value as RolTercero | "";
                  setRol(r);
                  void cargarCuentas(terceroSel, r || "");
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
              <label className="form-label">&nbsp;</label>
              <button
                className={`btn btn-lg ${
                  loading || !terceroSel ? "btn-disabled" : "btn-primary"
                }`}
                onClick={() => void cargarCuentas(terceroSel, rol || "")}
                disabled={!terceroSel || loading}
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
                      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                    </svg>
                    Ver Cuentas
                  </>
                )}
              </button>
            </div>
          </div>

          {err && (
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
                <div className="alert-text">{err}</div>
              </div>
            </div>
          )}
        </div>

        {/* Información del tercero seleccionado */}
        {terceroSel && (
          <div className="tercero-selected-info">
            <div className="tercero-selected-header">
              <div className="tercero-selected-avatar">
                <svg
                  width="24"
                  height="24"
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
              <div className="tercero-selected-details">
                <div className="tercero-selected-name">{terceroSel.nombre}</div>
                {terceroSel.cuit && (
                  <div className="tercero-selected-cuit">
                    CUIT: {terceroSel.cuit}
                  </div>
                )}
              </div>
              {cuentas.length > 0 && (
                <div className="tercero-selected-summary">
                  <div className="summary-label">Saldo Total</div>
                  <div
                    className={`summary-value ${
                      totalSaldo >= 0 ? "positive" : "negative"
                    }`}
                  >
                    {formatMoney(totalSaldo)}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Resultados */}
        <div className="cuentas-section">
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
              <div className="loading-text">Cargando cuentas...</div>
            </div>
          ) : !terceroSel ? (
            <div className="empty-state">
              <div className="empty-state-icon">🔍</div>
              <div className="empty-state-title">Selecciona un tercero</div>
              <div className="empty-state-text">
                Busca y selecciona un tercero para ver sus cuentas corrientes
              </div>
            </div>
          ) : sinCuentas ? (
            <div className="empty-state">
              <div className="empty-state-icon">💳</div>
              <div className="empty-state-title">Sin cuentas</div>
              <div className="empty-state-text">
                {rol
                  ? `Este tercero no tiene cuentas para el rol "${rol}"`
                  : "Este tercero no tiene cuentas registradas"}
              </div>
            </div>
          ) : cuentas.length > 0 ? (
            <>
              <div className="cuentas-header">
                <h3 className="cuentas-title">
                  Cuentas Corrientes ({cuentas.length})
                </h3>
                <div className="cuentas-filters">
                  {rol && (
                    <span className="filter-active">
                      Filtrado por: <strong>{rol}</strong>
                    </span>
                  )}
                </div>
              </div>

              <div className="table-container">
                <table className="data-table cuentas-table">
                  <thead>
                    <tr>
                      <th>ID Cuenta</th>
                      <th>Rol</th>
                      <th>Estado</th>
                      <th className="table-col-numeric">Saldo Inicial</th>
                      <th className="table-col-numeric">Saldo Actual</th>
                      <th className="table-col-actions">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cuentas.map((cuenta) => (
                      <tr key={cuenta.id} className="cuenta-row">
                        <td>
                          <span className="cuenta-id">#{cuenta.id}</span>
                        </td>
                        <td>
                          <span
                            className={`rol-badge ${getRolColor(cuenta.rol)}`}
                          >
                            {cuenta.rol}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`estado-badge ${
                              cuenta.activo ? "activo" : "inactivo"
                            }`}
                          >
                            {cuenta.activo ? "Activa" : "Inactiva"}
                          </span>
                        </td>
                        <td className="table-col-numeric">
                          <span className="saldo-value">
                            {formatMoney(cuenta.saldoInicial)}
                          </span>
                        </td>
                        <td className="table-col-numeric">
                          <span
                            className={`saldo-value ${
                              (cuenta.saldoActual ?? 0) >= 0
                                ? "positive"
                                : "negative"
                            }`}
                          >
                            {formatMoney(cuenta.saldoActual)}
                          </span>
                        </td>
                        <td className="table-col-actions">
                          <Link
                            href={`/finanzas/cuentas/${cuenta.id}`}
                            className="btn btn-primary btn-sm"
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
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <polyline points="14,2 14,8 20,8" />
                              <line x1="16" y1="13" x2="8" y2="13" />
                              <line x1="16" y1="17" x2="8" y2="17" />
                              <polyline points="10,9 9,9 8,9" />
                            </svg>
                            Ver Extracto
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">📊</div>
              <div className="empty-state-title">Sin resultados</div>
              <div className="empty-state-text">
                No se encontraron cuentas para mostrar
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
