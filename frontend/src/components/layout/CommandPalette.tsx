"use client";
import { useRouter } from "next/navigation";
import { NAV_GROUPS } from "@/config/nav.config";
import { useRef, useState, useEffect } from "react";

/**
 * CommandPalette moderno compatible con Chrome 109 usando <dialog> nativo
 * Atajo: Ctrl/Cmd + K
 */
export default function CommandPalette() {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();

  const items = NAV_GROUPS.flatMap((g) =>
    g.items.map((it) => ({ ...it, group: g.titulo }))
  );

  const filtered = query
    ? items.filter((it) =>
        (it.label + " " + it.href + " " + it.group)
          .toLowerCase()
          .includes(query.toLowerCase())
      )
    : items.slice(0, 8); // Mostrar solo los primeros 8 si no hay query

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (dialogRef.current) {
          dialogRef.current.showModal();
          setQuery("");
          setSelectedIndex(0);
          setTimeout(() => {
            inputRef.current?.focus();
          }, 100);
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    // Reset selection when filtered items change
    setSelectedIndex(0);
  }, [filtered]);

  useEffect(() => {
    if (!dialogRef.current?.open) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        dialogRef.current?.close();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          go(filtered[selectedIndex].href);
        }
      }
    }

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, selectedIndex]);

  function go(href: string) {
    if (dialogRef.current?.open) {
      dialogRef.current.close();
      setQuery("");
      setSelectedIndex(0);
    }
    router.push(href);
  }

  function getItemIcon(label: string): string {
    const iconMap: Record<string, string> = {
      Inicio: "🏠",
      Dashboard: "📊",
      Resumen: "📋",
      Afiliados: "👥",
      "Alta de afiliado": "➕",
      "Alta de padrón": "📝",
      "Órdenes por afiliado": "📄",
      Caja: "💰",
      "Nueva orden de crédito": "💳",
      Colaterales: "🏦",
      Configurar: "⚙️",
      Configuración: "⚙️",
      Novedades: "📢",
      default: "📄",
    };
    return iconMap[label] || iconMap.default;
  }

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => {
          if (dialogRef.current) {
            dialogRef.current.showModal();
            setQuery("");
            setSelectedIndex(0);
            setTimeout(() => {
              inputRef.current?.focus();
            }, 100);
          }
        }}
        className="command-trigger"
        aria-label="Abrir paleta de comandos"
        title="Buscar (Ctrl/⌘+K)"
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
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
      </button>

      {/* Dialog */}
      <dialog ref={dialogRef} className="command-dialog">
        <div className="dialog-content">
          <div className="dialog-header">
            <div className="search-container">
              <svg
                className="search-icon"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar páginas y acciones..."
                aria-label="Buscar"
                className="dialog-search"
              />
            </div>
            <div className="dialog-shortcuts">
              <kbd className="kbd">↑↓</kbd>
              <kbd className="kbd">↵</kbd>
              <kbd className="kbd">esc</kbd>
            </div>
          </div>

          {filtered.length > 0 ? (
            <div className="dialog-results">
              {query && (
                <div className="results-header">
                  <span className="results-count">
                    {filtered.length} resultado
                    {filtered.length !== 1 ? "s" : ""}
                  </span>
                </div>
              )}
              <ul className="results-list">
                {filtered.map((it, index) => (
                  <li key={it.href}>
                    <button
                      onClick={() => go(it.href)}
                      className={`dialog-item ${
                        index === selectedIndex ? "selected" : ""
                      }`}
                      onMouseEnter={() => setSelectedIndex(index)}
                    >
                      <div className="item-icon">{getItemIcon(it.label)}</div>
                      <div className="item-content">
                        <div className="item-title">{it.label}</div>
                        <div className="item-meta">
                          <span className="item-group">{it.group}</span>
                          <span className="item-path">{it.href}</span>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="dialog-empty">
              <div className="empty-icon">🔍</div>
              <div className="empty-text">No se encontraron resultados</div>
              <div className="empty-hint">
                Intenta con otros términos de búsqueda
              </div>
            </div>
          )}
        </div>
      </dialog>
    </>
  );
}
