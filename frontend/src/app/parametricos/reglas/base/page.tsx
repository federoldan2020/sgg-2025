"use client";

import { useEffect, useMemo, useState } from "react";
import { api, getErrorMessage } from "@/servicios/api";
import type { ReglaPrecioCoseguro } from "@/tipos/modelos";
import { fecha10, num } from "@/utiles/formatos";

type PrecioVigente = {
  id: string;
  precio: number;
  vigenteDesde: string | null;
  vigenteHasta: string | null;
} | null;

type PublicarResp = {
  reglaNuevaId: string;
  prevCerradas: number;
  afectados: number;
  encolados: number;
  periodoDestino: string;
  precio: number;
  vigenteDesde: string;
};

export default function CoseguroPrecioPage() {
  // --------- estado UI ---------
  const [vigente, setVigente] = useState<PrecioVigente>(null);
  const [historial, setHistorial] = useState<ReglaPrecioCoseguro[]>([]);
  const [nuevoPrecio, setNuevoPrecio] = useState<string>("");
  const [vigenteDesde, setVigenteDesde] = useState<string>(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });
  const [impactarPadrones, setImpactarPadrones] = useState(true);
  const [dedupe, setDedupe] = useState<"replace" | "keep">("replace");

  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const puedePublicar = useMemo(() => {
    const v = Number(nuevoPrecio);
    return (
      !loading &&
      !isNaN(v) &&
      v >= 0 &&
      /^\d{4}-\d{2}-\d{2}$/.test(vigenteDesde)
    );
  }, [loading, nuevoPrecio, vigenteDesde]);

  // --------- fetchers ---------
  const cargarVigente = async () => {
    try {
      const data = await api<PrecioVigente>(
        "/novedades/coseguro/precio-vigente",
        { method: "GET" }
      );
      setVigente(data);
    } catch (e) {
      setMsg(getErrorMessage(e));
    }
  };

  const cargarHistorial = async () => {
    try {
      // mantenemos el listado existente para referencia
      const datos = await api<ReglaPrecioCoseguro[]>(
        "/parametricos/reglas/base",
        { method: "GET" }
      );
      setHistorial(datos);
    } catch (e) {
      setMsg(getErrorMessage(e));
    }
  };

  useEffect(() => {
    void cargarVigente();
    void cargarHistorial();
  }, []);

  // --------- acciones ---------
  const publicar = async () => {
    setMsg(null);
    setLoading(true);
    try {
      const body = {
        nuevoPrecio: Number(nuevoPrecio),
        vigenteDesde, // YYYY-MM-DD
        impactarPadrones,
        dedupe, // 'replace' borra pendientes J22 del mismo periodo antes de encolar
      };
      const resp = await api<PublicarResp>("/novedades/coseguro/precio", {
        method: "POST",
        body: JSON.stringify(body),
      });

      // refrescar cabecera e historial
      await Promise.all([cargarVigente(), cargarHistorial()]);

      setNuevoPrecio("");
      setMsg(
        `OK. Regla #${resp.reglaNuevaId}. Cerradas previas: ${resp.prevCerradas}. ` +
          `Padrones afectados: ${resp.afectados}. Novedades encoladas: ${resp.encolados}. ` +
          `Periodo destino: ${resp.periodoDestino}.`
      );
    } catch (e) {
      setMsg(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  // --------- UI ---------
  return (
    <main style={{ padding: 24, display: "grid", gap: 16 }}>
      <h1 style={{ margin: 0 }}>Precio de Coseguro (J22)</h1>

      {/* Precio vigente */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          gap: 12,
        }}
      >
        <div
          style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}
        >
          <div style={{ fontSize: 12, color: "#666" }}>Precio vigente</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>
            {vigente
              ? `$ ${vigente.precio.toLocaleString("es-AR", {
                  minimumFractionDigits: 2,
                })}`
              : "—"}
          </div>
          <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
            Desde: {vigente?.vigenteDesde ? fecha10(vigente.vigenteDesde) : "—"}
            {" • "}
            Hasta: {vigente?.vigenteHasta ? fecha10(vigente.vigenteHasta) : "∞"}
          </div>
        </div>

        {/* Publicar nueva regla */}
        <div
          style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}
        >
          <div style={{ fontSize: 12, color: "#666" }}>
            Publicar nuevo precio
          </div>
          <div
            style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}
          >
            <input
              type="date"
              value={vigenteDesde}
              onChange={(e) => setVigenteDesde(e.target.value)}
              title="Vigente desde"
              style={{
                padding: "6px 8px",
                border: "1px solid #ddd",
                borderRadius: 6,
              }}
            />
            <input
              type="number"
              step="0.01"
              min="0"
              value={nuevoPrecio}
              onChange={(e) => setNuevoPrecio(e.target.value)}
              placeholder="Nuevo precio"
              style={{
                padding: "6px 8px",
                border: "1px solid #ddd",
                borderRadius: 6,
                width: 160,
              }}
            />
            <label
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <input
                type="checkbox"
                checked={impactarPadrones}
                onChange={(e) => setImpactarPadrones(e.target.checked)}
              />
              Impactar padrones ahora
            </label>
            <label
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              Dedupe pendientes:&nbsp;
              <select
                value={dedupe}
                onChange={(e) =>
                  setDedupe(e.target.value as "replace" | "keep")
                }
                style={{
                  padding: "6px 8px",
                  border: "1px solid #ddd",
                  borderRadius: 6,
                }}
              >
                <option value="replace">reemplazar (recom.)</option>
                <option value="keep">mantener</option>
              </select>
            </label>
            <button
              onClick={publicar}
              disabled={!puedePublicar}
              style={{ padding: "6px 12px" }}
            >
              {loading ? "Aplicando…" : "Aplicar cambio global J22"}
            </button>
          </div>
          <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
            Publicar cierra la regla vigente (si había) y crea una nueva con la
            fecha indicada. Si marcás “Impactar padrones ahora”, se actualiza{" "}
            <code>Padron.j22</code> y se encolan <code>COSEGURO_MODIF</code>
            para cada padrón de imputación. Con “reemplazar” se limpian
            pendientes J22 del mismo periodo antes de encolar.
          </div>
        </div>
      </section>

      {/* Mensajes */}
      {msg && (
        <div
          style={{
            border: "1px solid #e3e3e3",
            borderRadius: 10,
            padding: 12,
            background: "#fafafa",
          }}
        >
          {msg}
        </div>
      )}

      {/* Historial de reglas (solo lectura) */}
      <section
        style={{
          border: "1px solid #eee",
          borderRadius: 10,
          overflow: "hidden",
        }}
      >
        <div style={{ padding: 10, background: "#fafafa", fontWeight: 600 }}>
          Historial de reglas
        </div>
        <table
          style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}
        >
          <thead style={{ background: "#fcfcfc", textAlign: "left" }}>
            <tr>
              <th style={{ padding: 8 }}>Vigente desde</th>
              <th style={{ padding: 8 }}>Vigente hasta</th>
              <th style={{ padding: 8 }}>Precio</th>
              <th style={{ padding: 8 }}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {historial.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: 12, color: "#666" }}>
                  Sin reglas
                </td>
              </tr>
            )}
            {historial.map((r) => (
              <tr key={String(r.id)} style={{ borderTop: "1px solid #eee" }}>
                <td style={{ padding: 8 }}>{fecha10(r.vigenteDesde)}</td>
                <td style={{ padding: 8 }}>
                  {r.vigenteHasta ? fecha10(r.vigenteHasta) : "∞"}
                </td>
                <td style={{ padding: 8 }}>${num(r.precioBase)}</td>
                <td
                  style={{ padding: 8, color: r.activo ? "#067D00" : "#666" }}
                >
                  {r.activo ? "activa" : "inactiva"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
