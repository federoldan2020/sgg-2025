"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CircleUser,
  Wallet,
  Activity,
  Pencil,
  Receipt,
  Stethoscope,
} from "lucide-react";

import {
  AfiliadoDetalleProvider,
  useAfiliadoDetalle,
} from "@/contexts/afiliadoDetalle";
import { Skeleton } from "@/components/ui/skeleton";

const badgeBase =
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold";
const badgeEstado: Record<string, string> = {
  activo: "border-emerald-200 bg-emerald-50 text-emerald-700",
  suspendido_provisorio: "border-amber-200 bg-amber-50 text-amber-700",
  suspendido_firme: "border-rose-200 bg-rose-50 text-rose-700",
  baja: "border-slate-200 bg-slate-100 text-slate-600",
  baja_incobrable: "border-slate-300 bg-slate-200 text-slate-700",
};
const estadoLabel: Record<string, string> = {
  activo: "Activo",
  suspendido_provisorio: "Suspendido (provisorio)",
  suspendido_firme: "Suspendido (firme)",
  baja: "Baja",
  baja_incobrable: "Baja incobrable",
};

function formatDni(dni: string | number | null | undefined) {
  if (dni == null) return "—";
  const s = String(dni).replace(/\D+/g, "");
  if (!s) return "—";
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function HeaderAfiliado() {
  const { afiliadoId, afiliado, loading, error } = useAfiliadoDetalle();
  const pathname = usePathname() || "";

  const tabs = [
    { label: "Datos", href: `/afiliados/${afiliadoId}`, icon: CircleUser, exact: true },
    { label: "Estado", href: `/afiliados/${afiliadoId}/estado`, icon: Activity },
    {
      label: "Cuenta corriente",
      href: `/afiliados/${afiliadoId}/cuenta-corriente`,
      icon: Wallet,
    },
  ];

  const isActive = (tab: { href: string; exact?: boolean }) =>
    tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        <div className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
        <Link
          href="/afiliados"
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-rose-700 hover:underline"
        >
          <ArrowLeft className="size-3" />
          Volver al listado
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header del afiliado */}
      <header className="rounded-2xl border border-neutral-200/80 bg-gradient-to-br from-white via-white to-medical-50/30 p-5 shadow-sm sm:p-6">
        <Link
          href="/afiliados"
          className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-500 hover:text-medical-600"
        >
          <ArrowLeft className="size-3" />
          Volver al listado
        </Link>

        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {loading || !afiliado ? (
              <>
                <Skeleton className="h-4 w-32" />
                <Skeleton className="mt-2 h-7 w-64" />
                <Skeleton className="mt-2 h-4 w-48" />
              </>
            ) : (
              <>
                <div className="text-xs font-semibold uppercase tracking-wider text-medical-600">
                  Afiliado #{afiliado.id}
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
                  {afiliado.apellido}, {afiliado.nombre}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-neutral-600">
                  <span>DNI {formatDni(afiliado.dni)}</span>
                  <span className="text-neutral-300">·</span>
                  <span>{afiliado.tipo || "Sin tipo"}</span>
                  <span className="text-neutral-300">·</span>
                  <span
                    className={`${badgeBase} ${
                      badgeEstado[afiliado.estado] ?? badgeEstado.baja
                    }`}
                  >
                    {estadoLabel[afiliado.estado] ?? afiliado.estado}
                  </span>
                </div>
              </>
            )}
          </div>

          {afiliado && (
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/afiliados/nuevo?afiliadoId=${afiliado.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 shadow-sm transition hover:border-neutral-300 hover:bg-neutral-50"
              >
                <Pencil className="size-3.5" />
                Editar
              </Link>
              <Link
                href={`/caja?afiliadoId=${afiliado.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 shadow-sm transition hover:border-neutral-300 hover:bg-neutral-50"
              >
                <Receipt className="size-3.5" />
                Registrar pago
              </Link>
              <Link
                href={`/coseguro/${afiliado.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 shadow-sm transition hover:border-neutral-300 hover:bg-neutral-50"
              >
                <Stethoscope className="size-3.5" />
                Coseguro
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* Tabs */}
      <nav
        aria-label="Secciones del afiliado"
        className="sticky top-14 z-20 -mx-4 border-b border-neutral-200/80 bg-white/85 px-4 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
      >
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((t) => {
            const active = isActive(t);
            const Icon = t.icon;
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
                  active
                    ? "border-medical-500 text-medical-700"
                    : "border-transparent text-neutral-500 hover:border-neutral-200 hover:text-neutral-800"
                }`}
              >
                <Icon className="size-4" />
                {t.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export default function AfiliadoDetalleLayout({ children }: { children: React.ReactNode }) {
  const { afiliadoId } = useParams<{ afiliadoId: string }>();
  return (
    <AfiliadoDetalleProvider afiliadoId={afiliadoId}>
      <div className="space-y-6">
        <HeaderAfiliado />
        <div>{children}</div>
      </div>
    </AfiliadoDetalleProvider>
  );
}
