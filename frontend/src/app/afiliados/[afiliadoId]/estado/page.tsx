"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Plus,
  RefreshCw,
  ShieldOff,
  ShieldCheck,
  Trash2,
  Undo2,
  XCircle,
  TimerReset,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CupoPanel } from "@/components/afiliados/CupoPanel";
import { mon } from "@/utiles/formatos";
import { getErrorMessage } from "@/servicios/api";
import { useAfiliadoDetalle } from "@/contexts/afiliadoDetalle";
import {
  crearExcepcion,
  desactivarExcepcion,
  historialCobertura,
  historialSuspensiones,
  listarExcepciones,
  obligacionesPendientes,
  recalcularCobertura,
  rehabilitarAfiliado,
  revertirSuspension,
  suspenderAfiliado,
  type Cobertura,
  type Excepcion,
  type ObligacionPendiente,
  type Suspension,
} from "@/servicios/suspensiones";

function periodoActual(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function periodoAnterior(): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function fmtFecha(s: string | null | undefined) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("es-AR");
}

function fmtFechaHora(s: string | null | undefined) {
  if (!s) return "—";
  return new Date(s).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtPeriodo(periodo: string) {
  const [y, m] = periodo.split("-");
  const meses = [
    "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
  ];
  return `${meses[Number(m) - 1] ?? m} ${y}`;
}

const ESTADO_SUSPENSION: Record<
  Suspension["estado"],
  { label: string; cls: string }
> = {
  provisoria: { label: "Provisoria", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  firme: { label: "Firme", cls: "bg-rose-100 text-rose-700 border-rose-200" },
  rehabilitada: {
    label: "Rehabilitada",
    cls: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  revertida: {
    label: "Revertida",
    cls: "bg-slate-100 text-slate-700 border-slate-200",
  },
};

export default function AfiliadoEstadoPage() {
  const { afiliadoId, afiliado, refetch: refetchAfiliado } = useAfiliadoDetalle();

  const [coberturas, setCoberturas] = useState<Cobertura[]>([]);
  const [suspensiones, setSuspensiones] = useState<Suspension[]>([]);
  const [excepciones, setExcepciones] = useState<Excepcion[]>([]);
  const [obligaciones, setObligaciones] = useState<ObligacionPendiente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [recalcOpen, setRecalcOpen] = useState(false);
  const [excepcionOpen, setExcepcionOpen] = useState(false);

  const cargar = useCallback(async () => {
    if (!afiliadoId) return;
    setLoading(true);
    setError(null);
    try {
      const [hc, hs, ex, obl] = await Promise.all([
        historialCobertura(afiliadoId, 6),
        historialSuspensiones(afiliadoId),
        listarExcepciones(afiliadoId),
        obligacionesPendientes(afiliadoId).catch(() => [] as ObligacionPendiente[]),
      ]);
      setCoberturas(hc);
      setSuspensiones(hs);
      setExcepciones(ex);
      setObligaciones(obl);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [afiliadoId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    setError(null);
    try {
      await fn();
      await Promise.all([cargar(), refetchAfiliado()]);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function onRecalcular(periodo: string) {
    await run("recalc", () => recalcularCobertura(afiliadoId, periodo));
    setRecalcOpen(false);
  }

  async function onSuspender() {
    const periodo = prompt(
      "Período origen de la mora (YYYY-MM):",
      periodoAnterior(),
    );
    if (!periodo || !/^\d{4}-\d{2}$/.test(periodo)) return;
    const obs = prompt("Observación (opcional):") ?? undefined;
    await run("suspender", () => suspenderAfiliado(afiliadoId, periodo, obs));
  }

  async function onRehabilitar() {
    if (!confirm("Rehabilitar al afiliado? Requiere que la deuda de los períodos en mora esté saldada.")) return;
    await run("rehabilitar", () => rehabilitarAfiliado(afiliadoId, "manual"));
  }

  async function onRevertir() {
    const motivo = prompt("Motivo de la reversión (queda auditado):");
    if (!motivo) return;
    await run("revertir", () => revertirSuspension(afiliadoId, motivo));
  }

  async function onCrearExcepcion(motivo: string, vigenciaHasta?: string) {
    await run("crear-excepcion", () => crearExcepcion(afiliadoId, motivo, vigenciaHasta));
    setExcepcionOpen(false);
  }

  async function onDesactivarExcepcion(id: string) {
    if (!confirm("Desactivar esta excepción?")) return;
    await run(`desact-${id}`, () => desactivarExcepcion(afiliadoId, id));
  }

  const estado = afiliado?.estado ?? "activo";
  const estaSuspendido =
    estado === "suspendido_provisorio" || estado === "suspendido_firme";

  const suspensionActiva = suspensiones.find((s) => s.fechaFin === null);
  const excepcionActiva = excepciones.find((e) => e.activa);

  // Ordenar coberturas ascendente para semáforo (período más viejo a la izquierda).
  const coberturasOrdenadas = [...coberturas].sort((a, b) =>
    a.periodo.localeCompare(b.periodo),
  );

  // Estado por concepto basado en el último período evaluado + deudas históricas.
  const ultimaCobertura = coberturasOrdenadas[coberturasOrdenadas.length - 1];
  const j17Cubierto = ultimaCobertura?.j17Cubierto ?? false;
  const j22Cubierto = ultimaCobertura?.j22Cubierto ?? true;
  const j38Cubierto = ultimaCobertura?.j38Cubierto ?? true;

  // Deudas históricas abiertas (cualquier período).
  const tieneDeudaJ22 = obligaciones.some((o) =>
    /J22|coseguro/i.test(o.concepto),
  );
  const tieneDeudaJ38 = obligaciones.some((o) =>
    /J38|colaterales/i.test(o.concepto),
  );

  // Conjunto final por capa.
  const afiliadoActivo = estado === "activo" || estado === "baja"; // baja no es suspendido
  const coseguroHabilitado = afiliadoActivo && j22Cubierto && !tieneDeudaJ22;
  const colateralesHabilitado = coseguroHabilitado && j38Cubierto && !tieneDeudaJ38;

  const deudaTotalObligaciones = obligaciones.reduce(
    (acc, o) => acc + Number(o.saldo || 0),
    0,
  );

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 size-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Acciones rápidas */}
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-medical-50 text-medical-600 ring-1 ring-medical-100">
            <Activity className="size-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-neutral-900">
              Estado y cobertura
            </div>
            <div className="text-xs text-neutral-500">
              Mora del afiliado, suspensiones y excepciones ADMIN.
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void cargar()}
            disabled={!!busy || loading}
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setRecalcOpen((v) => !v)}
            disabled={!!busy}
          >
            <TimerReset className="size-4" />
            Recalcular período
          </Button>

          {estaSuspendido ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={onRevertir}
                disabled={!!busy}
              >
                <Undo2 className="size-4" />
                Revertir suspensión
              </Button>
              <Button size="sm" onClick={onRehabilitar} disabled={!!busy}>
                <ShieldCheck className="size-4" />
                Rehabilitar
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={onSuspender}
              disabled={!!busy}
              className="border-rose-200 text-rose-700 hover:bg-rose-50"
            >
              <ShieldOff className="size-4" />
              Suspender manual
            </Button>
          )}
        </div>
      </section>

      {recalcOpen && (
        <RecalcInline
          onRun={onRecalcular}
          onClose={() => setRecalcOpen(false)}
          busy={busy === "recalc"}
        />
      )}

      {/* 3 Semáforos por capa de estado */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SemaforoCapa
          titulo="Afiliado (J17)"
          subtitulo="Cuota societaria"
          habilitado={afiliadoActivo}
          mesCubierto={j17Cubierto}
          tieneDeudaHistorica={false /* el estado del afiliado se materializa en Afiliado.estado */}
          hint={
            afiliadoActivo
              ? "Acceso a servicios sociales, comercios y órdenes de crédito."
              : "Suspendido o de baja. No accede a ningún servicio."
          }
        />
        <SemaforoCapa
          titulo="Coseguro (J22)"
          subtitulo="Salud del titular"
          habilitado={coseguroHabilitado}
          mesCubierto={j22Cubierto}
          tieneDeudaHistorica={tieneDeudaJ22}
          hint={
            coseguroHabilitado
              ? "Puede usar coseguro y solicitar reintegros."
              : tieneDeudaJ22
              ? "Hay deuda J22 abierta de períodos anteriores."
              : !j22Cubierto
              ? "J22 del mes corriente sin cobrar."
              : "Depende del estado del afiliado."
          }
        />
        <SemaforoCapa
          titulo="Colaterales (J38)"
          subtitulo="Salud familiares"
          habilitado={colateralesHabilitado}
          mesCubierto={j38Cubierto}
          tieneDeudaHistorica={tieneDeudaJ38}
          hint={
            colateralesHabilitado
              ? "Familiares con cobertura habilitada."
              : tieneDeudaJ38
              ? "Hay deuda J38 abierta de períodos anteriores."
              : !j38Cubierto
              ? "J38 del mes corriente sin cobrar."
              : "Depende del estado del coseguro."
          }
        />
      </section>

      {/* Cupo de crédito */}
      <CupoPanel afiliadoId={String(afiliadoId)} />

      {/* Resumen rápido */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Obligaciones abiertas"
          value={String(obligaciones.length)}
          tone={obligaciones.length > 0 ? "amber" : "emerald"}
        />
        <KpiCard
          label="Deuda total exigible"
          value={mon(deudaTotalObligaciones)}
          tone={deudaTotalObligaciones > 0 ? "rose" : "emerald"}
        />
        <KpiCard
          label="Suspensión activa"
          value={suspensionActiva ? "Sí" : "No"}
          tone={suspensionActiva ? "rose" : "emerald"}
        />
      </section>

      {/* Semáforo de cobertura */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-base font-semibold text-neutral-900">
            Cobertura últimos 6 períodos
          </div>
          <div className="text-xs text-neutral-500">
            Cada celda muestra si el período quedó cubierto y la deuda generada.
          </div>
        </div>
        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : coberturasOrdenadas.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-200 p-6 text-center text-sm text-neutral-500">
            Aún no se calculó cobertura para este afiliado.
            <div className="mt-2 text-xs">
              Usá "Recalcular período" arriba para generar la primera.
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {coberturasOrdenadas.map((c) => (
              <SemaforoCard key={c.periodo} cob={c} />
            ))}
          </div>
        )}
      </section>

      {/* Obligaciones abiertas */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-base font-semibold text-neutral-900">
              Obligaciones abiertas
            </div>
            <div className="text-xs text-neutral-500">
              Deuda exigible. Se cobra por caja, débito automático o por
              nómina (descuento del mes siguiente).
            </div>
          </div>
          {obligaciones.length > 0 && (
            <a
              href={`/caja?afiliadoId=${afiliadoId}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-medical-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-medical-700"
            >
              Cobrar por caja
            </a>
          )}
        </div>
        <div className="overflow-hidden rounded-xl border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="px-4 py-2">Período</th>
                <th className="px-4 py-2">Concepto</th>
                <th className="px-4 py-2">Padrón</th>
                <th className="px-4 py-2">Tipo</th>
                <th className="px-4 py-2 text-right">Monto</th>
                <th className="px-4 py-2 text-right">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td></tr>
              ) : obligaciones.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-neutral-500">Sin obligaciones abiertas.</td></tr>
              ) : (
                obligaciones.map((o) => (
                  <tr key={o.id} className="border-t border-neutral-200 hover:bg-neutral-50">
                    <td className="px-4 py-2 font-mono">{o.periodo}</td>
                    <td className="px-4 py-2">{o.concepto}</td>
                    <td className="px-4 py-2 font-mono text-xs text-neutral-600">{o.padronLabel}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${
                        o.tipo === "cuota"
                          ? "border-violet-200 bg-violet-50 text-violet-700"
                          : "border-indigo-200 bg-indigo-50 text-indigo-700"
                      }`}>
                        {o.tipo === "cuota" ? "Cuota préstamo" : "Obligación"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-neutral-600">{mon(o.monto)}</td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums text-rose-700">{mon(o.saldo)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {obligaciones.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-neutral-300 bg-neutral-50">
                  <td colSpan={5} className="px-4 py-2 text-right text-xs font-semibold uppercase text-neutral-600">
                    Total exigible
                  </td>
                  <td className="px-4 py-2 text-right text-base font-bold tabular-nums text-rose-700">
                    {mon(deudaTotalObligaciones)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      {/* Historial de suspensiones */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="mb-3 text-base font-semibold text-neutral-900">
          Historial de suspensiones
        </div>
        <div className="overflow-hidden rounded-xl border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="px-4 py-2">Período origen</th>
                <th className="px-4 py-2">Estado</th>
                <th className="px-4 py-2">Inicio</th>
                <th className="px-4 py-2">Firme</th>
                <th className="px-4 py-2">Fin</th>
                <th className="px-4 py-2">Motivo fin</th>
                <th className="px-4 py-2">Observación</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td></tr>
              ) : suspensiones.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-neutral-500">Sin suspensiones registradas.</td></tr>
              ) : (
                suspensiones.map((s) => {
                  const badge = ESTADO_SUSPENSION[s.estado];
                  return (
                    <tr key={s.id} className="border-t border-neutral-200">
                      <td className="px-4 py-2 font-mono">{s.periodoOrigen}</td>
                      <td className="px-4 py-2">
                        <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-neutral-600">{fmtFechaHora(s.fechaInicio)}</td>
                      <td className="px-4 py-2 text-neutral-600">{fmtFechaHora(s.fechaFirme)}</td>
                      <td className="px-4 py-2 text-neutral-600">{fmtFechaHora(s.fechaFin)}</td>
                      <td className="px-4 py-2 text-neutral-600">{s.motivoFin?.replace(/_/g, " ") ?? "—"}</td>
                      <td className="px-4 py-2 text-neutral-600">{s.observacion ?? "—"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Excepciones ADMIN */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-base font-semibold text-neutral-900">
              Excepciones de suspensión
            </div>
            <div className="text-xs text-neutral-500">
              Sólo ADMIN/SUPERADMIN. Mientras haya una excepción activa el cierre mensual no suspende a este afiliado.
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setExcepcionOpen(true)}
            disabled={!!busy}
          >
            <Plus className="size-4" />
            Nueva excepción
          </Button>
        </div>

        {excepcionActiva && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <ShieldOff className="mt-0.5 size-4 shrink-0" />
            <div>
              <div className="font-semibold">Excepción activa: {excepcionActiva.motivo}</div>
              <div className="text-xs">
                Vigente hasta {excepcionActiva.vigenciaHasta ? fmtFecha(excepcionActiva.vigenciaHasta) : "indefinida"}.
              </div>
            </div>
          </div>
        )}

        {excepcionOpen && (
          <ExcepcionInline
            onCancel={() => setExcepcionOpen(false)}
            onConfirm={onCrearExcepcion}
            busy={busy === "crear-excepcion"}
          />
        )}

        <div className="overflow-hidden rounded-xl border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="px-4 py-2">Motivo</th>
                <th className="px-4 py-2">Vigencia hasta</th>
                <th className="px-4 py-2">Creada</th>
                <th className="px-4 py-2">Estado</th>
                <th className="px-4 py-2 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td></tr>
              ) : excepciones.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-neutral-500">Sin excepciones registradas.</td></tr>
              ) : (
                excepciones.map((e) => (
                  <tr key={e.id} className="border-t border-neutral-200">
                    <td className="px-4 py-2">{e.motivo}</td>
                    <td className="px-4 py-2 tabular-nums">{fmtFecha(e.vigenciaHasta)}</td>
                    <td className="px-4 py-2 text-neutral-600">{fmtFechaHora(e.creadoEn)}</td>
                    <td className="px-4 py-2">
                      {e.activa ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                          <CheckCircle2 className="size-3" /> Activa
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-600">
                          <XCircle className="size-3" /> Inactiva
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {e.activa && (
                        <button
                          type="button"
                          onClick={() => void onDesactivarExcepcion(e.id)}
                          disabled={busy === `desact-${e.id}`}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="size-3.5" />
                          Desactivar
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function SemaforoCapa({
  titulo,
  subtitulo,
  habilitado,
  mesCubierto,
  tieneDeudaHistorica,
  hint,
}: {
  titulo: string;
  subtitulo: string;
  habilitado: boolean;
  mesCubierto: boolean;
  tieneDeudaHistorica: boolean;
  hint: string;
}) {
  const cls = habilitado
    ? "border-emerald-200 bg-emerald-50"
    : "border-rose-200 bg-rose-50";
  const txt = habilitado ? "text-emerald-800" : "text-rose-800";
  const Icon = habilitado ? CheckCircle2 : XCircle;
  return (
    <div className={`rounded-2xl border ${cls} p-4 shadow-sm`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className={`text-xs font-semibold uppercase tracking-wider ${txt}`}>
            {titulo}
          </div>
          <div className="text-xs text-neutral-600">{subtitulo}</div>
        </div>
        <Icon className={`size-6 ${habilitado ? "text-emerald-600" : "text-rose-600"}`} />
      </div>

      <div className={`mt-3 text-2xl font-bold ${txt}`}>
        {habilitado ? "Habilitado" : "Bloqueado"}
      </div>

      <div className="mt-2 space-y-1 text-xs">
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-block size-2 rounded-full ${
              mesCubierto ? "bg-emerald-500" : "bg-rose-500"
            }`}
          />
          <span className="text-neutral-700">
            Mes corriente: {mesCubierto ? "cubierto" : "sin cubrir"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-block size-2 rounded-full ${
              tieneDeudaHistorica ? "bg-rose-500" : "bg-emerald-500"
            }`}
          />
          <span className="text-neutral-700">
            Deuda histórica: {tieneDeudaHistorica ? "sí" : "ninguna"}
          </span>
        </div>
      </div>

      <div className="mt-3 border-t border-neutral-200/60 pt-2 text-xs text-neutral-600">
        {hint}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "rose" | "amber" | "emerald";
}) {
  const toneClass: Record<typeof tone, string> = {
    rose: "text-rose-700",
    amber: "text-amber-700",
    emerald: "text-emerald-700",
  };
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
        {label}
      </div>
      <div className={`mt-2 text-2xl font-bold tabular-nums ${toneClass[tone]}`}>
        {value}
      </div>
    </div>
  );
}

function SemaforoCard({ cob }: { cob: Cobertura }) {
  const j17 = cob.j17Cubierto ?? cob.j17Cobrado >= cob.j17Esperado;
  const j22 = cob.j22Cubierto ?? (cob.j22Esperado === 0 || cob.j22Cobrado >= cob.j22Esperado);
  const j38 = cob.j38Cubierto ?? (cob.j38Esperado === 0 || cob.j38Cobrado >= cob.j38Esperado);
  const todoCubierto = j17 && j22 && j38;
  const cls = todoCubierto
    ? "border-emerald-200 bg-emerald-50"
    : "border-rose-200 bg-rose-50";
  const txt = todoCubierto ? "text-emerald-800" : "text-rose-800";
  return (
    <div className={`rounded-xl border ${cls} p-3`}>
      <div className="flex items-center justify-between">
        <span className={`text-xs font-semibold uppercase tracking-wider ${txt}`}>
          {fmtPeriodo(cob.periodo)}
        </span>
        <div className="flex gap-1">
          <DotEstado on={j17} label="J17" />
          {cob.j22Esperado > 0 && <DotEstado on={j22} label="J22" />}
          {cob.j38Esperado > 0 && <DotEstado on={j38} label="J38" />}
        </div>
      </div>
      <div className={`mt-1 text-xs ${txt}`}>
        {todoCubierto ? "Cubierto" : `Deuda ${mon(cob.deudaTotal)}`}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-2 text-[10px] text-neutral-600">
        <span className={j17 ? "" : "text-rose-700 font-semibold"}>
          J17 {mon(cob.j17Cobrado)}
        </span>
        <span className="text-right">/ {mon(cob.j17Esperado)}</span>
        {cob.j22Esperado > 0 && (
          <>
            <span className={j22 ? "" : "text-rose-700 font-semibold"}>
              J22 {mon(cob.j22Cobrado)}
            </span>
            <span className="text-right">/ {mon(cob.j22Esperado)}</span>
          </>
        )}
        {cob.j38Esperado > 0 && (
          <>
            <span className={j38 ? "" : "text-rose-700 font-semibold"}>
              J38 {mon(cob.j38Cobrado)}
            </span>
            <span className="text-right">/ {mon(cob.j38Esperado)}</span>
          </>
        )}
        {cob.k16Esperado > 0 && (
          <>
            <span>K16 {mon(cob.k16Cobrado)}</span>
            <span className="text-right">/ {mon(cob.k16Esperado)}</span>
          </>
        )}
      </div>
    </div>
  );
}

function DotEstado({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      title={`${label}: ${on ? "cubierto" : "sin cubrir"}`}
      className={`inline-flex items-center justify-center rounded px-1 text-[9px] font-bold ${
        on ? "bg-emerald-200 text-emerald-800" : "bg-rose-200 text-rose-800"
      }`}
    >
      {label}
    </span>
  );
}

function RecalcInline({
  onRun,
  onClose,
  busy,
}: {
  onRun: (periodo: string) => Promise<void>;
  onClose: () => void;
  busy: boolean;
}) {
  const [periodo, setPeriodo] = useState(periodoAnterior());
  return (
    <div className="rounded-2xl border border-medical-200 bg-medical-50/40 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600">
            Período (YYYY-MM)
          </label>
          <input
            type="text"
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            pattern="\d{4}-\d{2}"
            className="mt-1 w-32 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-medical-400 focus:outline-none focus:ring-2 focus:ring-medical-500/30"
          />
        </div>
        <Button
          size="sm"
          onClick={() => void onRun(periodo)}
          disabled={busy || !/^\d{4}-\d{2}$/.test(periodo)}
        >
          {busy ? "Recalculando…" : "Recalcular"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose} disabled={busy}>
          Cancelar
        </Button>
        <div className="ml-auto text-xs text-neutral-500">
          Períodos rápidos:{" "}
          <button
            type="button"
            className="underline hover:text-medical-700"
            onClick={() => setPeriodo(periodoActual())}
          >
            actual
          </button>
          {" / "}
          <button
            type="button"
            className="underline hover:text-medical-700"
            onClick={() => setPeriodo(periodoAnterior())}
          >
            anterior
          </button>
        </div>
      </div>
    </div>
  );
}

function ExcepcionInline({
  onCancel,
  onConfirm,
  busy,
}: {
  onCancel: () => void;
  onConfirm: (motivo: string, vigenciaHasta?: string) => Promise<void>;
  busy: boolean;
}) {
  const [motivo, setMotivo] = useState("");
  const [vigenciaHasta, setVigenciaHasta] = useState("");
  return (
    <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_180px_auto]">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600">
            Motivo
          </label>
          <input
            type="text"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej: licencia médica larga"
            className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600">
            Vigencia hasta (opcional)
          </label>
          <input
            type="date"
            value={vigenciaHasta}
            onChange={(e) => setVigenciaHasta(e.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
          />
        </div>
        <div className="flex gap-2 self-end">
          <Button
            size="sm"
            onClick={() => void onConfirm(motivo, vigenciaHasta || undefined)}
            disabled={busy || !motivo}
          >
            {busy ? "Creando…" : "Crear"}
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}
