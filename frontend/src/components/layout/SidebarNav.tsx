import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import { NAV_GROUPS } from "@/config/nav.config";
import { filterByRoles } from "@/lib/acl";
import { isActive } from "@/lib/path";
import type { Role } from "../../tipos/nav";


// Función para obtener iconos simples basados en el nombre del item
function getNavIcon(label: string): string {
  const iconMap: Record<string, string> = {
    // Dashboard/Inicio
    Inicio: "🏠",
    Dashboard: "📊",
    Resumen: "📋",

    // Gestión de afiliados
    Afiliados: "👥",
    "Alta de afiliado": "➕",
    "Alta de padrón": "📝",
    "Órdenes por afiliado": "📄",

    // Financiero
    Caja: "💰",
    "Nueva orden de crédito": "💳",
    Colaterales: "🏦",

    // Configuración
    Configurar: "⚙️",
    Configuración: "⚙️",
    Novedades: "📢",

    // Por defecto
    default: "📄",
  };

  return iconMap[label] || iconMap.default;
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
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`sidebar-toggle-icon ${
                  collapsed ? "collapsed" : ""
                }`}
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
          </div>

          <nav aria-label="Menú principal" ref={navRef} className="sidebar-nav">
            {groups.map((g) => (
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
                          className={`nav-link ${active ? "active" : ""}`}
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
                      </li>
                    );
                  })}
                </ul>
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
              <button
                className="mobile-close-btn"
                onClick={() => setMobileOpen && setMobileOpen(false)}
                aria-label="Cerrar menú"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
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
                          <Link
                            href={it.href}
                            className={`nav-link ${active ? "active" : ""}`}
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
