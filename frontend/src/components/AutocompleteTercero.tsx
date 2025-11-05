"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/servicios/api";

export type RolTercero = "PROVEEDOR" | "PRESTADOR" | "AFILIADO" | "OTRO";
type Item = {
  id: string;
  nombre: string;
  fantasia?: string | null;
  cuit?: string | null;
  codigo?: string | null;
  activo: boolean;
};

export default function AutocompleteTercero({
  rol,
  value,
  onChange,
  label = "Tercero",
  placeholder = "CUIT, nombre o código…",
  limit = 15,
}: {
  rol: RolTercero;
  value: Item | null;
  onChange: (t: Item | null) => void;
  label?: string;
  placeholder?: string;
  limit?: number;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const deb = useRef<number | null>(null);

  const display = useMemo(() => {
    if (!value) return "";
    const extra = value.cuit
      ? ` • CUIT ${value.cuit}`
      : value.codigo
      ? ` • ${value.codigo}`
      : "";
    return `${value.nombre}${extra}`;
  }, [value]);

  useEffect(() => {
    if (!q.trim()) {
      setItems([]);
      return;
    }
    if (deb.current) window.clearTimeout(deb.current);
    deb.current = window.setTimeout(async () => {
      try {
        setLoading(true);
        const data = await api<Item[]>(
          `/terceros/buscar?q=${encodeURIComponent(
            q
          )}&rol=${rol}&limit=${limit}`
        );
        setItems(data);
      } finally {
        setLoading(false);
      }
    }, 250);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, rol, limit]);

  return (
    <div style={{ position: "relative" }}>
      <label>{label}</label>
      <input
        value={value ? display : q}
        onChange={(e) => {
          onChange(null);
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
      />
      {open && (q || loading || items.length > 0) && (
        <div
          style={{
            position: "absolute",
            zIndex: 10,
            insetInlineStart: 0,
            insetBlockStart: "100%",
            background: "#fff",
            border: "1px solid #ddd",
            borderRadius: 8,
            marginTop: 4,
            width: "100%",
            maxHeight: 260,
            overflow: "auto",
            boxShadow: "0 6px 20px rgba(0,0,0,.08)",
          }}
          onMouseLeave={() => setOpen(false)}
        >
          {loading && <div style={{ padding: 8 }}>Buscando…</div>}
          {!loading && items.length === 0 && q && (
            <div style={{ padding: 8, opacity: 0.7 }}>Sin resultados</div>
          )}
          {items.map((it) => (
            <button
              key={it.id}
              onClick={() => {
                onChange(it);
                setQ("");
                setOpen(false);
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "8px 10px",
                background: "transparent",
                border: "none",
                borderBottom: "1px solid #f3f3f3",
                cursor: "pointer",
              }}
            >
              <div style={{ fontWeight: 600 }}>{it.nombre}</div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>
                {it.fantasia ? `${it.fantasia} • ` : ""}
                {it.cuit ? `CUIT ${it.cuit}` : it.codigo || "—"}
                {!it.activo ? " • INACTIVO" : ""}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
