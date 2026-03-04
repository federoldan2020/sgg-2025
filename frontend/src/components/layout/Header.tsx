"use client";
import Link from "next/link";
import { useEffect } from "react";
import { Menu, PanelLeftClose, PanelLeft, Search } from "lucide-react";
import Breadcrumbs from "./Breadcrumbs";
import CommandPalette from "./CommandPalette";
import UserMenu from "../auth/UserMenu";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth";
import { useOrgSelector } from "@/contexts/orgSelector";

type Props = {
  onToggleSidebar?: () => void;
  onOpenMobileNav?: () => void;
  sidebarCollapsed?: boolean;
};

export default function Header({
  onToggleSidebar,
  onOpenMobileNav,
  sidebarCollapsed = false,
}: Props) {
  const { usuario } = useAuth();
  const { organizaciones, selectedOrgId, setSelectedOrgId } = useOrgSelector() || {};
  const isSuperadmin = usuario?.roles?.includes("SUPERADMIN");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "b") {
        e.preventDefault();
        onToggleSidebar?.();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onToggleSidebar]);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 border-b border-neutral-200/90 bg-white shadow-sm backdrop-blur-sm">
      <div className="flex h-full items-center justify-between gap-4 px-4 lg:px-5">
        {/* Izquierda: menú móvil + logo + badge + toggle sidebar */}
        <div className="flex min-w-0 flex-1 items-center gap-2 lg:gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 lg:hidden size-9 text-neutral-600"
            onClick={onOpenMobileNav}
            aria-label="Abrir menú"
          >
            <Menu className="size-5" />
          </Button>

          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 rounded-lg bg-neutral-900 px-3 py-2 transition-colors hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:ring-offset-2"
          >
            <span className="text-sm font-semibold tracking-tight text-white">
              PGG 2025
            </span>
          </Link>

          <span className="hidden shrink-0 items-center rounded-full bg-medical-100 px-2.5 py-0.5 text-xs font-medium text-medical-800 lg:inline-flex">
            Sistema Interno
          </span>

          <div className="hidden h-5 w-px shrink-0 bg-neutral-200 lg:block" />

          {/* Breadcrumbs centrados en desktop */}
          <div className="hidden min-w-0 flex-1 justify-center pl-2 lg:flex">
            <Breadcrumbs />
          </div>
        </div>

        {/* Derecha: org selector, búsqueda, usuario */}
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {isSuperadmin && organizaciones && organizaciones.length > 0 && (
            <select
              value={selectedOrgId ?? usuario?.organizacionId ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                const mine = usuario?.organizacionId ?? "";
                setSelectedOrgId?.(v === mine || !v ? null : v);
              }}
              className="hidden max-w-[180px] rounded-md border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-medical-500 lg:block"
              title="Actuar como organización"
            >
              <option value={usuario?.organizacionId ?? ""}>Mi org</option>
              {organizaciones
                .filter((o) => o.id !== usuario?.organizacionId)
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nombre}
                  </option>
                ))}
            </select>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="hidden size-9 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 lg:flex"
            onClick={() => window.dispatchEvent(new CustomEvent("open-command-palette"))}
            aria-label="Buscar (Ctrl+K)"
          >
            <Search className="size-4" />
          </Button>

          <CommandPalette />

          <Button
            variant="ghost"
            size="icon"
            className="hidden size-9 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 lg:flex"
            onClick={onToggleSidebar}
            aria-label={sidebarCollapsed ? "Expandir menú" : "Colapsar menú"}
            title="Colapsar menú (Ctrl+B)"
          >
            {sidebarCollapsed ? (
              <PanelLeft className="size-4" />
            ) : (
              <PanelLeftClose className="size-4" />
            )}
          </Button>

          <UserMenu />
        </div>
      </div>
    </header>
  );
}
