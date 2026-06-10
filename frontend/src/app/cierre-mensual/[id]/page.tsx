"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  RefreshCw,
  ShieldOff,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { mon, fmtFechaHora } from "@/utiles/formatos";
import { getErrorMessage } from "@/servicios/api";
import { detalleCierre, type CierreMensual } from "@/servicios/suspensiones";

type ResumenCierre = {
  suspendidos: Array<{
    afiliadoId: string;
    dni: string;
    apellido: string;
    nombre: string;
    periodo: string;
    deuda: number;
  }>;
  rehabilitados: Array<{
    afiliadoId: string;
    dni: string;
    apellido: string;
    nombre: string;
  }>;
  excluidosExcepcion: Array<{
    afiliadoId: string;
    dni: string;
    apellido: string;
    nombre: string;
    motivo: string;
  }>;
  padronesMarcados: Array<{
    padronId: string;
    padron: string;
    afiliadoId: string;
  }>;
};

const ESTADO: Record<
  string,
  { label: string; cls: string }
> = {
  completado: { label: "Completado", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  dry_run: { label: "Simulación", cls: "bg-violet-100 text-violet-700 border-violet-200" },
  en_curso: { label: "En curso", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  fallido: { label: "Fallido", cls: "bg-rose-100 text-rose-700 border-rose-200" },
};

function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v ?? "");
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.join(","), ...rows.map((r) => r.map(escape).join(","))];
  const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CierreMensualDetallePage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [cierre, setCierre] = useState<CierreMensual | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const c = await detalleCierre(id);
      setCierre(c);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const resumen = (cierre?.resumen ?? null) as ResumenCierre | null;
  const esDryRun = cierre?.estado === "dry_run";
  const badge = cierre ? ESTADO[cierre.estado] ?? { label: cierre.estado, cls: "bg-neutral-100 text-neutral-700 border-neutral-200" } : null;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Link
            href="/cierre-mensual"
            className="flex size-10 items-center justify-center rounded-xl bg-medical-50 text-medical-600 ring-1 ring-medical-100 hover:bg-medical-100"
            aria-label="Volver"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-medical-600">
              <CalendarClock className="size-3.5" />
              Cierre mensual
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-neutral-900">
              {cierre ? `Período ${cierre.periodo}` : "Cargando…"}
            </h1>
            {cierre && badge && (
              <div className="mt-1 flex items-center gap-2 text-sm text-neutral-500">
                <span
                  className={`inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${badge.cls}`}
                >
                  {badge.label}
                </span>
                <span>Iniciado {fmtFechaHora(cierre.iniciadoEn)}</span>
                {cierre.finalizadoEn && (
                  <>
                    <span>·</span>
                    <span>Finalizado {fmtFechaHora(cierre.finalizadoEn)}</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <Button variant="ghost" size="icon" onClick={() => void cargar()} aria-label="Actualizar">
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </header>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 size-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && !cierre ? (
        <Skeleton className="h-32 w-full" />
      ) : !cierre ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-500">
          Cierre no encontrado.
        </div>
      ) : (
        <>
          {esDryRun && (
            <div className="flex items-start gap-2 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-800">
              <AlertCircle className="mt-0.5 size-5 shrink-0" />
              <div>
                <div className="font-semibold">Esto es una simulación (dry-run)</div>
                <div className="mt-0.5 text-xs">
                  Ningún afiliado fue suspendido todavía. Revisá la lista y, si te convence, volvé a
                  /cierre-mensual y ejecutá el cierre real.
                </div>
              </div>
            </div>
          )}

          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label="Suspendidos" value={cierre.totalSuspendidos} tone="rose" />
            <Kpi label="Rehabilitados" value={cierre.totalRehabilitados} tone="emerald" />
            <Kpi label="Excluidos por excepción" value={cierre.totalExcluidos} tone="amber" />
            <Kpi label="Padrones inactivos" value={cierre.totalPadronesMarcados} tone="neutral" />
          </section>

          {!resumen ? (
            <div className="rounded-xl border border-neutral-200 bg-white p-6 text-sm text-neutral-500">
              Esta corrida no tiene resumen detallado guardado.
            </div>
          ) : (
            <>
              <PanelTabla
                title="Afiliados a suspender"
                icon={ShieldOff}
                tone="rose"
                rows={resumen.suspendidos}
                empty="Ningún afiliado a suspender."
                exportar={() =>
                  downloadCsv(
                    `cierre-${cierre.periodo}-suspendidos.csv`,
                    ["DNI", "Apellido", "Nombre", "Período origen", "Deuda"],
                    resumen.suspendidos.map((r) => [
                      r.dni,
                      r.apellido,
                      r.nombre,
                      r.periodo,
                      r.deuda.toFixed(2),
                    ]),
                  )
                }
                renderHead={() => (
                  <tr>
                    <th className="px-3 py-2 text-left">DNI</th>
                    <th className="px-3 py-2 text-left">Apellido y nombre</th>
                    <th className="px-3 py-2 text-left">Período</th>
                    <th className="px-3 py-2 text-right">Deuda</th>
                  </tr>
                )}
                renderRow={(r) => (
                  <tr key={r.afiliadoId} className="border-t border-neutral-200 hover:bg-neutral-50">
                    <td className="px-3 py-2 font-mono">{r.dni}</td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/afiliados/${r.afiliadoId}/estado`}
                        className="font-semibold text-medical-700 hover:underline"
                      >
                        {r.apellido}, {r.nombre}
                      </Link>
                    </td>
                    <td className="px-3 py-2 font-mono text-neutral-600">{r.periodo}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-rose-700">
                      {mon(r.deuda)}
                    </td>
                  </tr>
                )}
              />

              <PanelTabla
                title="Rehabilitados"
                icon={ShieldCheck}
                tone="emerald"
                rows={resumen.rehabilitados}
                empty="Ningún afiliado rehabilitado en esta corrida."
                exportar={() =>
                  downloadCsv(
                    `cierre-${cierre.periodo}-rehabilitados.csv`,
                    ["DNI", "Apellido", "Nombre"],
                    resumen.rehabilitados.map((r) => [r.dni, r.apellido, r.nombre]),
                  )
                }
                renderHead={() => (
                  <tr>
                    <th className="px-3 py-2 text-left">DNI</th>
                    <th className="px-3 py-2 text-left">Apellido y nombre</th>
                  </tr>
                )}
                renderRow={(r) => (
                  <tr key={r.afiliadoId} className="border-t border-neutral-200 hover:bg-neutral-50">
                    <td className="px-3 py-2 font-mono">{r.dni}</td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/afiliados/${r.afiliadoId}/estado`}
                        className="font-semibold text-medical-700 hover:underline"
                      >
                        {r.apellido}, {r.nombre}
                      </Link>
                    </td>
                  </tr>
                )}
              />

              <PanelTabla
                title="Excluidos por excepción ADMIN"
                icon={CheckCircle2}
                tone="amber"
                rows={resumen.excluidosExcepcion}
                empty="Ningún afiliado excluido (no hay excepciones activas)."
                exportar={() =>
                  downloadCsv(
                    `cierre-${cierre.periodo}-excluidos.csv`,
                    ["DNI", "Apellido", "Nombre", "Motivo"],
                    resumen.excluidosExcepcion.map((r) => [r.dni, r.apellido, r.nombre, r.motivo]),
                  )
                }
                renderHead={() => (
                  <tr>
                    <th className="px-3 py-2 text-left">DNI</th>
                    <th className="px-3 py-2 text-left">Apellido y nombre</th>
                    <th className="px-3 py-2 text-left">Motivo</th>
                  </tr>
                )}
                renderRow={(r) => (
                  <tr key={r.afiliadoId} className="border-t border-neutral-200 hover:bg-neutral-50">
                    <td className="px-3 py-2 font-mono">{r.dni}</td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/afiliados/${r.afiliadoId}/estado`}
                        className="font-semibold text-medical-700 hover:underline"
                      >
                        {r.apellido}, {r.nombre}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-neutral-600">{r.motivo}</td>
                  </tr>
                )}
              />

              <PanelTabla
                title="Padrones marcados inactivos"
                icon={XCircle}
                tone="neutral"
                rows={resumen.padronesMarcados}
                empty="Ningún padrón a marcar."
                exportar={() =>
                  downloadCsv(
                    `cierre-${cierre.periodo}-padrones-inactivos.csv`,
                    ["Padrón", "AfiliadoId"],
                    resumen.padronesMarcados.map((r) => [r.padron, r.afiliadoId]),
                  )
                }
                renderHead={() => (
                  <tr>
                    <th className="px-3 py-2 text-left">Padrón</th>
                    <th className="px-3 py-2 text-left">Afiliado</th>
                  </tr>
                )}
                renderRow={(r) => (
                  <tr key={r.padronId} className="border-t border-neutral-200 hover:bg-neutral-50">
                    <td className="px-3 py-2 font-mono">{r.padron}</td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/afiliados/${r.afiliadoId}/estado`}
                        className="font-mono text-medical-700 hover:underline"
                      >
                        #{r.afiliadoId}
                      </Link>
                    </td>
                  </tr>
                )}
              />
            </>
          )}

          {esDryRun && (
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => router.push("/cierre-mensual")}>
                Volver
              </Button>
              <Button onClick={() => router.push("/cierre-mensual")}>
                Ir a ejecutar real
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "rose" | "emerald" | "amber" | "neutral";
}) {
  const cls = {
    rose: "text-rose-700",
    emerald: "text-emerald-700",
    amber: "text-amber-700",
    neutral: "text-neutral-900",
  }[tone];
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
        {label}
      </div>
      <div className={`mt-2 text-3xl font-bold tabular-nums ${cls}`}>{value}</div>
    </div>
  );
}

