"use client";

import { useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileUp,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Upload,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { mon, fmtPeriodo } from "@/utiles/formatos";
import { getErrorMessage } from "@/servicios/api";
import {
  confirmarCobranzaAnses,
  previewCobranzaAnses,
  type ConfirmacionCobranzaAnses,
  type PreviewCobranzaAnses,
} from "@/servicios/nomina";

export default function ImportarCobranzaAnsesPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewCobranzaAnses | null>(null);
  const [confirmacion, setConfirmacion] = useState<ConfirmacionCobranzaAnses | null>(null);
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
      const r = await previewCobranzaAnses(f);
      setPreview(r);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function onConfirmar() {
    if (!file || !preview?.ok) return;
    if (
      !confirm(
        `Confirmar importación de ${preview.resumen.beneficiosEncontrados} beneficios del período ${fmtPeriodo(
          preview.periodo,
        )}? Monto total: ${mon(preview.resumen.montoTotalJ17)}.`,
      )
    )
      return;
    setLoading(true);
    setError(null);
    try {
      const r = await confirmarCobranzaAnses(file);
      setConfirmacion(r);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <header className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-medical-50 text-medical-600 ring-1 ring-medical-100">
          <FileUp className="size-5" />
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-medical-600">
            Nómina · ANSES
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-neutral-900">
            Importar cobranza UDAME (jubilados)
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Subí el archivo UDAME mensual de ANSES. Match por número de beneficio,
            solo J17.
          </p>
        </div>
      </header>

      {/* Dropzone */}
      {!confirmacion ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files[0] ?? null;
            if (f) onSelectFile(f);
          }}
          className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center transition ${
            dragOver
              ? "border-medical-500 bg-medical-50/60"
              : "border-neutral-300 bg-white"
          }`}
        >
          <Upload className="mb-3 size-8 text-neutral-400" />
          <p className="text-sm text-neutral-600">
            Arrastrá el archivo UDAME (UDAMExxx.TXT) o
          </p>
          <Button
            variant="outline"
            className="mt-3"
            onClick={() => inputRef.current?.click()}
            disabled={loading}
          >
            <FileUp className="size-4" />
            Seleccionar archivo
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".txt,.TXT"
            className="hidden"
            onChange={(e) => onSelectFile(e.target.files?.[0] ?? null)}
          />
          {file && (
            <p className="mt-3 text-xs text-neutral-500">
              {file.name} ({(file.size / 1024).toFixed(1)} KB)
            </p>
          )}
        </div>
      ) : null}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-neutral-600">
          <Loader2 className="size-4 animate-spin" />
          Procesando…
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <AlertCircle className="mt-0.5 size-5 shrink-0" />
          <div>{error}</div>
        </div>
      )}

      {/* Preview */}
      {preview && !confirmacion && (
        <section className="space-y-4">
          <div className="grid gap-3 md:grid-cols-5">
            <Stat label="Período" value={fmtPeriodo(preview.periodo)} />
            <Stat label="Líneas TXT" value={String(preview.resumen.totalLineas)} />
            <Stat
              label="Beneficios encontrados"
              value={String(preview.resumen.beneficiosEncontrados)}
            />
            <Stat
              label="Faltantes"
              value={String(preview.resumen.beneficiosFaltantes)}
              tone={preview.resumen.beneficiosFaltantes > 0 ? "rose" : "ok"}
            />
            <Stat
              label="Monto total J17"
              value={mon(preview.resumen.montoTotalJ17)}
              tone="medical"
            />
          </div>

          {preview.warnings.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <div className="mb-1 font-semibold">
                Advertencias del parser ({preview.warnings.length})
              </div>
              <ul className="ml-5 list-disc">
                {preview.warnings.slice(0, 5).map((w, i) => (
                  <li key={i}>
                    Línea {w.linea}: {w.mensaje}
                  </li>
                ))}
                {preview.warnings.length > 5 && (
                  <li>… y {preview.warnings.length - 5} más</li>
                )}
              </ul>
            </div>
          )}

          {preview.beneficiosFaltantes.length > 0 && (
            <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-rose-900">
                <XCircle className="size-4" />
                {preview.beneficiosFaltantes.length} beneficios sin matchear
              </div>
              <p className="mb-3 text-xs text-rose-800">
                Cargá el <code className="rounded bg-white px-1">numeroBeneficio</code>
                {" "}en el padrón correspondiente antes de reintentar.
              </p>
              <div className="max-h-64 overflow-auto rounded border border-rose-200 bg-white">
                <table className="w-full text-xs">
                  <thead className="bg-rose-100 text-rose-900">
                    <tr>
                      <th className="px-3 py-2 text-left">Beneficio</th>
                      <th className="px-3 py-2 text-left">Apellido y nombre</th>
                      <th className="px-3 py-2 text-left">DNI</th>
                      <th className="px-3 py-2 text-left">CUIT</th>
                      <th className="px-3 py-2 text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.beneficiosFaltantes.map((b) => (
                      <tr key={b.beneficio} className="border-t">
                        <td className="px-3 py-1 font-mono">{b.beneficio}</td>
                        <td className="px-3 py-1">{b.apellidoNombre}</td>
                        <td className="px-3 py-1 font-mono">{b.dni}</td>
                        <td className="px-3 py-1 font-mono">{b.cuit}</td>
                        <td className="px-3 py-1 text-right font-mono">
                          {mon(b.monto)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {preview.erroresParseo.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <div className="mb-1 font-semibold">
                Errores de parseo ({preview.erroresParseo.length})
              </div>
              <ul className="ml-5 list-disc">
                {preview.erroresParseo.slice(0, 5).map((e, i) => (
                  <li key={i}>
                    Línea {e.linea}: {e.motivo}
                  </li>
                ))}
                {preview.erroresParseo.length > 5 && (
                  <li>… y {preview.erroresParseo.length - 5} más</li>
                )}
              </ul>
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={onConfirmar} disabled={!preview.ok || loading}>
              <CheckCircle2 className="size-4" />
              Confirmar importación
            </Button>
            <Button variant="ghost" onClick={reset}>
              <RotateCcw className="size-4" />
              Cancelar
            </Button>
          </div>
        </section>
      )}

      {/* Confirmación */}
      {confirmacion && (
        <section className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <ShieldCheck className="mt-1 size-5 text-emerald-700" />
            <div>
              <div className="text-sm font-semibold text-emerald-900">
                Importación confirmada
              </div>
              <div className="text-xs text-emerald-800">
                Lote {confirmacion.loteId} · Período{" "}
                {fmtPeriodo(confirmacion.periodo)}
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <Stat
              label="Beneficios aplicados"
              value={String(confirmacion.beneficiosAplicados)}
            />
            <Stat
              label="Afiliados tocados"
              value={String(confirmacion.afiliadosTocados)}
            />
            <Stat label="Monto total" value={mon(confirmacion.montoTotal)} tone="medical" />
            <Stat
              label="Rehabilitados"
              value={String(confirmacion.rehabilitados.length)}
              tone={confirmacion.rehabilitados.length > 0 ? "ok" : undefined}
            />
          </div>

          {confirmacion.rehabilitados.length > 0 && (
            <div className="rounded-xl border bg-white p-3 text-xs">
              <div className="mb-2 font-semibold text-emerald-700">
                Afiliados rehabilitados ({confirmacion.rehabilitados.length})
              </div>
              <ul className="max-h-48 list-disc overflow-auto pl-5">
                {confirmacion.rehabilitados.map((r) => (
                  <li key={r.afiliadoId}>
                    DNI {r.dni} — {r.apellidoNombre}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Button variant="outline" onClick={reset}>
            <RotateCcw className="size-4" />
            Cargar otro archivo
          </Button>
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
  tone?: "ok" | "rose" | "medical";
}) {
  const toneCls =
    tone === "rose"
      ? "border-rose-200 bg-rose-50 text-rose-900"
      : tone === "ok"
        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
        : tone === "medical"
          ? "border-medical-200 bg-medical-50 text-medical-900"
          : "border-neutral-200 bg-white text-neutral-900";
  return (
    <div className={`rounded-2xl border p-3 ${toneCls}`}>
      <div className="text-xs uppercase tracking-wider opacity-70">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}
