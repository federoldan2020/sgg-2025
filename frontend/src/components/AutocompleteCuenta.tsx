"use client";
import { useEffect, useRef, useState } from "react";

type Sugerencia = {
  id: string;
  codigo: string;
  nombre: string;
  imputable: boolean;
};

type Props = {
  label: string;
  value: string;
  onChange: (codigo: string) => void;
  imputableOnly?: boolean;
};

export default function AutocompleteCuenta({
  label,
  value,
  onChange,
  imputableOnly = true,
}: Props) {
  const [q, setQ] = useState(value);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Sugerencia[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const tRef = useRef<number | null>(null);

  // mantener sync con value externo
  useEffect(() => {
    setQ(value);
  }, [value]);

  useEffect(() => {
    if (tRef.current) window.clearTimeout(tRef.current);

    // sin query suficiente => limpiar
    if (!q || q.trim().length < 2) {
      setItems([]);
      setOpen(false);
      setErr(null);
      return;
    }

    setLoading(true);
    setErr(null);

    tRef.current = window.setTimeout(async () => {
      try {
        const p = new URLSearchParams({
          q,
          imputableOnly: imputableOnly ? "true" : "false",
          limit: "10",
        });

        // Recomendado: usar la misma base que el resto del front
        const base = process.env.NEXT_PUBLIC_API_URL ?? "";
        const res = await fetch(
          `${base}/contabilidad/cuentas/buscar?${p.toString()}`,
          {
            cache: "no-store",
            headers: {
              "X-Organizacion-ID": process.env.NEXT_PUBLIC_TENANT_ID ?? "",
            },
          }
        );

        // si el backend respondió HTML o texto, esto puede tirar
        let data: unknown = [];
        try {
          data = await res.json();
        } catch {
          // si no es JSON, lo tratamos como vacío
          data = [];
        }

        const arr = Array.isArray(data) ? (data as Sugerencia[]) : [];
        setItems(arr);
        setOpen(arr.length > 0);
        setErr(!res.ok ? `Error ${res.status}` : null);
      } catch (e) {
        setItems([]);
        setOpen(false);
        setErr("Error de red");
      } finally {
        setLoading(false);
      }
    }, 250); // debounce
  }, [q, imputableOnly]);

  return (
    <div style={{ position: "relative" }}>
      <label style={{ display: "block", fontSize: 12, opacity: 0.7 }}>
        {label}
      </label>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => items.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Código o nombre…"
      />
      {open && (
        <div
          style={{
            position: "absolute",
            zIndex: 10,
            background: "white",
            border: "1px solid #ddd",
            borderRadius: 8,
            width: "100%",
            maxHeight: 220,
            overflow: "auto",
            marginTop: 4,
            boxShadow: "0 6px 20px rgba(0,0,0,.08)",
          }}
        >
          {loading && <div style={{ padding: 8, fontSize: 12 }}>Buscando…</div>}
          {!loading && err && (
            <div style={{ padding: 8, fontSize: 12, color: "crimson" }}>
              {err}
            </div>
          )}
          {!loading && !err && items.length === 0 && (
            <div style={{ padding: 8, fontSize: 12, opacity: 0.7 }}>
              Sin resultados
            </div>
          )}
          {!loading &&
            !err &&
            items.length > 0 &&
            items.map((it) => (
              <div
                key={it.id}
                onMouseDown={() => {
                  onChange(it.codigo);
                  setQ(it.codigo);
                  setOpen(false);
                }}
                style={{
                  padding: "8px 10px",
                  cursor: "pointer",
                  borderBottom: "1px solid #f2f2f2",
                }}
                title={it.nombre}
              >
                <div style={{ fontFamily: "monospace" }}>{it.codigo}</div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>{it.nombre}</div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