function PanelTabla<T>({
  title,
  icon: Icon,
  tone,
  rows,
  empty,
  renderHead,
  renderRow,
  exportar,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "rose" | "emerald" | "amber" | "neutral";
  rows: T[];
  empty: string;
  renderHead: () => React.ReactNode;
  renderRow: (r: T) => React.ReactNode;
  exportar: () => void;
}) {
  const toneCls = {
    rose: "text-rose-600 bg-rose-50 ring-rose-100",
    emerald: "text-emerald-600 bg-emerald-50 ring-emerald-100",
    amber: "text-amber-600 bg-amber-50 ring-amber-100",
    neutral: "text-neutral-600 bg-neutral-50 ring-neutral-100",
  }[tone];

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`flex size-8 items-center justify-center rounded-lg ring-1 ${toneCls}`}>
            <Icon className="size-4" />
          </div>
          <h3 className="text-base font-semibold text-neutral-900">{title}</h3>
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-700">
            {rows.length}
          </span>
        </div>
        {rows.length > 0 && (
          <Button variant="outline" size="sm" onClick={exportar}>
            <Download className="size-4" />
            CSV
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-200 p-6 text-center text-sm text-neutral-500">
          {empty}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-200">
          <div className="max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                {renderHead()}
              </thead>
              <tbody>{rows.map((r) => renderRow(r))}</tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
