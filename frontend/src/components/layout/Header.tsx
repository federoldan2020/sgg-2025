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

type Props = {
  onToggleSidebar?: () => void; // Desktop collapse
  onOpenMobileNav?: () => void; // Mobile drawer
};

export default function Header({ onToggleSidebar, onOpenMobileNav }: Props) {
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
    <header className="app-header">
      <div className="header-left">
        <Button
          variant="ghost"
          size="icon"
          className="mobile-only"
          onClick={onOpenMobileNav}
          aria-label="Abrir menú"
        >
          <Menu size={18} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="hidden-mobile"
          onClick={onToggleSidebar}
          aria-label="Colapsar menú"
        >
          <Menu size={18} />
        </Button>
        <Link href="/" className="app-brand">
          PGG 2025
        </Link>
        <Badge variant="secondary" className="system-label hidden-mobile">
          Sistema Interno
        </Badge>
      </div>
      
      <div className="header-center hidden-mobile">
        <Breadcrumbs />
      </div>
      
      <div className="header-right">
        <div className="search-input-container hidden-mobile">
          <Search size={16} className="search-icon" />
          <Input
            className="search-input"
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