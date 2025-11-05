"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { cajaService } from "@/servicios/cajaService";
import { getErrorMessage } from "@/servicios/api";

type Row = { metodo: string; teorico: string; declarado: string };

export default function CierreCajaPage() {
  const router = useRouter();
  const [cajaId, setCajaId] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([
    { metodo: "efectivo", teorico: "0", declarado: "0" },
    { metodo: "tarjeta", teorico: "0", declarado: "0" },
    { metodo: "mercadopago", teorico: "0", declarado: "0" },
  ]);
  const [msg, setMsg] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    (async () => {
      const st = await cajaService.estado();
      if (!st.abierta || !st.cajaId) return router.replace("/caja/apertura");
      setCajaId(st.cajaId);
    })();
  }, [router]);

  const toNum = (v: string) => (Number.isFinite(+v) ? parseFloat(v) : parseFloat(String(v).replace(",", ".")) || 0);
  const fmt = (n: number) => new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  const diffTotal = useMemo(() => rows.reduce((a, r) => a + (toNum(r.declarado) - toNum(r.teorico)), 0), [rows]);

  const cerrar = async () => {
    try {
      if (!cajaId) return;
      setClosing(true);
      const r = await cajaService.cerrarLote(cajaId, rows.map(r => ({
        metodo: r.metodo || null, declarado: toNum(r.declarado), teorico: toNum(r.teorico)
      })));
      setMsg(r.asientoId ? `Cierre OK. Δ $${fmt(r.diff)}. Asiento #${r.asientoId}` : `Cierre sin diferencias. Δ $${fmt(r.diff)}`);
      router.replace("/caja/apertura");
    } catch (e) {
      setMsg(`Error en cierre: ${getErrorMessage(e)}`);
    } finally {
      setClosing(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Cierre de Caja</h1>
          <p className="text-sm text-muted-foreground">Caja #{cajaId ?? "-"}</p>
        </div>
        <button className="btn" onClick={() => router.push("/caja")}>Volver a cobros</button>
      </div>

      {msg && <div className={`text-sm ${msg.startsWith("Error") ? "text-red-600" : "text-green-700"}`}>{msg}</div>}

      <div className="overflow-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50">
            <tr>
              <th className="p-2 text-left">Método</th>
              <th className="p-2 text-right">Teórico</th>
              <th className="p-2 text-right">Declarado</th>
              <th className="p-2 text-right">Δ</th>
              <th className="p-2 text-center">—</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const d = toNum(r.declarado) - toNum(r.teorico);
              return (
                <tr key={i} className="border-t">
                  <td className="p-2">
                    <select className="border rounded px-2 py-1" value={r.metodo}
                            onChange={(e) => { const v = [...rows]; v[i].metodo = e.target.value; setRows(v); }}>
                      <option value="efectivo">Efectivo</option>
                      <option value="tarjeta">Tarjeta</option>
                      <option value="mercadopago">MercadoPago</option>
                      <option value="otro">Otro</option>
                    </select>
                  </td>
                  <td className="p-2 text-right">
                    <input className="w-32 text-right border rounded px-2 py-1" type="number" step="0.01"
                           value={r.teorico} onChange={(e) => { const v = [...rows]; v[i].teorico = e.target.value; setRows(v); }} />
                  </td>
                  <td className="p-2 text-right">
                    <input className="w-32 text-right border rounded px-2 py-1" type="number" step="0.01"
                           value={r.declarado} onChange={(e) => { const v = [...rows]; v[i].declarado = e.target.value; setRows(v); }} />
                  </td>
                  <td className={`p-2 text-right ${Math.abs(d) > 0.01 ? "text-red-600" : "text-green-700"}`}>$ {fmt(d)}</td>
                  <td className="p-2 text-center">
                    <button className="btn btn-ghost btn-sm" onClick={() => setRows(rows.filter((_, j) => j !== i))}
                            disabled={rows.length <= 1}>Eliminar</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t bg-neutral-50">
              <td className="p-2" colSpan={3}><b>Total diferencia</b></td>
              <td className="p-2 text-right"><b>$ {fmt(diffTotal)}</b></td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <button className="btn btn-warning" onClick={cerrar} disabled={closing}>
        {closing ? "Cerrando…" : "Confirmar Cierre"}
      </button>
    </div>
  );
}
