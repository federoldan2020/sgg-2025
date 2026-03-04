import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import {
  Banknote,
  Book,
  Calendar,
  CreditCard,
  FilePlus,
  FileSpreadsheet,
  FileText,
  FileUp,
  Files,
  GitMerge,
  Home,
  Landmark,
  ListChecks,
  Monitor,
  ChevronLeft,
  ChevronRight,
  X,
  Receipt,
  Settings,
  Upload,
  Users,
  Users2,
  Wallet,
  Activity,
  ClipboardEdit,
  CheckCircle,
  LayoutDashboard,
  Stethoscope,
  Building2,
  ShieldCheck,
  FolderInput,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { NAV_GROUPS } from "@/config/nav.config";
import { filterByRoles } from "@/lib/acl";
import { isActive } from "@/lib/path";
import { useAuth } from "@/contexts/auth";
import type { Role } from "../../tipos/nav";

type IconMap = Record<string, React.ComponentType<{ className?: string }>>;

const ICONS: IconMap = {
  Inicio: Home,
  Dashboard: LayoutDashboard,
  Resumen: Monitor,
  ABM: Users,
  "ABM familiares": Users2,
  Movimientos: Activity,
  "Importar afiliados": Upload,
  "Importar familiares": Upload,
  "Importar padrones": Upload,
  Caja: Wallet,
  "Nueva orden de crédito": CreditCard,
  "Órdenes por afiliado": FileText,
  Colaterales: Users2,
  Configurar: Settings,
  "Resumen (consulta)": Monitor,
  Monitor: Monitor,
  Reintegros: Stethoscope,
  "Reintegros - Políticas": FileText,
  "Generar Novedades": FilePlus,
  Generaciones: Files,
  "Novedades Manuales": ClipboardEdit,
  "Fechas de Corte": Calendar,
  Conciliación: CheckCircle,
  "Conciliar Devolución": CheckCircle,
  Conciliaciones: ListChecks,
  "Cargar comprobante": FileUp,
  Comprobantes: FileText,
  "Nueva orden de pago": Banknote,
  "Órdenes de pago": Landmark,
  "Cuentas de terceros": Users2,
  "Plan de cuentas": Book,
  "Asientos contables": Receipt,
  Mapeos: GitMerge,
  "Importar plan (CSV)": FileSpreadsheet,
  Listado: Users,
  Terceros: Users,
  "ABM Usuarios": Users,
  Auditoría: ShieldCheck,
  "ABM Organizaciones": Building2,
  "Importar comercios": FolderInput,
  "Importar Terceros": Upload,
  "Importar Afiliados": Upload,
  "Importar Familiares": Upload,
  "Importar Padrones": Upload,
  "Importar Parentescos": Upload,
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

  const renderSidebarContent = (forceExpanded: boolean, onNavigate?: () => void) => {
    const isCollapsed = forceExpanded ? false : collapsed;
  return (
    <>
      <div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
        <nav
          aria-label="Menú principal"
          ref={navRef}
          className="flex flex-1 flex-col gap-5 p-3"
        >
          {groups.map((g) => (
            <div key={g.titulo} className="space-y-1">
              <div
                className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 ${isCollapsed ? "flex justify-center" : ""}`}
                title={isCollapsed ? g.titulo : undefined}
              >
                {!isCollapsed && g.titulo}
              </div>
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
                        className={`nav-link group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                          isCollapsed ? "justify-center px-2" : ""
                        } ${
                          active
                            ? "bg-slate-800 text-white shadow-inner"
                            : "text-slate-400 hover:bg-slate-800/70 hover:text-slate-200"
                        }`}
                      >
                        {active && (
                          <span
                            className="absolute left-0 top-1/2 h-8 w-0.5 -translate-y-1/2 rounded-r-full bg-medical-400"
                            aria-hidden
                          />
                        )}
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
                            active ? "text-medical-400" : "text-slate-500 group-hover:text-slate-300"
                          }`}
                        >
                          {getNavIcon(it.label)}
                        </span>
                        {!isCollapsed && (
                          <span className="min-w-0 flex-1 truncate">{it.label}</span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-700/80 p-3">
          <div className="flex items-center gap-3 rounded-lg bg-slate-800/80 px-3 py-2.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-medical-500/20 text-xs font-semibold text-medical-400">
              {initials}
            </div>
            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-slate-200">
                  {displayName}
                </div>
                <div className="truncate text-xs text-slate-500">{roleLabel}</div>
              </div>
            )}
          </div>

          {onToggleCollapse && !forceExpanded && (
            <Button
              variant="ghost"
              size="icon"
              className="mt-2 w-full text-slate-500 hover:bg-slate-800 hover:text-slate-300 hidden lg:flex"
              onClick={onToggleCollapse}
              aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
              title="Colapsar menú (Ctrl+B)"
            >
              {collapsed ? (
                <ChevronRight className="size-4" />
              ) : (
                <ChevronLeft className="size-4" />
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
      {/* Desktop sidebar - tema oscuro */}
      <aside
        className={`fixed left-0 top-14 z-40 hidden h-[calc(100vh-3.5rem)] flex-col border-r border-slate-800 bg-slate-900 transition-[width] duration-300 ease-in-out lg:flex ${collapsed ? "w-[72px]" : "w-64"}`}
        data-collapsed={collapsed ? 1 : 0}
      >
        {renderSidebarContent(false, undefined)}
      </aside>

      {/* Mobile drawer - siempre expandido */}
      {mobileOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen?.(false)}
        >
          <aside
            className="fixed left-0 top-0 z-50 flex h-full w-72 flex-col border-r border-slate-800 bg-slate-900 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800 px-4">
              <span className="text-sm font-semibold text-slate-200">Menú</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileOpen?.(false)}
                aria-label="Cerrar menú"
                className="text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              >
                <X className="size-5" />
              </Button>
            </div>
            {renderSidebarContent(true, () => setMobileOpen?.(false))}
          </aside>
        </div>
      )}
    </>
  );
}
