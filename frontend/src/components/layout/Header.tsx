"use client";
import Link from "next/link";
import { useEffect } from "react";
import { Menu, Search } from "lucide-react";
import Breadcrumbs from "./Breadcrumbs";
import CommandPalette from "./CommandPalette";
import UserMenu from "../auth/UserMenu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/auth";
import { useOrgSelector } from "@/contexts/orgSelector";

type Props = {
  onToggleSidebar?: () => void; // Desktop collapse
  onOpenMobileNav?: () => void; // Mobile drawer
};

export default function Header({ onToggleSidebar, onOpenMobileNav }: Props) {
  const { usuario } = useAuth();
  const { organizaciones, selectedOrgId, setSelectedOrgId } = useOrgSelector() || {};
  const isSuperadmin = usuario?.roles?.includes("SUPERADMIN");

  // Acceso rápido: Ctrl/Cmd+B para colapsar sidebar (desktop)
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
    <header className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between border-b bg-white/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-white/80 lg:px-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden text-neutral-500"
          onClick={onOpenMobileNav}
          aria-label="Abrir menú"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <Link href="/" className="flex items-center gap-2 rounded-lg bg-neutral-800 px-2 py-1.5 transition-colors hover:bg-neutral-900">
          <span className="text-sm font-bold text-white">PGG 2025</span>
        </Link>
        <div className="hidden h-6 w-px bg-neutral-200 sm:block" />
        <Badge variant="medical" className="hidden lg:inline-flex">
          Sistema Interno
        </Badge>
      </div>
      <div className="hidden flex-1 justify-center lg:flex">
        <Breadcrumbs />
      </div>
      
      <div className="flex items-center gap-4">
        {isSuperadmin && organizaciones && organizaciones.length > 0 && (
          <select
            value={selectedOrgId ?? usuario?.organizacionId ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              const mine = usuario?.organizacionId ?? "";
              setSelectedOrgId?.(v === mine || !v ? null : v);
            }}
            className="hidden max-w-[180px] rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-medical-500 lg:block"
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
        <div className="relative hidden items-center lg:flex">
          <Search className="absolute left-2.5 h-4 w-4 text-neutral-500" />
          <Input
            className="h-9 w-64 bg-neutral-100 pl-9 border-transparent focus-visible:bg-white focus-visible:ring-offset-0"
            placeholder="Buscar... (Ctrl/⌘+K)"
            aria-label="Buscar"
            readOnly
          />
        </div>
        <CommandPalette />
        <UserMenu />
      </div>
    </header>
  );
}
