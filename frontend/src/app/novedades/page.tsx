"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  FilePlus,
  FileText,
  RefreshCw,
  Send,
  XCircle,
  Loader2,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { mon, fmtFechaHora, fmtPeriodo } from "@/utiles/formatos";
import { getErrorMessage } from "@/servicios/api";
import {
  generarBorrador,
  listarBajasPendientes,
  listarLotes,
  type BajaPendiente,
  type NovedadLote,
} from "@/servicios/novedades";

function periodoActual(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const ESTADO: Record<NovedadLote["estado"], { label: string; cls: string }> = {
  borrador: { label: "Borrador", cls: "bg-amber-100 text-amber-800 border-amber-200" },
  enviado: { label: "Enviado", cls: "bg-medical-100 text-medical-800 border-medical-200" },
  parcialmente_conciliado: {
    label: "Parcial. conciliado",
    cls: "bg-violet-100 text-violet-800 border-violet-200",
  },
  conciliado: { label: "Conciliado", cls: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  anulado: { label: "Anulado", cls: "bg-rose-100 text-rose-700 border-rose-200" },
};

export default function NovedadesPage() {
  const [lotes, setLotes] = useState<NovedadLote[]>([]);
  const [bajas, setBajas] = useState<BajaPendiente[]>([]);
  const [loading, setLoading] = useState(true);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState(periodoActual());

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [l, b] = await Promise.all([listarLotes(50), listarBajasPendientes()]);
      setLotes(l);
      setBajas(b);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onGenerar() {
    if (!periodo || !/^\d{4}-\d{2}$/.test(periodo)) return;
    if (!confirm(`Vas a generar un borrador de novedades del período ${periodo}. ¿Continuar?`)) return;
    setGenerando(true);
    setError(null);
    try {
      const lote = await generarBorrador(periodo, "ESC");
      await load();
      window.location.href = `/novedades/${lote.id}`;
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setGenerando(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-medical-50 text-medical-600 ring-1 ring-medical-100">
            <Send className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
              Novedades a Cómputos
            </h1>
            <p className="text-sm text-neutral-500">
              Archivo TXT mensual con altas, bajas y K16 a descontar. Una vez
              enviado, las obligaciones quedan bloqueadas hasta que llegue el
              TXT de retorno.
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </header>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 size-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Generador */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-neutral-900">Generar nuevo borrador</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Sólo padrones del sistema ESC. Sólo cambios desde el último envío + K16 vigentes.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600">
              Período objetivo
            </label>
            <input
              type="text"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              placeholder="2026-07"
              pattern="\d{4}-\d{2}"
              className="mt-1 w-32 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-medical-400 focus:outline-none focus:ring-2 focus:ring-medical-500/30"
            />
            <div className="mt-1 text-xs text-neutral-500">{fmtPeriodo(periodo)}</div>
          </div>
          <Button onClick={onGenerar} disabled={generando || !/^\d{4}-\d{2}$/.test(periodo)}>
            {generando ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Generando…
              </>
            ) : (
              <>
                <FilePlus className="size-4" />
                Generar borrador
              </>
            )}
          </Button>
        </div>
      </section>

      {/* Bajas pendientes */}
      {bajas.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Clock className="size-5 text-amber-700" />
            <h2 className="text-base font-semibold text-amber-900">
              {bajas.length} bajas pendientes de informar
            </h2>
          </div>
          <p className="mt-1 text-xs text-amber-800/90">
            Estas bajas se incluirán automáticamente en el próximo borrador
            generado.
          </p>
          <div className="mt-4 overflow-hidden rounded-xl border border-amber-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-amber-50 text-left text-xs font-semibold uppercase tracking-wider text-amber-800">
                <tr>
                  <th className="px-3 py-2">Padrón</th>
                  <th className="px-3 py-2">Afiliado</th>
                  <th className="px-3 py-2">Código</th>
                  <th className="px-3 py-2">Motivo</th>
                  <th className="px-3 py-2">Solicitada</th>
                </tr>
              </thead>
              <tbody>
                {bajas.slice(0, 50).map((b) => (
                  <tr key={b.id} className="border-t border-amber-100">
                    <td className="px-3 py-2 font-mono">{b.padron.padron}</td>
                    <td className="px-3 py-2">
                      {b.padron.afiliado
                        ? `${b.padron.afiliado.apellido}, ${b.padron.afiliado.nombre}`
                        : "—"}
                    </td>
                    <td className="px-3 py-2 font-mono">{b.codigo}</td>
                    <td className="px-3 py-2 text-neutral-700">{b.motivo}</td>
                    <td className="px-3 py-2 text-neutral-600">{fmtFechaHora(b.fechaSolicitada)}</td>
                  </tr>
                ))}
                {bajas.length > 50 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-2 text-center text-xs text-neutral-500">
                      … y {bajas.length - 50} más
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Historial */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-neutral-900">Lotes recientes</h2>
        <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="px-4 py-2">Período</th>
                <th className="px-4 py-2">Canal</th>
                <th className="px-4 py-2">Estado</th>
                <th className="px-4 py-2">Generado</th>
                <th className="px-4 py-2">Enviado</th>
                <th className="px-4 py-2 text-right">Líneas</th>
                <th className="px-4 py-2 text-right">J22</th>
                <th className="px-4 py-2 text-right">K16</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-3">
                    <Skeleton className="h-4 w-full" />
                  </td>
                </tr>
              ) : lotes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-neutral-500">
                    Aún no se generó ningún lote. Cargá uno con el botón de arriba.
                  </td>
                </tr>
              ) : (
                lotes.map((l) => {
                  const badge = ESTADO[l.estado];
                  return (
                    <tr key={l.id} className="border-t border-neutral-200 hover:bg-neutral-50">
                      <td className="px-4 py-2">
                        <Link
                          href={`/novedades/${l.id}`}
                          className="font-mono font-semibold text-medical-700 hover:underline"
                        >
                          {l.periodo}
                        </Link>
                      </td>
                      <td className="px-4 py-2 font-mono text-xs">{l.canal}</td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${badge.cls}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-neutral-600">{fmtFechaHora(l.generadoEn)}</td>
                      <td className="px-4 py-2 text-xs text-neutral-600">{fmtFechaHora(l.enviadoEn)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{l.totalLineas}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{mon(l.totalJ22)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{mon(l.totalK16)}</td>
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
