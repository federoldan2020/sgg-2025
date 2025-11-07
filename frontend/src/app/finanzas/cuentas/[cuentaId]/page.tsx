/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, getErrorMessage, ORG } from "@/servicios/api";

/* ===== Tipos (compatibles con tu back) ===== */
type RolTercero = "PROVEEDOR" | "PRESTADOR" | "AFILIADO" | "OTRO";
type TipoMov = "debito" | "credito";
type OrigenMov =
  | "factura"
  | "prestacion"
  | "nota_credito"
  | "nota_debito"
  | "orden_pago"
  | "ajuste"
  | string;

type Movimiento = {
  id: string;
  fecha: string;
  tipo: TipoMov;
  origen: OrigenMov;
  referenciaId?: string | null;
  detalle?: string | null;
  monto: number | string;
  saldoPosterior?: number | string | null;
};

type ExtractoResp = {
  cuenta?: {
    id: string;
    rol?: RolTercero;
    saldoInicial?: number | string | null;
    saldoActual?: number | string | null;
    activo?: boolean;
  };
  tercero?: { id: string; nombre: string; cuit?: string | null } | null;
  desde: string;
  hasta: string;
  saldoInicialPeriodo?: number | string | null;
  movimientos: Movimiento[];
  saldoFinalPeriodo?: number | string | null;
};

/* ===== Helpers ===== */
const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

