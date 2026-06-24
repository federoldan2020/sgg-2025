"use client";

import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  CalendarPlus,
  FlaskConical,
  Play,
  Loader2,
  Info,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { mon, fmtPeriodo, fmtFecha } from "@/utiles/formatos";
import { getErrorMessage } from "@/servicios/api";
import {
  marcarCosegurosIniciales,
  materializarMes,
  type ResultadoMarcadoCoseguros,
  type ResumenMaterializacion,
} from "@/servicios/suspensiones";
import { ShieldCheck, FlaskConical as FlaskIcon } from "lucide-react";

function periodoSiguiente(): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default function MaterializarMesPage() {
  const [periodo, setPeriodo] = useState(periodoSiguiente());
  const [resumen, setResumen] = useState<ResumenMaterializacion | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ejecutar(dryRun: boolean) {
    if (!periodo) return;
    if (!dryRun && !confirm(`Vas a materializar las obligaciones del período ${periodo} en la base. ¿Continuar?`)) return;
    setLoading(true);
    setError(null);
    try {
      const r = await materializarMes(periodo, dryRun);
      setResumen(r);
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
          <CalendarPlus className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            Generar obligaciones del mes
          </h1>
          <p className="text-sm text-neutral-500">
            Genera ex-ante las obligaciones J22 (coseguro), J38 (colaterales) y
            J17 cuota 04 del período indicado. Se ejecuta el último día hábil
            del mes anterior al período objetivo.
          </p>
        </div>
      </header>

      <div className="flex items-start gap-2 rounded-xl border border-medical-200 bg-medical-50/60 p-4 text-sm text-medical-900">
        <Info className="mt-0.5 size-5 shrink-0" />
        <div>
          <strong>Cómo se usa:</strong> seleccioná el período objetivo (mes M).
          Las obligaciones se crean con vencimiento al día 10 del mes M y
          quedan disponibles para pagar por caja desde el primer día. Cuando
          llegue el TXT del mes, se concilia: lo cobrado por nómina cancela la
          obligación. Es idempotente (no duplica si ya existen).
        </div>
      </div>

      <MarcadoCosegurosPanel />


      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 size-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-neutral-900">Período objetivo</h2>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600">
              Período (YYYY-MM)
            </label>
            <input
              type="text"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              placeholder="2026-07"
              pattern="\d{4}-\d{2}"
              className="mt-1 w-32 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-medical-400 focus:outline-none focus:ring-2 focus:ring-medical-500/30"
            />
            <div className="mt-1 text-xs text-neutral-500">
              {fmtPeriodo(periodo)}
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={loading || !/^\d{4}-\d{2}$/.test(periodo)}
            onClick={() => void ejecutar(true)}
          >
            <FlaskConical className="size-4" />
            Simular (dry-run)
          </Button>
          <Button
            type="button"
            disabled={loading || !/^\d{4}-\d{2}$/.test(periodo)}
            onClick={() => void ejecutar(false)}
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Procesando…
              </>
            ) : (
              <>
                <Play className="size-4" />
                Materializar
              </>
            )}
          </Button>
        </div>
      </section>

      {resumen && (
        <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            {resumen.dryRun ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
                <FlaskConical className="size-3.5" />
                Simulación
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="size-3.5" />
                Aplicado
              </span>
            )}
            <h3 className="text-lg font-bold text-neutral-900">
              Período {fmtPeriodo(resumen.periodo)}
            </h3>
            <span className="ml-auto text-xs text-neutral-500">
              Vencimiento {fmtFecha(resumen.vencimiento)}
            </span>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <BloquePanel
              titulo="J22 — Coseguro"
              creadas={resumen.j22.creadas}
              existentes={resumen.j22.yaExistentes}
              sinRegla={resumen.j22.sinReglaVigente}
              total={resumen.j22.montoTotal}
              etiquetaConsiderados="Afiliados con coseguro"
              considerados={resumen.j22.afiliadosConsiderados}
            />
            <BloquePanel
              titulo="J38 — Colaterales"
              creadas={resumen.j38.creadas}
              existentes={resumen.j38.yaExistentes}
              sinRegla={resumen.j38.sinReglaVigente}
              total={resumen.j38.montoTotal}
              etiquetaConsiderados="Afiliados con colaterales"
              considerados={resumen.j38.afiliadosConsiderados}
            />
            <BloquePanel
              titulo="J17 — Cuota 04"
              creadas={resumen.j17_04.creadas}
              existentes={resumen.j17_04.yaExistentes}
              sinRegla={resumen.j17_04.sinParametro}
              total={resumen.j17_04.montoTotal}
              etiquetaConsiderados="Padrones tipo 04"
              considerados={resumen.j17_04.padronesConsiderados}
            />
          </div>

          <div className="mt-6 rounded-xl border border-medical-200 bg-medical-50/40 p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-medical-700">
              Total a cobrar este período
            </div>
            <div className="mt-1 text-3xl font-bold tabular-nums text-medical-900">
              {mon(
                resumen.j22.montoTotal + resumen.j38.montoTotal + resumen.j17_04.montoTotal,
              )}
            </div>
            <div className="mt-1 text-xs text-medical-700/80">
              Suma de obligaciones nuevas. Las "existentes" no se cuentan
              porque ya estaban materializadas en una corrida anterior.
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function MarcadoCosegurosPanel() {
  const [resultado, setResultado] = useState<ResultadoMarcadoCoseguros | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function ejecutar(dryRun: boolean) {
    if (!dryRun && !confirm("Vas a marcar automáticamente como coseguro activo a todos los afiliados que tuvieron J22 cobrado en algún período. ¿Continuar?")) return;
    setLoading(true);
    setError(null);
    try {
      const r = await marcarCosegurosIniciales(dryRun);
      setResultado(r);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-2 text-left"
      >
        <div className="flex items-start gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700 ring-1 ring-amber-200">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-amber-900">
              Setup inicial: marcar afiliados con coseguro vigente
            </h3>
            <p className="mt-0.5 text-xs text-amber-800/90">
              Detecta automáticamente quién tuvo J22 descontado por nómina y
              le activa el coseguro. Correr una vez al inicio. Idempotente.
            </p>
          </div>
        </div>
        <span className="text-xs text-amber-700">{open ? "Ocultar" : "Mostrar"}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-3">
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => void ejecutar(true)}
            >
              <FlaskIcon className="size-4" />
              Simular
            </Button>
            <Button
              size="sm"
              disabled={loading}
              onClick={() => void ejecutar(false)}
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Procesando…
                </>
              ) : (
                <>
                  <ShieldCheck className="size-4" />
                  Marcar coseguros vigentes
                </>
              )}
            </Button>
          </div>

          {resultado && (
            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Resultado {resultado.dryRun ? "(simulación)" : ""}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <div className="text-xs text-neutral-600">Detectados con J22</div>
                  <div className="text-xl font-bold tabular-nums">
                    {resultado.afiliadosConJ22}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-neutral-600">Ya activos</div>
                  <div className="text-xl font-bold tabular-nums text-neutral-700">
                    {resultado.yaActivos}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-neutral-600">Reactivados</div>
                  <div className="text-xl font-bold tabular-nums text-emerald-700">
                    {resultado.reactivados}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-neutral-600">Nuevos altas</div>
                  <div className="text-xl font-bold tabular-nums text-emerald-700">
                    {resultado.nuevosActivos}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function BloquePanel({
  titulo,
  creadas,
  existentes,
  sinRegla,
  total,
  etiquetaConsiderados,
  considerados,
}: {
  titulo: string;
  creadas: number;
  existentes: number;
  sinRegla: number;
  total: number;
  etiquetaConsiderados: string;
  considerados: number;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-4">
      <h4 className="text-sm font-semibold text-neutral-900">{titulo}</h4>
      <div className="mt-3 space-y-2 text-sm">
        <Row label={etiquetaConsiderados} value={String(considerados)} />
        <Row label="Creadas" value={String(creadas)} tone="emerald" />
        <Row label="Ya existían" value={String(existentes)} tone="neutral" />
        <Row label="Sin regla / parámetro" value={String(sinRegla)} tone={sinRegla > 0 ? "amber" : "neutral"} />
        <div className="mt-3 border-t border-neutral-200 pt-2">
          <Row label="Monto total nuevo" value={mon(total)} bold />
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  tone,
  bold,
}: {
  label: string;
  value: string;
  tone?: "emerald" | "amber" | "neutral";
  bold?: boolean;
}) {
  const cls = tone === "emerald"
    ? "text-emerald-700"
    : tone === "amber"
    ? "text-amber-700"
    : "text-neutral-900";
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-neutral-600">{label}</span>
      <span className={`tabular-nums ${bold ? "font-bold" : "font-medium"} ${cls}`}>
        {value}
      </span>
    </div>
  );
}
