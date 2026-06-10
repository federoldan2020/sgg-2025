import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import {
  Book,
  Building2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FilePlus,
  FileSpreadsheet,
  FileText,
  FileUp,
  FolderInput,
  GitMerge,
  HeartPulse,
  Landmark,
  ListChecks,
  Monitor,
  Receipt,
  Settings,
  ShieldCheck,
  Stethoscope,
  Upload,
  Users,
  Users2,
  Wallet,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { NAV_GROUPS } from "@/config/nav.config";
import { filterByRoles } from "@/lib/acl";
import { isActive } from "@/lib/path";
import { useAuth } from "@/contexts/auth";
import type { Role } from "../../tipos/nav";

type IconMap = Record<string, React.ComponentType<{ className?: string }>>;

const ICONS: IconMap = {
  // Afiliados
  Afiliados: Users,
  Familiares: Users2,
  "Cuenta corriente": Wallet,
  "Alta por padrón": FilePlus,
  "Importar afiliados": Upload,
  "Importar familiares": Upload,
  "Importar padrones": Upload,

  // Operación
  Caja: Wallet,
  "Órdenes por afiliado": FileText,
  "Nueva orden de crédito": CreditCard,

  // Coseguro
  Coseguro: HeartPulse,
  Colaterales: Users2,
  Reintegros: Stethoscope,
  "Políticas de reintegro": FileText,
  Resumen: Monitor,
  Configuración: Settings,

  // Nómina y cómputos
  "Novedades pendientes": FilePlus,
  "Generar novedades": FilePlus,
  "Importar cobranza (TXT)": FileUp,
  "Importar cobranza ANSES": FileUp,

  // Tesorería
  Comprobantes: FileText,
  "Órdenes de pago": Landmark,
  "Cuentas corrientes": Wallet,

  // Contabilidad
  "Plan de cuentas": Book,
  "Asientos contables": Receipt,
  Mapeos: GitMerge,
  "Importar plan (CSV)": FileSpreadsheet,

  // Terceros
  Terceros: Users,
  "Nuevo tercero": FilePlus,
  "Importar terceros": Upload,
  "Importar comercios": FolderInput,

  // Configuración (paramétricos)
  Parentescos: Users2,
  "Importar parentescos": Upload,
  "Reglas de colaterales": ListChecks,
  "Parámetros de cobertura": Settings,

  // Administración
  Usuarios: Users,
  Auditoría: ShieldCheck,
  "Cierre mensual": Calendar,
  "Materializar coseguro": FilePlus,

  // Superadmin
  Organizaciones: Building2,
};

function getNavIcon(label: string) {
  const Icon = ICONS[label] || FileText;
  return <Icon className="size-5 shrink-0" />;
}

type Props = {
  roles: Role[];
  mobileOpen?: boolean;
  setMobileOpen?: (v: boolean) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
};

export default function SidebarNav({
  roles,
  mobileOpen,
  setMobileOpen,
  collapsed = false,
  onToggleCollapse,
}: Props) {
  const pathname = usePathname() || "/";
  const navRef = useRef<HTMLDivElement | null>(null);
  const { usuario } = useAuth();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "b") {
        e.preventDefault();
        onToggleCollapse?.();
      }
      if (e.key === "Escape" && mobileOpen && setMobileOpen) setMobileOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen, setMobileOpen, onToggleCollapse]);

  const groups = useMemo(() => filterByRoles(NAV_GROUPS, roles), [roles]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const links = Array.from(nav.querySelectorAll<HTMLAnchorElement>("a.nav-link"));
    function onKey(e: KeyboardEvent) {
      if (!links.length) return;
      const currentIndex = links.indexOf(document.activeElement as HTMLAnchorElement);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = links[Math.min(links.length - 1, currentIndex + 1)] ?? links[0];
        next.focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev = links[Math.max(0, currentIndex - 1)] ?? links[links.length - 1];
        prev.focus();
      }
    }
    nav.addEventListener("keydown", onKey);
    return () => nav.removeEventListener("keydown", onKey);
  }, [groups]);

  const initials = usuario
    ? `${usuario.nombre?.charAt(0) ?? ""}${usuario.apellido?.charAt(0) ?? ""}`.toUpperCase() || "U"
    : "U";
  const displayName = usuario ? `${usuario.nombre ?? ""} ${usuario.apellido ?? ""}`.trim() || "Usuario" : "Usuario";
  const roleLabel = usuario?.roles?.[0] === "ADMIN" ? "Administrador" : usuario?.roles?.[0] ?? "Usuario";

  const renderBrand = (isCollapsed: boolean) => (
    <Link
      href="/"
      className={`group flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition-all hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-medical-400/60 ${
        isCollapsed ? "justify-center" : ""
      }`}
      title="PGG 2025 · Sistema interno"
    >
      <span className="relative flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-medical-400 via-medical-500 to-medical-600 text-white shadow-lg shadow-medical-500/30 ring-1 ring-white/20">
        <HeartPulse className="size-5" />
        <span className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full bg-emerald-400 ring-2 ring-slate-950" />
      </span>
      {!isCollapsed && (
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold tracking-tight text-white">
            PGG 2025
          </span>
          <span className="block truncate text-[11px] font-medium uppercase tracking-wider text-slate-400">
            Sistema gremial
          </span>
        </span>
      )}
    </Link>
  );

  const renderSidebarContent = (forceExpanded: boolean, onNavigate?: () => void) => {
    const isCollapsed = forceExpanded ? false : collapsed;
    return (
      <>
        {/* Brand header */}
        <div className={`flex h-14 shrink-0 items-center border-b border-white/5 ${isCollapsed ? "justify-center px-2" : "px-3"}`}>
          {renderBrand(isCollapsed)}
        </div>

        <div className="sidebar-scroll flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
          <nav
            aria-label="Menú principal"
            ref={navRef}
            className="flex flex-1 flex-col gap-4 p-3"
          >
            {groups.map((g) => (
              <div key={g.titulo} className="space-y-1">
                {isCollapsed ? (
                  <div className="mx-auto my-1 h-px w-6 bg-white/10" aria-hidden />
                ) : (
                  <div className="flex items-center gap-2 px-3 py-1">
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                      {g.titulo}
                    </span>
                    <span className="h-px flex-1 bg-white/5" aria-hidden />
                  </div>
                )}
                <ul className="space-y-0.5">
                  {g.items.map((it) => {
                    const active = isActive(it.href, pathname, it.exact);
                    return (
                      <li key={it.href}>
                        <Link
                          href={it.href}
                          aria-current={active ? "page" : undefined}
                          title={isCollapsed ? `${it.label} · ${g.titulo}` : it.label}
                          onClick={onNavigate}
                          className={`nav-link group relative flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                            isCollapsed ? "justify-center px-2 py-2.5" : "px-2.5 py-2"
                          } ${
                            active
                              ? "bg-gradient-to-r from-medical-500/20 via-medical-500/10 to-transparent text-white shadow-sm"
                              : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                          }`}
                        >
                          {active && (
                            <span
                              className="absolute left-0 top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-r-full bg-medical-400 shadow-[0_0_12px_rgba(56,189,248,0.6)]"
                              aria-hidden
                            />
                          )}
                          <span
                            className={`flex size-8 shrink-0 items-center justify-center rounded-lg transition-all ${
                              active
                                ? "bg-medical-500/15 text-medical-300 ring-1 ring-medical-400/30"
                                : "text-slate-500 group-hover:bg-white/5 group-hover:text-slate-200"
                            }`}
                          >
                            {getNavIcon(it.label)}
                          </span>
                          {!isCollapsed && (
                            <span className="min-w-0 flex-1 truncate">{it.label}</span>
                          )}
                          {!isCollapsed && active && (
                            <span className="size-1.5 shrink-0 rounded-full bg-medical-400 shadow-[0_0_6px_rgba(56,189,248,0.8)]" aria-hidden />
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

          <div className="border-t border-white/5 bg-slate-950/40 p-3">
            <div
              className={`flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-2 transition-colors hover:bg-white/[0.06] ${
                isCollapsed ? "justify-center" : ""
              }`}
            >
              <div className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-medical-400 to-medical-600 text-xs font-bold text-white shadow-md ring-2 ring-white/10">
                {initials}
                <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-950" />
              </div>
              {!isCollapsed && (
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-slate-100">
                    {displayName}
                  </div>
                  <div className="truncate text-[11px] font-medium uppercase tracking-wider text-medical-400">
                    {roleLabel}
                  </div>
                </div>
              )}
            </div>

            {onToggleCollapse && !forceExpanded && (
              <Button
                variant="ghost"
                size="icon"
                className="mt-2 hidden w-full text-slate-500 hover:bg-white/5 hover:text-slate-200 lg:flex"
                onClick={onToggleCollapse}
                aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
                title="Colapsar menú (Ctrl+B)"
              >
                {collapsed ? (
                  <ChevronRight className="size-4" />
                ) : (
                  <>
                    <ChevronLeft className="size-4" />
                    <span className="ml-2 text-xs font-medium">Colapsar</span>
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </>
    );
  };

  return (
    <>
      {/* Desktop sidebar - tema oscuro premium */}
      <aside
        className={`fixed left-0 top-0 z-40 hidden h-screen flex-col border-r border-white/5 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 shadow-xl transition-[width] duration-300 ease-in-out lg:flex ${collapsed ? "w-[72px]" : "w-64"}`}
        data-collapsed={collapsed ? 1 : 0}
      >
        {renderSidebarContent(false, undefined)}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen?.(false)}
        >
          <aside
            className="fixed left-0 top-0 z-50 flex h-full w-72 flex-col border-r border-white/5 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen?.(false)}
              aria-label="Cerrar menú"
              className="absolute right-3 top-3 z-10 text-slate-400 hover:bg-white/5 hover:text-slate-200"
            >
              <X className="size-5" />
            </Button>
            {renderSidebarContent(true, () => setMobileOpen?.(false))}
          </aside>
        </div>
      )}
    </>
  );
}
