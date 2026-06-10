"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Users,
  Wallet,
  CreditCard,
  Receipt,
  FilePlus,
  Stethoscope,
  ArrowRight,
  TrendingUp,
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  Sparkles,
  RefreshCw,
} from "lucide-react";

import { useAuth } from "@/contexts/auth";
import {
  fetchDashboardStats,
  type DashboardStats,
} from "@/servicios/dashboard";
import { getErrorMessage } from "@/servicios/api";
import { mon } from "@/utiles/formatos";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

type Role = string;

type Kpi = {
  id: string;
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "medical" | "emerald" | "amber" | "rose" | "violet" | "slate";
  href?: string;
  roles?: Role[];
};

const TONES: Record<
  Kpi["tone"],
  { ring: string; iconBg: string; iconColor: string; accent: string }
> = {
  medical: {
    ring: "ring-medical-100",
    iconBg: "bg-medical-50",
    iconColor: "text-medical-600",
    accent: "from-medical-500/10 to-transparent",
  },
  emerald: {
    ring: "ring-emerald-100",
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    accent: "from-emerald-500/10 to-transparent",
  },
  amber: {
    ring: "ring-amber-100",
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
    accent: "from-amber-500/10 to-transparent",
  },
  rose: {
    ring: "ring-rose-100",
    iconBg: "bg-rose-50",
    iconColor: "text-rose-600",
    accent: "from-rose-500/10 to-transparent",
  },
  violet: {
    ring: "ring-violet-100",
    iconBg: "bg-violet-50",
    iconColor: "text-violet-600",
    accent: "from-violet-500/10 to-transparent",
  },
  slate: {
    ring: "ring-slate-100",
    iconBg: "bg-slate-50",
    iconColor: "text-slate-600",
    accent: "from-slate-500/10 to-transparent",
  },
};

function formatNumber(n: number): string {
  return new Intl.NumberFormat("es-AR").format(n);
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "Buenas noches";
  if (h < 13) return "Buenos días";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
}

