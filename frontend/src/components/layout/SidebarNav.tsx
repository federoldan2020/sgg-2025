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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { NAV_GROUPS } from "@/config/nav.config";
import { filterByRoles } from "@/lib/acl";
import { isActive } from "@/lib/path";
import type { Role } from "../../tipos/nav";

type IconMap = Record<string, React.ComponentType<{ className?: string }>>;

// Íconos profesionales (Lucide) basados en el label del item
const ICONS: IconMap = {
  Inicio: Home,
  Dashboard: LayoutDashboard,
  Resumen: Monitor,
  ABM: Users,
  Movimientos: Activity,
  "Importar afiliados": Upload,
  "Importar padrones": Upload,
  Caja: Wallet,
  "Nueva orden de crédito": CreditCard,
  "Órdenes por afiliado": FileText,
  Colaterales: Users2,
  Configurar: Settings,
  "Resumen (consulta)": Monitor,
  Monitor: Monitor,
  "Generar Novedades": FilePlus,
  Generaciones: Files,
  "Novedades Manuales": ClipboardEdit,
  "Fechas de Corte": Calendar,
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
  Terceros: Users,
};

function getNavIcon(label: string) {
  const Icon = ICONS[label] || FileText;
  return <Icon className="nav-icon-svg" />;
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

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "b") {
        e.preventDefault();
        onToggleCollapse?.();
      }
      if (e.key === "Escape" && mobileOpen && setMobileOpen)
        setMobileOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen, setMobileOpen, onToggleCollapse]);

  const groups = useMemo(() => filterByRoles(NAV_GROUPS, roles), [roles]);

  // Roving tabindex simple con flechas ↑/↓
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const links = Array.prototype.slice.call(
      nav.querySelectorAll<HTMLAnchorElement>("a.nav-link")
    );
    function onKey(e: KeyboardEvent) {
      if (!links.length) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const currentIndex = links.indexOf(document.activeElement as any);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next =
          links[Math.max(0, Math.min(links.length - 1, currentIndex + 1))] ||
          links[0];
        next.focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev =
          links[Math.max(0, currentIndex - 1)] || links[links.length - 1];
        prev.focus();
      }
    }
    nav.addEventListener("keydown", onKey);
    return () => nav.removeEventListener("keydown", onKey);
  }, [groups]);

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`fixed left-0 top-14 z-50 hidden h-[calc(100vh-3.5rem)] w-64 flex-col border-r bg-white transition-all duration-300 lg:flex ${collapsed ? 'w-[72px]' : ''}`}
        data-collapsed={collapsed ? 1 : 0}
      >
        <div className="flex flex-1 flex-col overflow-y-auto">
          <nav aria-label="Menú principal" ref={navRef} className="flex-1 space-y-4 p-4">
            {groups.map((g, idx) => (
              <div key={g.titulo} className="nav-group">
                <div
                  className="nav-title"
                  title={collapsed ? g.titulo : undefined}
                >
                  {!collapsed && g.titulo}
                </div>
                <ul className="nav-list">
                  {g.items.map((it) => {
                    const active = isActive(it.href, pathname, it.exact);
                    return (
                      <li key={it.href}>
                        <Link
                          href={it.href}
                          aria-current={active ? "page" : undefined}
                          title={collapsed ? `${it.label} - ${g.titulo}` : it.label}
                          className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 active:scale-[0.98] ${
                            active
                              ? "bg-medical-50 text-medical-700 shadow-sm hover:bg-medical-100"
                              : "text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900"
                          } ${collapsed ? "justify-center px-0" : ""}`}
                        >
                          {active && (
                            <div className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-medical-600" />
                          )}
                          <span className={`flex h-5 w-5 shrink-0 items-center justify-center transition-transform group-hover:scale-110 ${active ? "text-medical-600" : "text-neutral-500"}`}>
                            {getNavIcon(it.label)}
                          </span>
                          {!collapsed && <span className="flex-1">{it.label}</span>}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
                {idx < groups.length - 1 && !collapsed && (
                  <div className="nav-separator">
                    <Separator />
                  </div>
                )}
              </div>
            ))}
          </nav>
          {/* User info en la parte inferior */}
          <div className="border-t p-4">
            <div className="flex items-center gap-3 rounded-lg bg-neutral-50 p-2 hover:bg-neutral-100 cursor-pointer transition-colors">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-medical-100 text-xs font-semibold text-medical-700">
                OP
              </div>
              {!collapsed && (
                <div className="flex flex-col min-w-0">
                  <div className="truncate text-sm font-medium text-neutral-900">Operador</div>
                  <div className="truncate text-xs text-neutral-500">Administrador</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen && setMobileOpen(false)}
        >
          <div className="fixed left-0 top-0 z-50 flex h-full w-64 flex-col bg-white shadow-lg transition-transform" onClick={(e) => e.stopPropagation()}>
            <div className="flex h-14 items-center justify-between border-b px-4">
              <span className="text-sm font-bold text-neutral-900">Menú</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileOpen && setMobileOpen(false)}
                aria-label="Cerrar menú"
                className="text-neutral-500"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex flex-1 flex-col overflow-y-auto">
              <nav aria-label="Menú principal" className="flex-1 space-y-4 p-4">
                {groups.map((g) => (
                  <div key={g.titulo} className="nav-group">
                    <div className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">{g.titulo}</div>
                    <ul className="space-y-1">
                      {g.items.map((it) => {
                        const active = isActive(it.href, pathname, it.exact);
                        return (
                          <li key={it.href}>
                            <Link
                              href={it.href}
                              aria-current={active ? "page" : undefined}
                              className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                                active
                                  ? "bg-medical-50 text-medical-700"
                                  : "text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900"
                              }`}
                              onClick={() =>
                                setMobileOpen && setMobileOpen(false)
                              }
                            >
                              <span className={`flex h-5 w-5 shrink-0 items-center justify-center transition-transform group-hover:scale-110 ${active ? "text-medical-600" : "text-neutral-500"}`}>
                                {getNavIcon(it.label)}
                              </span>
                              <span className="flex-1">{it.label}</span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </nav>

              <div className="border-t p-4">
                <div className="flex items-center gap-3 rounded-lg p-2 bg-neutral-50">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-medical-100 text-xs font-semibold text-medical-700">
                    OP
                  </div>
                  <div className="flex min-w-0 flex-col">
                    <div className="truncate text-sm font-medium text-neutral-900">Operador</div>
                    <div className="truncate text-xs text-neutral-500">Administrador</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
