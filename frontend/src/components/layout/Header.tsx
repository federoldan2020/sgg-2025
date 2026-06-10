"use client";
import Link from "next/link";
import { useEffect } from "react";
import { Menu, PanelLeftClose, PanelLeft, Search, Building2 } from "lucide-react";
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
    <header
      className={`fixed top-0 right-0 z-50 h-14 border-b border-neutral-200/80 bg-white/85 backdrop-blur-md transition-[left] duration-300 ease-in-out left-0 ${sidebarCollapsed ? "lg:left-[72px]" : "lg:left-64"}`}
    >
      <div className="flex h-full items-center justify-between gap-3 px-4 lg:px-6">
        {/* Izquierda: toggle móvil + toggle desktop + breadcrumbs */}
        <div className="flex min-w-0 flex-1 items-center gap-1.5 lg:gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 lg:hidden size-9 text-neutral-600"
            onClick={onOpenMobileNav}
            aria-label="Abrir menú"
          >
            <Menu className="size-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="hidden shrink-0 size-9 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 lg:flex"
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

          <div className="hidden h-5 w-px shrink-0 bg-neutral-200 lg:block" />

          <div className="min-w-0 flex-1 pl-1">
            <Breadcrumbs />
          </div>
        </div>

        {/* Derecha: org selector, búsqueda, usuario */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {isSuperadmin && organizaciones && organizaciones.length > 0 && (
            <div className="hidden lg:flex items-center">
              <div className="relative">
                <Building2 className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                <select
                  value={selectedOrgId ?? usuario?.organizacionId ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    const mine = usuario?.organizacionId ?? "";
                    setSelectedOrgId?.(v === mine || !v ? null : v);
                  }}
                  className="max-w-[200px] cursor-pointer rounded-lg border border-neutral-200 bg-neutral-50/80 py-1.5 pl-8 pr-3 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 focus:border-medical-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-medical-500/30"
                  title="Actuar como organización"
                >
                  <option value={usuario?.organizacionId ?? ""}>Mi organización</option>
                  {organizaciones
                    .filter((o) => o.id !== usuario?.organizacionId)
                    .map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.nombre}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="hidden h-9 gap-2 rounded-lg border border-neutral-200/80 bg-neutral-50/80 px-3 text-xs font-medium text-neutral-500 hover:border-neutral-300 hover:bg-white hover:text-neutral-700 lg:flex"
            onClick={() => window.dispatchEvent(new CustomEvent("open-command-palette"))}
            aria-label="Buscar (Ctrl+K)"
          >
            <Search className="size-4" />
            <span>Buscar…</span>
            <kbd className="ml-2 hidden items-center gap-1 rounded border border-neutral-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-neutral-500 xl:inline-flex">
              Ctrl K
            </kbd>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="size-9 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 lg:hidden"
            onClick={() => window.dispatchEvent(new CustomEvent("open-command-palette"))}
            aria-label="Buscar (Ctrl+K)"
          >
            <Search className="size-4" />
          </Button>

          <CommandPalette />

          <div className="hidden h-5 w-px shrink-0 bg-neutral-200 lg:block" />

          <UserMenu />
        </div>
      </div>
    </header>
  );
}
