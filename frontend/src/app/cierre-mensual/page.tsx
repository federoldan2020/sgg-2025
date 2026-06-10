"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CalendarClock, Play, FlaskConical, ChevronRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getErrorMessage } from "@/servicios/api";
import { fmtFechaHora } from "@/utiles/formatos";
import {
  convertirFirmes,
  ejecutarCierre,
  listarCierres,
  periodoSugeridoCierre,
  type CierreMensual,
} from "@/servicios/suspensiones";

const ESTADO_BADGE: Record<string, { label: string; cls: string }> = {
  completado: { label: "Completado", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  dry_run: { label: "Simulación", cls: "bg-violet-100 text-violet-700 border-violet-200" },
  en_curso: { label: "En curso", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  fallido: { label: "Fallido", cls: "bg-rose-100 text-rose-700 border-rose-200" },
};

export default function CierreMensualPage() {
  const router = useRouter();
  const [periodo, setPeriodo] = useState("");
  const [items, setItems] = useState<CierreMensual[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [ultimoResumen, setUltimoResumen] = useState<any>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [lista, sug] = await Promise.all([listarCierres(20), periodoSugeridoCierre()]);
      setItems(lista);
      if (!periodo) setPeriodo(sug.periodo);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function ejecutar(dryRun: boolean) {
    if (!periodo) return;
    if (!dryRun && !confirm(`Vas a ejecutar el cierre REAL del período ${periodo}. ¿Continuar?`)) return;
    setRunning(true);
    setError(null);
    setUltimoResumen(null);
    try {
      const r = await ejecutarCierre(periodo, dryRun);
      setUltimoResumen(r);
      await load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setRunning(false);
    }
  }

  async function onConvertirFirmes() {
    if (!confirm("Convertir todas las suspensiones provisorias con más de 5 días a firmes?")) return;
    setError(null);
    try {
      const r = await convertirFirmes();
      alert(`${r.convertidas} suspensiones convertidas a firmes`);
      await load();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-medical-50 text-medical-600 ring-1 ring-medical-100">
            <CalendarClock className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Cierre mensual</h1>
            <p className="text-sm text-neutral-500">
              Evalúa cobertura, suspende morosos, rehabilita y marca padrones inactivos.
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => void load()} aria-label="Actualizar">
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </header>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 size-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Lanzador */}
      <section className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-neutral-900">Ejecutar cierre</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Evalúa el período indicado (formato <code className="rounded bg-neutral-100 px-1">YYYY-MM</code>).
          Se sugiere el mes anterior, ya cerrado por los organismos externos.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600">
              Período
            </label>
            <input
              type="text"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              placeholder="2026-05"
              pattern="\d{4}-\d{2}"
              className="mt-1 w-32 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-medical-400 focus:outline-none focus:ring-2 focus:ring-medical-500/30"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={running || !periodo}
            onClick={() => void ejecutar(true)}
          >
            <FlaskConical className="size-4" />
            Simular (dry-run)
          </Button>
          <Button type="button" disabled={running || !periodo} onClick={() => void ejecutar(false)}>
            <Play className="size-4" />
            {running ? "Ejecutando…" : "Ejecutar cierre real"}
          </Button>

          <div className="ml-auto">
            <Button variant="ghost" size="sm" onClick={onConvertirFirmes}>
              Convertir provisorias → firmes
            </Button>
          </div>
        </div>

        {ultimoResumen && (
          <div className="mt-5 rounded-xl border border-medical-200 bg-medical-50/60 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-medical-900">
                {ultimoResumen.dryRun ? "Simulación" : "Cierre"} del período {ultimoResumen.periodo}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => router.push(`/cierre-mensual/${ultimoResumen.id}`)}
              >
                Ver detalle completo
                <ChevronRight className="size-4" />
              </Button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Suspendidos" value={ultimoResumen.totalSuspendidos} />
              <Stat label="Rehabilitados" value={ultimoResumen.totalRehabilitados} />
              <Stat label="Excluidos por excepción" value={ultimoResumen.totalExcluidos} />
              <Stat label="Padrones marcados inactivos" value={ultimoResumen.totalPadronesMarcados} />
            </div>
          </div>
        )}
      </section>

      {/* Historial */}
      <section className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-neutral-900">Corridas recientes</h2>
        <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="px-4 py-2">Período</th>
                <th className="px-4 py-2">Estado</th>
                <th className="px-4 py-2">Iniciado</th>
                <th className="px-4 py-2">Finalizado</th>
                <th className="px-4 py-2 text-right">Susp.</th>
                <th className="px-4 py-2 text-right">Rehab.</th>
                <th className="px-4 py-2 text-right">Excl.</th>
                <th className="px-4 py-2 text-right">Padrones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-t border-neutral-200">
                    <td colSpan={8} className="px-4 py-3">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-neutral-500">
                    Aún no se ejecutó ningún cierre.
                  </td>
                </tr>
              ) : (
                items.map((c) => {
                  const badge = ESTADO_BADGE[c.estado] ?? { label: c.estado, cls: "bg-neutral-100 text-neutral-700 border-neutral-200" };
                  return (
                    <tr
                      key={c.id}
                      className="cursor-pointer border-t border-neutral-200 hover:bg-medical-50/60"
                      onClick={() => router.push(`/cierre-mensual/${c.id}`)}
                    >
                      <td className="px-4 py-2 font-mono">{c.periodo}</td>
                      <td className="px-4 py-2">
                        <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-neutral-600">{fmtFechaHora(c.iniciadoEn)}</td>
                      <td className="px-4 py-2 text-neutral-600">{fmtFechaHora(c.finalizadoEn)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{c.totalSuspendidos}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{c.totalRehabilitados}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{c.totalExcluidos}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{c.totalPadronesMarcados}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-white/80 p-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums text-neutral-900">{value}</div>
    </div>
  );
}
