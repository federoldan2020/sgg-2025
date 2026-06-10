"use client";

import { useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileUp,
  Upload,
  XCircle,
  RotateCcw,
  Loader2,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { mon, fmtPeriodo } from "@/utiles/formatos";
import { getErrorMessage } from "@/servicios/api";
import {
  confirmarCobranza,
  previewCobranza,
  type ConfirmacionCobranza,
  type PreviewCobranza,
} from "@/servicios/nomina";

export default function ImportarCobranzaPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewCobranza | null>(null);
  const [confirmacion, setConfirmacion] = useState<ConfirmacionCobranza | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setFile(null);
    setPreview(null);
    setConfirmacion(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function onSelectFile(f: File | null) {
    setError(null);
    setPreview(null);
    setConfirmacion(null);
    setFile(f);
    if (!f) return;
    setLoading(true);
    try {
      const r = await previewCobranza(f);
      setPreview(r);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function onConfirmar() {
    if (!file || !preview?.ok) return;
    if (!confirm(`Confirmar importación de ${preview.resumen.padronesEncontrados} padrones del período ${preview.periodo}?`)) return;
    setLoading(true);
    setError(null);
    try {
      const r = await confirmarCobranza(file);
      setConfirmacion(r);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-medical-50 text-medical-600 ring-1 ring-medical-100">
          <FileUp className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            Importar cobranza Cómputos
          </h1>
          <p className="text-sm text-neutral-500">
            TXT de retorno con los descuentos efectivos del período. Actualiza padrones, recalcula cobertura y rehabilita automáticamente a quienes saldaron.
          </p>
        </div>
      </header>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 size-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Resultado de confirmación */}
      {confirmacion && (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-emerald-600" />
            <div className="flex-1">
              <h2 className="text-base font-semibold text-emerald-900">
                Cobranza aplicada — {fmtPeriodo(confirmacion.periodo)}
              </h2>
              <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Stat label="Lote" value={`#${confirmacion.loteId}`} />
                <Stat label="Padrones actualizados" value={String(confirmacion.padronesActualizados)} />
                <Stat label="Afiliados tocados" value={String(confirmacion.afiliadosTocados)} />
              </div>
              {confirmacion.rehabilitados.length > 0 && (
                <div className="mt-4 rounded-lg border border-emerald-300 bg-white p-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                    <ShieldCheck className="size-4" />
                    {confirmacion.rehabilitados.length} afiliados rehabilitados automáticamente
                  </div>
                  <ul className="mt-2 max-h-48 overflow-y-auto text-xs text-neutral-700">
                    {confirmacion.rehabilitados.slice(0, 50).map((r) => (
                      <li key={r.afiliadoId} className="py-0.5">
                        DNI {r.dni} · {r.apellidoNombre || "—"}
                      </li>
                    ))}
                    {confirmacion.rehabilitados.length > 50 && (
                      <li className="py-0.5 text-neutral-500">
                        … y {confirmacion.rehabilitados.length - 50} más
                      </li>
                    )}
                  </ul>
                </div>
              )}
              <Button className="mt-4" variant="outline" onClick={reset}>
                <RotateCcw className="size-4" />
                Cargar otro archivo
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Dropzone (sólo si no hay confirmación) */}
      {!confirmacion && (
        <section
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files[0];
            if (f) void onSelectFile(f);
          }}
          className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center transition ${
            dragOver
              ? "border-medical-500 bg-medical-50"
              : "border-neutral-300 bg-white"
          }`}
        >
          <Upload className="size-10 text-neutral-400" />
          <h3 className="mt-3 text-base font-semibold text-neutral-900">
            Arrastrá el TXT acá o seleccionalo
          </h3>
          <p className="mt-1 text-sm text-neutral-500">
            Formato Cómputos San Juan (45 chars de header + bloques de 12).
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".txt,.dat,text/plain"
            className="hidden"
            onChange={(e) => onSelectFile(e.target.files?.[0] ?? null)}
          />
          <Button
            className="mt-4"
            onClick={() => inputRef.current?.click()}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Procesando…
              </>
            ) : (
              <>
                <FileUp className="size-4" />
                Elegir archivo
              </>
            )}
          </Button>
          {file && !preview && !loading && (
            <div className="mt-3 text-xs text-neutral-500">
              {file.name} ({Math.round(file.size / 1024)} KB)
            </div>
          )}
        </section>
      )}

      {/* Preview */}
      {preview && !confirmacion && (
        <section className="space-y-4">
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-medical-600">
                  Vista previa
                </div>
                <h2 className="mt-1 text-xl font-bold text-neutral-900">
                  Período {fmtPeriodo(preview.periodo)}
                </h2>
                <div className="mt-1 text-sm text-neutral-500">
                  {file?.name} · hash {preview.hash.slice(0, 12)}…
                </div>
              </div>
              {preview.ok ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="size-3.5" />
                  Listo para importar
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                  <XCircle className="size-3.5" />
                  Bloqueado
                </span>
              )}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Líneas" value={String(preview.resumen.totalLineas)} />
              <Stat label="Padrones en TXT" value={String(preview.resumen.padronesEnTxt)} />
              <Stat
                label="Encontrados en BD"
                value={String(preview.resumen.padronesEncontrados)}
                tone="emerald"
              />
              <Stat
                label="Faltantes"
                value={String(preview.resumen.padronesFaltantes)}
                tone={preview.resumen.padronesFaltantes > 0 ? "rose" : "emerald"}
              />
              <Stat
                label="Afiliados afectados"
                value={String(preview.resumen.afiliadosAfectados)}
              />
              {Object.entries(preview.resumen.cobranzasPorCodigo).map(([cod, total]) => (
                <Stat key={cod} label={`Total ${cod}`} value={mon(total)} tone="emerald" />
              ))}
            </div>

            {preview.erroresParseo.length > 0 && (
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                  <AlertCircle className="size-4" />
                  {preview.erroresParseo.length} líneas con errores de parseo
                </div>
                <ul className="mt-2 max-h-32 overflow-y-auto text-xs text-amber-700">
                  {preview.erroresParseo.slice(0, 50).map((e) => (
                    <li key={e.linea}>Línea {e.linea}: {e.motivo}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-2">
              <Button
                onClick={onConfirmar}
                disabled={!preview.ok || loading}
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Aplicando…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-4" />
                    Confirmar importación
                  </>
                )}
              </Button>
              <Button variant="ghost" onClick={reset} disabled={loading}>
                Cancelar y empezar de nuevo
              </Button>
            </div>
          </div>

          {/* Padrones faltantes (bloqueante) */}
          {preview.padronesFaltantes.length > 0 && (
            <div className="rounded-2xl border border-rose-200 bg-white p-6 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-base font-semibold text-rose-700">
                <XCircle className="size-5" />
                {preview.padronesFaltantes.length} padrones del TXT no están en la base
              </div>
              <p className="text-sm text-neutral-600">
                No se puede confirmar la importación hasta que estos padrones estén cargados,
                porque la cobranza quedaría huérfana. Cargá los padrones faltantes y volvé a
                subir el archivo.
              </p>
              <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    <tr>
                      <th className="px-3 py-2">Padrón</th>
                      <th className="px-3 py-2">Centro</th>
                      <th className="px-3 py-2">DNI</th>
                      <th className="px-3 py-2">Apellido y nombre</th>
                      <th className="px-3 py-2 text-right">J17</th>
                      <th className="px-3 py-2 text-right">J22</th>
                      <th className="px-3 py-2 text-right">J38</th>
                      <th className="px-3 py-2 text-right">K16</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.padronesFaltantes.slice(0, 200).map((p) => (
                      <tr key={`${p.padron}-${p.dni}`} className="border-t border-neutral-200">
                        <td className="px-3 py-2 font-mono">{p.padron}</td>
                        <td className="px-3 py-2 font-mono">{p.centro}</td>
                        <td className="px-3 py-2 font-mono">{p.dni}</td>
                        <td className="px-3 py-2">{p.apellidoNombre}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {p.cobranzas.J17 ? mon(p.cobranzas.J17) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {p.cobranzas.J22 ? mon(p.cobranzas.J22) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {p.cobranzas.J38 ? mon(p.cobranzas.J38) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {p.cobranzas.K16 ? mon(p.cobranzas.K16) : "—"}
                        </td>
                      </tr>
                    ))}
                    {preview.padronesFaltantes.length > 200 && (
                      <tr>
                        <td colSpan={8} className="px-3 py-3 text-center text-xs text-neutral-500">
                          … y {preview.padronesFaltantes.length - 200} más
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
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
    <div className="rounded-xl border border-neutral-200 bg-white p-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
        {label}
      </div>
      <div className={`mt-1 text-lg font-bold tabular-nums ${cls}`}>{value}</div>
    </div>
  );
}