function fechaLarga(d: Date): string {
  return d.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function userHasAnyRole(userRoles: Role[] | undefined, allowed?: Role[]) {
  if (!allowed || allowed.length === 0) return true;
  if (!userRoles) return false;
  if (userRoles.includes("ADMIN") || userRoles.includes("SUPERADMIN")) return true;
  return allowed.some((r) => userRoles.includes(r));
}

export default function Home() {
  const { usuario } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load(silent = false) {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await fetchDashboardStats();
      setStats(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const roles = (usuario?.roles ?? []) as Role[];

  const kpis: Kpi[] = stats
    ? ([
        {
          id: "afiliados",
          label: "Afiliados activos",
          value: formatNumber(stats.afiliados.activos),
          hint: `${formatNumber(stats.afiliados.total)} totales · +${formatNumber(stats.afiliados.nuevosMes)} este mes`,
          icon: Users,
          tone: "medical",
          href: "/afiliados",
          roles: ["AFILIADOS"],
        },
        {
          id: "caja",
          label: stats.caja.abierta ? "Caja abierta" : "Caja cerrada",
          value: mon(stats.caja.cobradoHoy),
          hint: stats.caja.abierta
            ? `${stats.caja.cantidadPagosHoy} cobros hoy${stats.caja.sede ? " · " + stats.caja.sede : ""}`
            : "Sin actividad en curso",
          icon: Wallet,
          tone: stats.caja.abierta ? "emerald" : "slate",
          href: "/caja",
          roles: ["OPERACION"],
        },
        {
          id: "ordenes",
          label: "Órdenes pendientes",
          value: formatNumber(stats.ordenes.pendientes),
          hint: `${formatNumber(stats.ordenes.enCurso)} en curso`,
          icon: CreditCard,
          tone: stats.ordenes.pendientes > 0 ? "amber" : "slate",
          href: "/ordenes",
          roles: ["OPERACION"],
        },
        {
          id: "comprobantes",
          label: "Comprobantes por procesar",
          value: formatNumber(stats.tesoreria.comprobantesPendientes),
          hint: `${formatNumber(stats.tesoreria.ordenesPagoBorrador)} OP en borrador`,
          icon: Receipt,
          tone: stats.tesoreria.comprobantesPendientes > 0 ? "violet" : "slate",
          href: "/terceros/comprobantes",
          roles: ["TESORERIA", "FINANZAS"],
        },
        {
          id: "reintegros",
          label: "Reintegros en trámite",
          value: formatNumber(stats.reintegros.pendientes),
          hint: "Solicitudes activas",
          icon: Stethoscope,
          tone: stats.reintegros.pendientes > 0 ? "rose" : "slate",
          href: "/coseguro/reintegros",
          roles: ["COSEGURO"],
        },
      ] satisfies Kpi[]).filter((k) => userHasAnyRole(roles, k.roles))
    : [];

  const quickActions = [
    {
      href: "/padrones/nuevo",
      label: "Alta afiliado / padrón",
      desc: "Registrar nuevo afiliado",
      icon: FilePlus,
      tone: "medical" as const,
      roles: ["AFILIADOS"],
    },
    {
      href: "/afiliados",
      label: "Buscar afiliado",
      desc: "Listado y consulta",
      icon: Users,
      tone: "medical" as const,
      roles: ["AFILIADOS"],
    },
    {
      href: "/caja",
      label: "Caja",
      desc: "Abrir caja y cobrar",
      icon: Wallet,
      tone: "emerald" as const,
      roles: ["OPERACION"],
    },
    {
      href: "/ordenes/nueva",
      label: "Nueva orden de crédito",
      desc: "Generar orden a comercio",
      icon: CreditCard,
      tone: "amber" as const,
      roles: ["OPERACION"],
    },
    {
      href: "/terceros/comprobantes/nuevo",
      label: "Cargar comprobante",
      desc: "Factura de proveedor",
      icon: Receipt,
      tone: "violet" as const,
      roles: ["TESORERIA", "FINANZAS"],
    },
  ].filter((a) => userHasAnyRole(roles, a.roles));

  return (
    <div className="space-y-6">
      {/* Hero / Greeting */}
      <div className="relative overflow-hidden rounded-2xl border border-neutral-200/80 bg-gradient-to-br from-white via-white to-medical-50/40 p-6 shadow-sm sm:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-gradient-to-br from-medical-200/40 to-medical-100/0 blur-3xl"
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-medical-600">
              <Sparkles className="size-3.5" />
              {fechaLarga(new Date())}
            </div>
            <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
              {greeting()}, {usuario?.nombre ?? "Usuario"}
            </h1>
            <p className="mt-1 text-sm text-neutral-600">
              Resumen operativo del sistema en tiempo real.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {stats?.caja.abierta ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                <span className="size-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                Caja abierta
              </span>
            ) : stats ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-semibold text-neutral-600">
                <span className="size-1.5 rounded-full bg-neutral-400" />
                Caja cerrada
              </span>
            ) : null}

            <Button
              variant="ghost"
              size="icon"
              onClick={() => void load(true)}
              disabled={loading || refreshing}
              aria-label="Actualizar"
              className="size-9 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
              title="Actualizar"
            >
              <RefreshCw
                className={`size-4 ${refreshing ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 size-5 shrink-0" />
          <div className="flex-1">
            <div className="font-semibold">No pudimos cargar los indicadores</div>
            <div className="mt-1 text-rose-600/90">{error}</div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-rose-300 text-rose-700 hover:bg-rose-100"
            onClick={() => void load()}
          >
            Reintentar
          </Button>
        </div>
      )}

      {/* KPIs */}
      <section aria-label="Indicadores" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {loading && !stats
          ? Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <Skeleton className="size-11 rounded-xl" />
                  <Skeleton className="h-4 w-12 rounded-full" />
                </div>
                <Skeleton className="mt-4 h-8 w-24" />
                <Skeleton className="mt-2 h-4 w-40" />
              </div>
            ))
          : kpis.map((k) => {
              const tone = TONES[k.tone];
              const Icon = k.icon;
              const card = (
                <div
                  className={`group relative overflow-hidden rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md`}
                >
                  <div
                    aria-hidden
                    className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${tone.accent} opacity-0 transition-opacity group-hover:opacity-100`}
                  />
                  <div className="relative">
                    <div className="flex items-start justify-between">
                      <div
                        className={`flex size-11 items-center justify-center rounded-xl ${tone.iconBg} ${tone.iconColor} ring-1 ${tone.ring}`}
                      >
                        <Icon className="size-5" />
                      </div>
                      {k.href && (
                        <ArrowRight className="size-4 -translate-x-1 text-neutral-300 opacity-0 transition-all group-hover:translate-x-0 group-hover:text-neutral-500 group-hover:opacity-100" />
                      )}
                    </div>

                    <div className="mt-4">
                      <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                        {k.label}
                      </div>
                      <div className="mt-1 text-2xl font-bold tabular-nums text-neutral-900">
                        {k.value}
                      </div>
                      {k.hint && (
                        <div className="mt-1 text-xs text-neutral-500">{k.hint}</div>
                      )}
                    </div>
                  </div>
                </div>
              );
              return k.href ? (
                <Link key={k.id} href={k.href} className="block focus:outline-none focus:ring-2 focus:ring-medical-500 focus:ring-offset-2 rounded-2xl">
                  {card}
                </Link>
              ) : (
                <div key={k.id}>{card}</div>
              );
            })}

        {!loading && !error && kpis.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-neutral-200 bg-white/60 p-8 text-center text-sm text-neutral-500">
            No hay indicadores disponibles para tu rol.
          </div>
        )}
      </section>

      {/* Quick actions */}
      {quickActions.length > 0 && (
        <section aria-label="Accesos rápidos">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
              Accesos rápidos
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {quickActions.map((a) => {
              const tone = TONES[a.tone];
              const Icon = a.icon;
              return (
                <Link
                  key={a.href}
                  href={a.href}
                  className="group flex items-center gap-3 rounded-xl border border-neutral-200/80 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-medical-500 focus:ring-offset-2"
                >
                  <div
                    className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${tone.iconBg} ${tone.iconColor} ring-1 ${tone.ring}`}
                  >
                    <Icon className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-neutral-900">
                      {a.label}
                    </div>
                    <div className="truncate text-xs text-neutral-500">{a.desc}</div>
                  </div>
                  <ArrowRight className="size-4 shrink-0 text-neutral-300 transition-all group-hover:translate-x-0.5 group-hover:text-neutral-500" />
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Status footer */}
      {stats && (
        <footer className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-neutral-200/60 bg-white/50 px-4 py-3 text-xs text-neutral-500">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="size-3.5 text-emerald-500" />
            <span>Sesión activa</span>
          </div>
          <span className="text-neutral-300">·</span>
          <div className="flex items-center gap-1.5">
            <TrendingUp className="size-3.5 text-medical-500" />
            <span>{usuario?.roles?.join(", ") || "Sin roles"}</span>
          </div>
          <span className="text-neutral-300">·</span>
          <div className="flex items-center gap-1.5">
            <Clock className="size-3.5" />
            <span>
              Actualizado{" "}
              {new Date(stats.generadoEn).toLocaleTimeString("es-AR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        </footer>
      )}
    </div>
  );
}
