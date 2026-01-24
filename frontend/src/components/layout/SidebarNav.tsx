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
        className="app-sidebar hidden-mobile"
        data-collapsed={collapsed ? 1 : 0}
      >
        <div className="sidebar-content">
          {/* Logo y toggle */}
          <div className="sidebar-brand">
            <div className="brand-container">
              <div className="brand-icon">
                <span className="brand-letter">P</span>
              </div>
              {!collapsed && (
                <div className="brand-text">
                  <span className="brand-name">PGG</span>
                  <span className="brand-year">2025</span>
                </div>
              )}
            </div>
            <button
              onClick={onToggleCollapse}
              className="sidebar-toggle-btn"
              aria-pressed={collapsed}
              aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
              title={
                collapsed
                  ? "Expandir menú (Ctrl/⌘+B)"
                  : "Colapsar menú (Ctrl/⌘+B)"
              }
            >
              <ChevronLeft
                className={`sidebar-toggle-icon ${collapsed ? "collapsed" : ""}`}
              />
            </button>
          </div>

          <nav aria-label="Menú principal" ref={navRef} className="sidebar-nav">
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
                        <Button
                          asChild
                          variant="ghost"
                          size="sm"
                          className={`nav-link ${active ? "active" : ""}`}
                        >
                          <Link
                            href={it.href}
                            aria-current={active ? "page" : undefined}
                            title={
                              collapsed ? `${it.label} - ${g.titulo}` : it.label
                            }
                          >
                            <span className="nav-icon">
                              {getNavIcon(it.label)}
                            </span>
                            {!collapsed && (
                              <span className="nav-text">{it.label}</span>
                            )}
                            {active && <span className="nav-indicator" />}
                          </Link>
                        </Button>
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
          <div className="sidebar-footer">
            <div className="user-info">
              <div className="user-avatar">
                <span>OP</span>
              </div>
              {!collapsed && (
                <div className="user-details">
                  <div className="user-name">Operador</div>
                  <div className="user-role">Administrador</div>
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
          className="mobile-overlay"
          onClick={() => setMobileOpen && setMobileOpen(false)}
        >
          <div className="mobile-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="sidebar-brand">
              <div className="brand-container">
                <div className="brand-icon">
                  <span className="brand-letter">P</span>
                </div>
                <div className="brand-text">
                  <span className="brand-name">PGG</span>
                  <span className="brand-year">2025</span>
                </div>
              </div>
              <Button
                className="mobile-close-btn"
                variant="ghost"
                size="icon"
                onClick={() => setMobileOpen && setMobileOpen(false)}
                aria-label="Cerrar menú"
              >
                <X size={18} />
              </Button>
            </div>

            <nav aria-label="Menú principal" className="sidebar-nav">
              {groups.map((g) => (
                <div key={g.titulo} className="nav-group">
                  <div className="nav-title">{g.titulo}</div>
                  <ul className="nav-list">
                    {g.items.map((it) => {
                      const active = isActive(it.href, pathname, it.exact);
                      return (
                        <li key={it.href}>
                          <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            className={`nav-link ${active ? "active" : ""}`}
                          >
                            <Link
                              href={it.href}
                              aria-current={active ? "page" : undefined}
                              onClick={() =>
                                setMobileOpen && setMobileOpen(false)
                              }
                            >
                              <span className="nav-icon">
                                {getNavIcon(it.label)}
                              </span>
                              <span className="nav-text">{it.label}</span>
                              {active && <span className="nav-indicator" />}
                            </Link>
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>

            <div className="sidebar-footer">
              <div className="user-info">
                <div className="user-avatar">
                  <span>OP</span>
                </div>
                <div className="user-details">
                  <div className="user-name">Operador</div>
                  <div className="user-role">Administrador</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
