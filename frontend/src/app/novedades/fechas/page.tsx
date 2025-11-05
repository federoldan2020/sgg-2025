"use client";

import { useEffect, useState } from "react";
import { api, getErrorMessage } from "@/servicios/api";

type CorteResp = { periodo: string; diaCorte: number };
type ResolveResp = {
  fechaEvento: string;
  corteDia: number;
  periodoBase: string;
  periodoDestino: string;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function hoyYYYYMM() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
function hoyYYYYMMDD() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function CortePage() {
  const [periodo, setPeriodo] = useState(hoyYYYYMM());
  const [diaCorte, setDiaCorte] = useState<number>(10);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // tester
  const [fechaTest, setFechaTest] = useState(hoyYYYYMMDD());
  const [testOut, setTestOut] = useState<ResolveResp | null>(null);

  const cargar = async () => {
    setMsg(null);
    try {
      const r = await api<CorteResp>(`/novedades/corte?periodo=${periodo}`, {
        method: "GET",
      });
      setDiaCorte(r.diaCorte);
    } catch (e) {
      setMsg(getErrorMessage(e));
    }
  };

  useEffect(() => {
    void cargar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [periodo]);

  const guardar = async () => {
    setMsg(null);
    setLoading(true);
    try {
      await api("/novedades/corte", {
        method: "PATCH",
        body: JSON.stringify({ periodo, diaCorte: Number(diaCorte) }),
      });
      setMsg("Guardado");
    } catch (e) {
      setMsg(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const probar = async () => {
    setMsg(null);
    try {
      const r = await api<ResolveResp>(
        `/novedades/corte/resolve?fecha=${fechaTest}`,
        { method: "GET" }
      );
      setTestOut(r);
    } catch (e) {
      setMsg(getErrorMessage(e));
    }
  };

  return (
    <main style={{ padding: 24, display: "grid", gap: 16 }}>
      <h1 style={{ margin: 0 }}>Fecha de corte (por periodo)</h1>

      <section style={{ display: "grid", gap: 12 }}>
        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "end",
          }}
        >
          <div>
            <label style={{ display: "block", fontSize: 12, color: "#666" }}>
              Periodo (YYYY-MM)
            </label>
            <input
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              placeholder="YYYY-MM"
              style={{
                padding: "6px 8px",
                border: "1px solid #ddd",
                borderRadius: 6,
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, color: "#666" }}>
              Día de corte
            </label>
            <input
              type="number"
              min={1}
              max={31}
              value={diaCorte}
              onChange={(e) => setDiaCorte(Number(e.target.value))}
              style={{
                width: 100,
                padding: "6px 8px",
                border: "1px solid #ddd",
                borderRadius: 6,
              }}
            />
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={cargar} style={{ padding: "6px 10px" }}>
              Recargar
            </button>
            <button
              onClick={guardar}
              disabled={loading}
              style={{ padding: "6px 10px" }}
            >
              {loading ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>

        {msg && (
          <div style={{ color: msg === "Guardado" ? "#067D00" : "#A30000" }}>
            {msg}
          </div>
        )}
      </section>

      {/* Tester de resolución */}
      <section
        style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}
      >
        <div style={{ fontWeight: 600, marginBottom: 8 }}>
          Probar resolución de periodo
        </div>
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <label style={{ fontSize: 12, color: "#666" }}>Fecha de evento</label>
          <input
            type="date"
            value={fechaTest}
            onChange={(e) => setFechaTest(e.target.value)}
            style={{
              padding: "6px 8px",
              border: "1px solid #ddd",
              borderRadius: 6,
            }}
          />
          <button onClick={probar} style={{ padding: "6px 10px" }}>
            Probar
          </button>
        </div>

        {testOut && (
          <div style={{ marginTop: 10, fontSize: 14 }}>
            <div>
              <b>Fecha:</b> {testOut.fechaEvento}
            </div>
            <div>
              <b>Corte aplicado:</b> día {testOut.corteDia}
            </div>
            <div>
              <b>Periodo base:</b> {testOut.periodoBase}
            </div>
            <div>
              <b>Periodo destino:</b>{" "}
              <span style={{ fontWeight: 700 }}>{testOut.periodoDestino}</span>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
