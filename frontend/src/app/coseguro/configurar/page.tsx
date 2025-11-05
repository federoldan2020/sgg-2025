"use client";
import { useEffect, useState } from "react";
import { api, getErrorMessage } from "@/servicios/api";
import { mon } from "@/utiles/formatos";

type PadronLite = {
  id: number | string;
  padron: string;
  afiliadoId: number | string;
  activo: boolean;
};

export default function ConfigurarCoseguroPage() {
  const [afiliadoId, setAfiliadoId] = useState("");
  const [padrones, setPadrones] = useState<PadronLite[]>([]);
  const [padronCoseguroId, setPadronCoseguroId] = useState("");
  const [padronColateralesId, setPadronColateralesId] = useState("");
  const [fechaAlta, setFechaAlta] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const cargarPadrones = async () => {
    if (!afiliadoId) return setPadrones([]);
    const data = await api<PadronLite[]>(
      `/padrones?afiliadoId=${encodeURIComponent(afiliadoId)}`
    );
    setPadrones(data);
  };

  useEffect(() => {
    void cargarPadrones(); /* eslint-disable-next-line */
  }, [afiliadoId]);

  const guardar = async () => {
    try {
      await api("/coseguro/configurar", {
        method: "POST",
        body: JSON.stringify({
          afiliadoId: Number(afiliadoId),
          imputacionPadronIdCoseguro: padronCoseguroId
            ? Number(padronCoseguroId)
            : undefined,
          imputacionPadronIdColaterales: padronColateralesId
            ? Number(padronColateralesId)
            : undefined,
          fechaAlta: fechaAlta || undefined,
        }),
      });
      setMsg("Configuración guardada");
    } catch (e) {
      setMsg(getErrorMessage(e));
    }
  };

  return (
    <main style={{ padding: 24 }}>
      <h1>Configurar Coseguro</h1>

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
          placeholder="ID"
          style={{ width: 120 }}
        />
        <button onClick={cargarPadrones}>Cargar padrones</button>
      </div>

      {padrones.length > 0 && (
        <>
          <div style={{ marginBottom: 8 }}>
            <label>Padrón para COSEGURO</label>
            <br />
            <select
              value={padronCoseguroId}
              onChange={(e) => setPadronCoseguroId(e.target.value)}
            >
              <option value="">(sin imputación)</option>
              {padrones.map((p) => (
                <option key={String(p.id)} value={String(p.id)}>
                  {p.padron}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 8 }}>
            <label>Padrón para COLATERALES (J38)</label>
            <br />
            <select
              value={padronColateralesId}
              onChange={(e) => setPadronColateralesId(e.target.value)}
            >
              <option value="">(sin imputación)</option>
              {padrones.map((p) => (
                <option key={String(p.id)} value={String(p.id)}>
                  {p.padron}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 8 }}>
            <label>Fecha alta (YYYY-MM-DD)</label>
            <br />
            <input
              value={fechaAlta}
              onChange={(e) => setFechaAlta(e.target.value)}
              placeholder="YYYY-MM-DD"
            />
          </div>

          <button onClick={guardar}>Guardar</button>
        </>
      )}

      {msg && <p>{msg}</p>}
    </main>
  );
}
