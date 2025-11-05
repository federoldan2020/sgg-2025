"use client";
import Link from "next/link";
import { useEffect } from "react";
import Breadcrumbs from "./Breadcrumbs";
import CommandPalette from "./CommandPalette";

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
        <button
          className="mobile-menu-btn mobile-only"
          onClick={onOpenMobileNav}
          aria-label="Abrir menú"
        >
          ☰
        </button>
        <Link href="/" className="app-brand">
          PGG 2025
        </Link>
        <span className="system-label hidden-mobile">
          Sistema Interno
        </span>
      </div>
      
      <div className="header-center hidden-mobile">
        <Breadcrumbs />
      </div>
      
      <div className="header-right">
        <input
          className="search-input hidden-mobile"
          placeholder="Buscar... (Ctrl/⌘+K)"
          aria-label="Buscar"
          readOnly
        />
        <CommandPalette />
        <button className="user-button" aria-label="Perfil de usuario">
          👤
        </button>
      </div>
    </header>
  );
}