const toNum = (v: unknown): number => {
  if (v == null) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  try {
    const n = Number((v as any)?.toString?.() ?? v);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
};

const money = (n: number) =>
  n.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const origenLabel: Record<string, string> = {
  factura: "Factura",
  prestacion: "Prestación",
  nota_credito: "Nota de crédito",
  nota_debito: "Nota de débito",
  orden_pago: "Orden de pago",
  ajuste: "Ajuste",
};

const getOrigenIcon = (origen: string) => {
  switch (origen) {
    case "factura":
      return "📄";
    case "prestacion":
      return "🏥";
    case "nota_credito":
      return "📋";
    case "nota_debito":
      return "📝";
    case "orden_pago":
      return "💰";
    case "ajuste":
      return "⚙️";
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

export default function CuentaExtractoPage() {
  const router = useRouter();
  const { cuentaId } = useParams<{ cuentaId: string }>();

  const today = fmtDate(new Date());
  const sixtyAgo = fmtDate(new Date(Date.now() - 60 * 24 * 60 * 60 * 1000));

  const [desde, setDesde] = useState(sixtyAgo);
  const [hasta, setHasta] = useState(today);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [data, setData] = useState<ExtractoResp | null>(null);
  const [applyTick, setApplyTick] = useState(0);

  const movimientos = data?.movimientos ?? [];

  const totalDeb = useMemo(
    () =>
      movimientos
        .filter((m) => m.tipo === "debito")
        .reduce((a, m) => a + toNum(m.monto), 0),
    [movimientos]
  );
  const totalCred = useMemo(
    () =>
      movimientos
        .filter((m) => m.tipo === "credito")
        .reduce((a, m) => a + toNum(m.monto), 0),
    [movimientos]
  );

  const saldoActualCuenta = toNum(data?.cuenta?.saldoActual);
  const saldoInicialCuenta = toNum(data?.cuenta?.saldoInicial);
  const saldoInicialPeriodo = toNum(
    data?.saldoInicialPeriodo ?? data?.cuenta?.saldoInicial ?? 0
  );
  const saldoFinalPeriodo =
    data?.saldoFinalPeriodo != null
      ? toNum(data.saldoFinalPeriodo)
      : saldoInicialPeriodo + totalCred - totalDeb;

  const load = useCallback(async () => {
    if (!cuentaId) return;
    setLoading(true);
    setMsg(null);
    try {
      const q = new URLSearchParams({ desde, hasta }).toString();
      const res = await api<ExtractoResp>(
        `/cuentas-tercero/${encodeURIComponent(cuentaId)}/extracto?${q}`
      );
      setData(res);
    } catch (e) {
      setMsg(getErrorMessage(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [cuentaId, desde, hasta]);

  useEffect(() => {
    void load();
  }, [load, applyTick]);

  const exportCSV = () => {
    if (!movimientos.length) return;
    const rows: string[][] = [
      ["Fecha", "Tipo", "Origen", "Ref", "Detalle", "Monto", "Saldo Posterior"],
      ...movimientos.map((m) => [
        new Date(m.fecha).toISOString().slice(0, 10),
        m.tipo,
        origenLabel[m.origen] ?? m.origen,
        m.referenciaId ? String(m.referenciaId) : "",
        (m.detalle ?? "").replaceAll('"', '""'),
        toNum(m.monto).toFixed(2),
        m.saldoPosterior == null ? "" : toNum(m.saldoPosterior).toFixed(2),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `extracto_${cuentaId}_${desde}_${hasta}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page-container">
      {/* Header de página */}
      <div className="page-header">
        <div className="page-title-section">
          <div className="breadcrumb-nav">
            <button
              onClick={() => router.back()}
              className="back-button"
              title="Volver"
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
              Volver
            </button>
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
            <Link href="/finanzas/cuentas" className="breadcrumb-link">
              Cuentas
            </Link>
          </div>
          <h1 className="page-title">Extracto de Cuenta</h1>
          <p className="page-subtitle">
            Movimientos y saldos de la cuenta corriente
          </p>
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
        {/* Información de la cuenta */}
        {data && (
          <div className="cuenta-info">
            <div className="cuenta-header">
              <div className="cuenta-avatar">
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
              <div className="cuenta-details">
                <div className="cuenta-tercero">
                  <span className="tercero-nombre">
                    {data.tercero?.nombre || "Sin tercero"}
                  </span>
                  {data.tercero?.cuit && (
                    <span className="tercero-cuit">
                      CUIT: {data.tercero.cuit}
                    </span>
                  )}
                </div>
                <div className="cuenta-meta">
                  <span className="cuenta-id">#{cuentaId}</span>
                  {data.cuenta?.rol && (
                    <span
                      className={`cuenta-rol ${getRolColor(data.cuenta.rol)}`}
                    >
                      {data.cuenta.rol}
                    </span>
                  )}
                  <span
                    className={`cuenta-estado ${
                      data.cuenta?.activo ? "activa" : "inactiva"
                    }`}
                  >
                    {data.cuenta?.activo ? "Activa" : "Inactiva"}
                  </span>
                </div>
              </div>
              <div className="cuenta-saldo">
                <div className="saldo-actual">
                  <span className="saldo-label">Saldo Actual</span>
                  <span className="saldo-value">
                    ${money(saldoActualCuenta)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filtros de período */}
        <div className="form-section">
          <div className="form-section-header">
            <div>
              <h2 className="form-section-title">Período de Consulta</h2>
              <p className="form-section-subtitle">
                Selecciona el rango de fechas
              </p>
            </div>
            <button
              className={`btn ${
                movimientos.length ? "btn-secondary" : "btn-disabled"
              }`}
              onClick={exportCSV}
              disabled={!movimientos.length}
              title="Descargar extracto en CSV"
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
              Exportar CSV
            </button>
          </div>

          <div className="form-grid form-grid-4">
            <div className="form-group">
              <label className="form-label">Fecha Desde</label>
              <input
                className="form-input"
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Fecha Hasta</label>
              <input
                className="form-input"
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">&nbsp;</label>
              <button
                className={`btn btn-lg ${
                  loading ? "btn-disabled" : "btn-primary"
                }`}
                onClick={() => setApplyTick((t) => t + 1)}
                disabled={loading || !cuentaId}
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
        </div>

        {/* Resumen del período */}
        {data && (
          <div className="resumen-periodo">
            <div className="resumen-header">
              <h3 className="resumen-title">Resumen del Período</h3>
              <div className="periodo-fechas">
                {new Date(desde).toLocaleDateString("es-AR")} -{" "}
                {new Date(hasta).toLocaleDateString("es-AR")}
              </div>
            </div>
            <div className="resumen-grid">
              <div className="resumen-item">
                <div className="resumen-icon saldo-inicial">
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
                    <polyline points="12,6 12,12 16,14" />
                  </svg>
                </div>
                <div className="resumen-content">
                  <div className="resumen-label">Saldo Inicial</div>
                  <div className="resumen-value">
                    ${money(saldoInicialPeriodo)}
                  </div>
                </div>
              </div>
              <div className="resumen-item">
                <div className="resumen-icon debitos">
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
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </div>
                <div className="resumen-content">
                  <div className="resumen-label">Débitos</div>
                  <div className="resumen-value debito">${money(totalDeb)}</div>
                </div>
              </div>
              <div className="resumen-item">
                <div className="resumen-icon creditos">
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
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </div>
                <div className="resumen-content">
                  <div className="resumen-label">Créditos</div>
                  <div className="resumen-value credito">
                    ${money(totalCred)}
                  </div>
                </div>
              </div>
              <div className="resumen-item">
                <div className="resumen-icon saldo-final">
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
                    <polyline points="22,12 18,12 15,21 9,3 6,12 2,12" />
                  </svg>
                </div>
                <div className="resumen-content">
                  <div className="resumen-label">Saldo Final</div>
                  <div className="resumen-value final">
                    ${money(saldoFinalPeriodo)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabla de movimientos */}
        <div className="movimientos-section">
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
              <div className="loading-text">Cargando movimientos...</div>
            </div>
          ) : movimientos.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📊</div>
              <div className="empty-state-title">Sin movimientos</div>
              <div className="empty-state-text">
                No hay movimientos registrados en el período seleccionado
              </div>
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table movimientos-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Movimiento</th>
                    <th>Referencia</th>
                    <th>Detalle</th>
                    <th className="table-col-numeric">Monto</th>
                    <th className="table-col-numeric">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.map((m) => {
                    const monto = toNum(m.monto);
                    const saldo =
                      m.saldoPosterior == null ? null : toNum(m.saldoPosterior);
                    return (
                      <tr key={m.id} className={`movimiento-row ${m.tipo}`}>
                        <td>
                          <span className="fecha-badge">
                            {new Date(m.fecha).toLocaleDateString("es-AR")}
                          </span>
                        </td>
                        <td>
                          <div className="movimiento-info">
                            <div className="movimiento-icon">
                              {getOrigenIcon(m.origen)}
                            </div>
                            <div className="movimiento-details">
                              <div className="movimiento-origen">
                                {origenLabel[m.origen] ?? m.origen}
                              </div>
                              <div className={`movimiento-tipo ${m.tipo}`}>
                                {m.tipo === "debito" ? "Débito" : "Crédito"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="referencia-badge">
                            {m.referenciaId || "—"}
                          </span>
                        </td>
                        <td>
                          <span className="detalle-text">
                            {m.detalle || "—"}
                          </span>
                        </td>
                        <td
                          className={`table-col-numeric monto-cell ${m.tipo}`}
                        >
                          <span className="monto-value">
                            {m.tipo === "debito" ? "-" : "+"}$
                            {money(Math.abs(monto))}
                          </span>
                        </td>
                        <td className="table-col-numeric">
                          <span className="saldo-value">
                            {saldo == null ? "—" : `$${money(saldo)}`}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
