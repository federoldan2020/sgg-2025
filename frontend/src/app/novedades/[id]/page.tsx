"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  RefreshCw,
  Send,
  XCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { mon, fmtFechaHora, fmtPeriodo } from "@/utiles/formatos";
import { getErrorMessage } from "@/servicios/api";
import {
  anularLote,
  descargarTxt,
  detalleLote,
  generarBorrador,
  itemsLote,
  marcarEnviado,
  type NovedadLote,
  type NovedadLoteItem,
} from "@/servicios/novedades";

const ESTADO: Record<NovedadLote["estado"], { label: string; cls: string }> = {
  borrador: { label: "Borrador", cls: "bg-amber-100 text-amber-800 border-amber-200" },
  enviado: { label: "Enviado", cls: "bg-medical-100 text-medical-800 border-medical-200" },
  parcialmente_conciliado: {
    label: "Parcialmente conciliado",
    cls: "bg-violet-100 text-violet-800 border-violet-200",
  },
  conciliado: { label: "Conciliado", cls: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  anulado: { label: "Anulado", cls: "bg-rose-100 text-rose-700 border-rose-200" },
};

const TIPO_BADGE: Record<NovedadLoteItem["tipoMovimiento"], string> = {
  alta: "bg-emerald-50 text-emerald-700 border-emerald-200",
  baja: "bg-rose-50 text-rose-700 border-rose-200",
  mixto: "bg-violet-50 text-violet-700 border-violet-200",
  k16_solo: "bg-indigo-50 text-indigo-700 border-indigo-200",
};

export default function NovedadDetallePage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [lote, setLote] = useState<NovedadLote | null>(null);
  const [items, setItems] = useState<NovedadLoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<"" | NovedadLoteItem["tipoMovimiento"]>("");
  const [filtroTexto, setFiltroTexto] = useState("");

  async function load() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [l, it] = await Promise.all([detalleLote(id), itemsLote(id)]);
      setLote(l);
      setItems(it);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function onDescargar() {
    if (!lote) return;
    await run("descargar", () =>
      descargarTxt(lote.id, lote.archivoNombre ?? `novedades-${lote.periodo}.txt`),
    );
  }

  async function onRegenerar() {
    if (!lote) return;
    if (
      !confirm(
        "Vas a REGENERAR el borrador con la foto actual de las novedades pendientes. " +
          "Los items previos se reemplazan. ¿Confirmás?",
      )
    )
      return;
    await run("regenerar", () => generarBorrador(lote.periodo, lote.canal));
  }

  async function onMarcarEnviado() {
    if (!lote) return;
    if (
      !confirm(
        "Vas a marcar el lote como ENVIADO. Las obligaciones referenciadas " +
          "quedarán BLOQUEADAS hasta que llegue el TXT de retorno. ¿Confirmás?",
      )
    )
      return;
    await run("enviar", () => marcarEnviado(lote.id));
  }

  async function onAnular() {
    if (!lote) return;
    const motivo = prompt("Motivo de la anulación (queda auditado):");
    if (!motivo) return;
    await run("anular", () => anularLote(lote.id, motivo));
  }

  const itemsFiltrados = items.filter((it) => {
    if (filtroTipo && it.tipoMovimiento !== filtroTipo) return false;
    if (filtroTexto) {
      const q = filtroTexto.toLowerCase();
      if (
        !it.padron.toLowerCase().includes(q) &&
        !it.afiliado.dni.toLowerCase().includes(q) &&
        !`${it.afiliado.apellido} ${it.afiliado.nombre}`.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  const badge = lote ? ESTADO[lote.estado] : null;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Link
            href="/novedades"
            className="flex size-10 items-center justify-center rounded-xl bg-medical-50 text-medical-600 ring-1 ring-medical-100 hover:bg-medical-100"
            aria-label="Volver"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-medical-600">
              Lote de novedades
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-neutral-900">
              {lote ? `Período ${fmtPeriodo(lote.periodo)}` : "Cargando…"}
            </h1>
            {lote && badge && (
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-neutral-500">
                <span
                  className={`inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${badge.cls}`}
                >
                  {badge.label}
                </span>
                <span>Canal {lote.canal}</span>
                <span>·</span>
                <span>Generado {fmtFechaHora(lote.generadoEn)}</span>
                {lote.enviadoEn && (
                  <>
                    <span>·</span>
                    <span>Enviado {fmtFechaHora(lote.enviadoEn)}</span>
                  </>
                )}
              </div>
            )}
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

      {loading && !lote ? (
        <Skeleton className="h-32 w-full" />
      ) : !lote ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-500">
          Lote no encontrado.
        </div>
      ) : (
        <>
          {/* Totales */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Stat label="Líneas" value={String(lote.totalLineas)} />
            <Stat label="Afiliados" value={String(lote.totalAfiliados)} />
            <Stat label="J17 altas" value={String(lote.totalJ17Altas)} tone="emerald" />
            <Stat label="J17 bajas" value={String(lote.totalJ17Bajas)} tone="rose" />
            <Stat label="K16 total" value={mon(lote.totalK16)} />
          </section>

          {/* Acciones */}
          <section className="flex flex-wrap items-center gap-2 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <Button onClick={onDescargar} disabled={!!busy || !lote.archivoNombre}>
              <Download className="size-4" />
              Descargar .txt
            </Button>
            {lote.estado === "borrador" && (
              <>
                <Button
                  variant="outline"
                  onClick={onRegenerar}
                  disabled={!!busy}
                  title="Reconstruye el borrador con las pendientes actuales"
                >
                  {busy === "regenerar" ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Regenerando…
                    </>
                  ) : (
                    <>
                      <RefreshCw className="size-4" />
                      Regenerar
                    </>
                  )}
                </Button>
                <Button onClick={onMarcarEnviado} disabled={!!busy}>
                  {busy === "enviar" ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Procesando…
                    </>
                  ) : (
                    <>
                      <Send className="size-4" />
                      Marcar como enviado
                    </>
                  )}
                </Button>
              </>
            )}
            {(lote.estado === "borrador" || lote.estado === "enviado") && (
              <Button
                variant="outline"
                onClick={onAnular}
                disabled={!!busy}
                className="border-rose-200 text-rose-700 hover:bg-rose-50"
              >
                <XCircle className="size-4" />
                Anular lote
              </Button>
            )}
            {lote.motivoAnulacion && (
              <div className="ml-auto text-xs text-rose-700">
                Anulado: <span className="italic">{lote.motivoAnulacion}</span>
              </div>
            )}
          </section>

          {lote.estado === "enviado" && (
            <div className="rounded-xl border border-medical-200 bg-medical-50/60 p-4 text-sm text-medical-900">
              <strong>Enviado a descontar.</strong> Las {lote.counts?.obligacionesBloqueadas ?? 0} obligaciones
              referenciadas quedaron bloqueadas y no pueden cobrarse por caja. Se
              desbloquean al procesar el TXT de retorno.
            </div>
          )}

          {/* Items con filtros */}
          <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-neutral-900">Líneas del archivo</h2>
                <p className="text-xs text-neutral-500">
                  Mostrando {itemsFiltrados.length} de {items.length}.
                </p>
              </div>
              <div className="flex gap-2">
                <select
                  value={filtroTipo}
                  onChange={(e) => setFiltroTipo(e.target.value as any)}
                  className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm"
                >
                  <option value="">Todos los tipos</option>
                  <option value="alta">Altas</option>
                  <option value="baja">Bajas</option>
                  <option value="mixto">Mixtos</option>
                  <option value="k16_solo">K16 solo</option>
                </select>
                <input
                  type="text"
                  placeholder="Buscar DNI / padrón / nombre"
                  value={filtroTexto}
                  onChange={(e) => setFiltroTexto(e.target.value)}
                  className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm"
                />
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-neutral-200">
              <div className="max-h-[600px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    <tr>
                      <th className="px-3 py-2">Padrón</th>
                      <th className="px-3 py-2">Afiliado</th>
                      <th className="px-3 py-2">Tipo</th>
                      <th className="px-3 py-2 text-right">J17</th>
                      <th className="px-3 py-2 text-right">J22</th>
                      <th className="px-3 py-2 text-right">J38</th>
                      <th className="px-3 py-2 text-right">K16</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemsFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-3 py-6 text-center text-neutral-500">
                          Sin líneas que coincidan con el filtro.
                        </td>
                      </tr>
                    ) : (
                      itemsFiltrados.map((it) => (
                        <tr key={it.id} className="border-t border-neutral-200 hover:bg-neutral-50">
                          <td className="px-3 py-2 font-mono">{it.padron}</td>
                          <td className="px-3 py-2">
                            <Link
                              href={`/afiliados/${it.afiliadoId}/estado`}
                              className="font-semibold text-medical-700 hover:underline"
                            >
                              {it.afiliado.apellido}, {it.afiliado.nombre}
                            </Link>
                            <div className="text-xs text-neutral-500">DNI {it.afiliado.dni}</div>
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${TIPO_BADGE[it.tipoMovimiento]}`}
                            >
                              {it.tipoMovimiento.replace("_", " ")}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {it.valorJ17 == null ? "—" : it.valorJ17 === 0 ? "BAJA" : mon(it.valorJ17)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {it.valorJ22 == null ? "—" : it.valorJ22 === 0 ? "BAJA" : mon(it.valorJ22)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {it.valorJ38 == null ? "—" : it.valorJ38 === 0 ? "BAJA" : mon(it.valorJ38)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {it.valorK16 == null ? "—" : it.valorK16 === 0 ? "BAJA" : mon(it.valorK16)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "emerald" | "rose";
}) {
  const cls =
    tone === "emerald"
      ? "text-emerald-700"
      : tone === "rose"
      ? "text-rose-700"
      : "text-neutral-900";
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
        {label}
      </div>
      <div className={`mt-1 text-xl font-bold tabular-nums ${cls}`}>{value}</div>
    </div>
  );
}
