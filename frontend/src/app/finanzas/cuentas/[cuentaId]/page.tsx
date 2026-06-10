/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Download,
  Loader2,
  Wallet,
} from "lucide-react";
import { api, getErrorMessage } from "@/servicios/api";
import { formatearFechaArgentina } from "@/utiles/formatos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/* ===== Tipos (compatibles con tu back) ===== */
type RolTercero = "PROVEEDOR" | "PRESTADOR" | "COMERCIO" | "AFILIADO" | "OTRO";

const ROL_BADGE: Record<string, string> = {
  PROVEEDOR: "bg-blue-100 text-blue-800 border-blue-200",
  PRESTADOR: "bg-violet-100 text-violet-800 border-violet-200",
  COMERCIO: "bg-amber-100 text-amber-800 border-amber-200",
  AFILIADO: "bg-emerald-100 text-emerald-800 border-emerald-200",
  OTRO: "bg-neutral-100 text-neutral-700 border-neutral-200",
};
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

  const saldoNeg = saldoActualCuenta < 0;

  return (
    <div className="mx-auto max-w-6xl">
      {/* Toolbar */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="mb-1 h-7 gap-1.5 px-2 text-neutral-500"
          >
            <ArrowLeft className="size-4" />
            Volver
          </Button>
          <h1 className="text-xl font-semibold text-neutral-900">
            Cuenta corriente
          </h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={exportCSV}
          disabled={!movimientos.length}
          className="gap-1.5"
        >
          <Download className="size-4" />
          Exportar
        </Button>
      </div>

      {msg && (
        <div
          className="mb-4 flex items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
          role="alert"
        >
          <AlertCircle className="size-5 shrink-0" />
          <span className="font-medium">{msg}</span>
        </div>
      )}

      {/* Cabecera de la cuenta */}
      {data && (
        <Card className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border-neutral-200 p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-full bg-medical-50 text-medical-600">
              <Wallet className="size-5" />
            </div>
            <div>
              <Link
                href={
                  data.tercero?.id ? `/terceros/${data.tercero.id}` : "#"
                }
                className="text-base font-semibold text-neutral-900 hover:text-medical-700"
              >
                {data.tercero?.nombre || "Sin tercero"}
              </Link>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                <span className="font-mono">#{cuentaId}</span>
                {data.tercero?.cuit && (
                  <span className="font-mono">CUIT {data.tercero.cuit}</span>
                )}
                {data.cuenta?.rol && (
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${ROL_BADGE[data.cuenta.rol] ?? ""}`}
                  >
                    {data.cuenta.rol}
                  </Badge>
                )}
                <span
                  className={
                    data.cuenta?.activo
                      ? "text-emerald-600"
                      : "text-neutral-400"
                  }
                >
                  {data.cuenta?.activo ? "Activa" : "Inactiva"}
                </span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-neutral-400">
              Saldo actual
            </div>
            <div
              className={`text-2xl font-bold tabular-nums ${
                saldoNeg ? "text-rose-700" : "text-emerald-700"
              }`}
            >
              ${money(saldoActualCuenta)}
            </div>
          </div>
        </Card>
      )}

      {/* Filtros de período */}
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">
            Desde
          </label>
          <Input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="h-9 rounded-lg border-neutral-200"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">
            Hasta
          </label>
          <Input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="h-9 rounded-lg border-neutral-200"
          />
        </div>
        <Button
          size="sm"
          onClick={() => setApplyTick((t) => t + 1)}
          disabled={loading || !cuentaId}
          className="h-9 gap-1.5"
        >
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Cargando…
            </>
          ) : (
            "Aplicar"
          )}
        </Button>
      </div>

      {/* Resumen del período */}
      {data && (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard
            label="Saldo inicial"
            value={`$${money(saldoInicialPeriodo)}`}
          />
          <SummaryCard
            label="Débitos"
            value={`$${money(totalDeb)}`}
            tone="rose"
          />
          <SummaryCard
            label="Créditos"
            value={`$${money(totalCred)}`}
            tone="emerald"
          />
          <SummaryCard
            label="Saldo final"
            value={`$${money(saldoFinalPeriodo)}`}
            tone={saldoFinalPeriodo < 0 ? "rose" : "emerald"}
            strong
          />
        </div>
      )}

      {/* Movimientos */}
      <Card className="overflow-hidden rounded-xl border-neutral-200">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-neutral-500">
            <Loader2 className="size-4 animate-spin" />
            Cargando movimientos…
          </div>
        ) : movimientos.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm font-medium text-neutral-700">
              Sin movimientos
            </p>
            <p className="mt-1 text-sm text-neutral-500">
              No hay movimientos en el período{" "}
              {formatearFechaArgentina(desde)} –{" "}
              {formatearFechaArgentina(hasta)}.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-500">
                <tr>
                  <th className="px-4 py-2.5">Fecha</th>
                  <th className="px-4 py-2.5">Movimiento</th>
                  <th className="px-4 py-2.5">Referencia</th>
                  <th className="px-4 py-2.5">Detalle</th>
                  <th className="px-4 py-2.5 text-right">Monto</th>
                  <th className="px-4 py-2.5 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {movimientos.map((m) => {
                  const monto = toNum(m.monto);
                  const saldo =
                    m.saldoPosterior == null ? null : toNum(m.saldoPosterior);
                  const esDebito = m.tipo === "debito";
                  return (
                    <tr key={m.id} className="hover:bg-neutral-50/60">
                      <td className="whitespace-nowrap px-4 py-2.5 text-neutral-600">
                        {formatearFechaArgentina(m.fecha)}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-base">
                            {getOrigenIcon(m.origen)}
                          </span>
                          <div>
                            <div className="font-medium text-neutral-800">
                              {origenLabel[m.origen] ?? m.origen}
                            </div>
                            <div
                              className={`flex items-center gap-1 text-xs ${
                                esDebito ? "text-rose-600" : "text-emerald-600"
                              }`}
                            >
                              {esDebito ? (
                                <ArrowUpRight className="size-3" />
                              ) : (
                                <ArrowDownLeft className="size-3" />
                              )}
                              {esDebito ? "Débito" : "Crédito"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-neutral-500">
                        {m.referenciaId || "—"}
                      </td>
                      <td className="max-w-[260px] truncate px-4 py-2.5 text-neutral-600">
                        {m.detalle || "—"}
                      </td>
                      <td
                        className={`px-4 py-2.5 text-right font-mono font-semibold tabular-nums ${
                          esDebito ? "text-rose-700" : "text-emerald-700"
                        }`}
                      >
                        {esDebito ? "−" : "+"}${money(Math.abs(monto))}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-neutral-700">
                        {saldo == null ? "—" : `$${money(saldo)}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/** Tarjeta de resumen del período. */
function SummaryCard({
  label,
  value,
  tone,
  strong,
}: {
  label: string;
  value: string;
  tone?: "rose" | "emerald";
  strong?: boolean;
}) {
  const color =
    tone === "rose"
      ? "text-rose-700"
      : tone === "emerald"
        ? "text-emerald-700"
        : "text-neutral-900";
  return (
    <Card className="rounded-xl border-neutral-200 p-4">
      <div className="text-xs uppercase tracking-wider text-neutral-400">
        {label}
      </div>
      <div
        className={`mt-1 font-mono tabular-nums ${strong ? "text-xl font-bold" : "text-lg font-semibold"} ${color}`}
      >
        {value}
      </div>
    </Card>
  );
}
