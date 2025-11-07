
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, getErrorMessage } from "@/servicios/api";

type Linea = { id: string; cuenta: string; debe: number; haber: number };
type Detalle = {
  id: string;
  fecha: string;
  descripcion: string | null;
  origen: string | null;
  referenciaId: string | null;
  lineas: Linea[];
  totalDebe: number;
  totalHaber: number;
};

export default function AsientoDetallePage() {
  const { asientosId } = useParams<{ asientosId: string }>();
  const [det, setDet] = useState<Detalle | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!asientosId) return;
    (async () => {
      try {
        const r = await api<Detalle>(`/contabilidad/asientos/${asientosId}`);
        setDet(r);
      } catch (e) {
        setMsg(getErrorMessage(e));
      }
    })();
  }, [asientosId]);

  if (msg) {
    return (
      <main style={{ padding: 24 }}>
        <p style={{ color: "crimson" }}>{msg}</p>
      </main>
    );
  }
  if (!det) {
    return (
      <main style={{ padding: 24 }}>
        <p>Cargando…</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>Asiento #{det.id}</h1>
      <p>
        <b>Fecha:</b> {new Date(det.fecha).toLocaleString()} <br />
        <b>Origen:</b> {det.origen} <br />
        <b>Referencia:</b> {det.referenciaId ?? "—"} <br />
        <b>Descripción:</b> {det.descripcion ?? "—"}
      </p>

      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
        <thead>
          <tr>
            <th align="left">Cuenta</th>
            <th align="right">Debe</th>
            <th align="right">Haber</th>
          </tr>
        </thead>
        <tbody>
          {det.lineas.map((l) => (
            <tr key={l.id} style={{ borderTop: "1px solid #eee" }}>
              <td><code>{l.cuenta}</code></td>
              <td align="right">{Number(l.debe).toFixed(2)}</td>
              <td align="right">{Number(l.haber).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: "2px solid #000" }}>
            <td align="right"><b>Totales</b></td>
            <td align="right"><b>{Number(det.totalDebe).toFixed(2)}</b></td>
            <td align="right"><b>{Number(det.totalHaber).toFixed(2)}</b></td>
          </tr>
        </tfoot>
      </table>
    </main>
  );
}
