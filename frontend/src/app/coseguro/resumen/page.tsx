"use client";
import { useState } from "react";
import { api, getErrorMessage } from "@/servicios/api";
import { mon } from "@/utiles/formatos";

type Resumen = {
  afiliadoId: string;
  fechaCorte: string;
  precioBase: string;
  colaterales: {
    parentescoCodigo: string;
    cantidad: number;
    precioTotal: string;
  }[];
  totalCoseguro: string;
  totalColaterales: string;
  total: string;
  imputaciones: { padronCoseguroId?: string; padronColateralesId?: string };
};

export default function ResumenCoseguroPage() {
  const [afiliadoId, setAfiliadoId] = useState("");
  const [res, setRes] = useState<Resumen | null>(null);
  const [periodo, setPeriodo] = useState<string>(
    new Date().toISOString().slice(0, 7)
  );
  const [msg, setMsg] = useState<string | null>(null);

  const consultar = async () => {
    try {
      const data = await api<Resumen>(
        `/coseguro/${encodeURIComponent(afiliadoId)}/resumen?fecha=${new Date()
          .toISOString()
          .slice(0, 10)}`
      );
      setRes(data);
      setMsg(null);
    } catch (e) {
      setMsg(getErrorMessage(e));
    }
  };

  const generar = async () => {
    try {
      await api("/coseguro/generar-obligaciones", {
        method: "POST",
        body: JSON.stringify({ afiliadoId: Number(afiliadoId), periodo }),
      });
      setMsg("Obligaciones generadas");
    } catch (e) {
      setMsg(getErrorMessage(e));
    }
  };

  return (
    <main style={{ padding: 24 }}>
      <h1>Resumen de Coseguro</h1>
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <label>Afiliado ID</label>
        <input
          value={afiliadoId}
          onChange={(e) => setAfiliadoId(e.target.value)}
          style={{ width: 120 }}
        />
        <button onClick={consultar}>Consultar</button>
      </div>

      {res && (
        <>
          <p>
            <b>Fecha Corte:</b> {res.fechaCorte.slice(0, 10)}
          </p>
          <p>
            <b>Base Coseguro:</b> {mon(res.precioBase)}
          </p>
          <p>
            <b>Colaterales:</b>
          </p>
          <ul>
            {res.colaterales.map((c, i) => (
              <li key={i}>
                {c.parentescoCodigo}: {c.cantidad} → {mon(c.precioTotal)}
              </li>
            ))}
          </ul>
          <p>
            <b>Total Coseguro:</b> {mon(res.totalCoseguro)}
          </p>
          <p>
            <b>Total Colaterales:</b> {mon(res.totalColaterales)}
          </p>
          <p>
            <b>Total:</b> {mon(res.total)}
          </p>

          <hr style={{ margin: "12px 0" }} />
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label>Período (YYYY-MM)</label>
            <input
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              style={{ width: 120 }}
            />
            <button onClick={generar}>Generar Obligaciones</button>
          </div>
        </>
      )}

      {msg && <p>{msg}</p>}
    </main>
  );
}
