"use client";

import { useEffect, useState } from "react";
import { api, getErrorMessage } from "@/servicios/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
    <main className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">Fecha de corte (por periodo)</h1>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Periodo (YYYY-MM)
            </label>
            <Input
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              placeholder="YYYY-MM"
              className="w-40"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Día de corte
            </label>
            <Input
              type="number"
              min={1}
              max={31}
              value={diaCorte}
              onChange={(e) => setDiaCorte(Number(e.target.value))}
              className="w-28"
            />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={cargar}>
              Recargar
            </Button>
            <Button onClick={guardar} disabled={loading}>
              {loading ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </div>

        {msg && (
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            {msg}
          </div>
        )}
      </section>

      {/* Tester de resolución */}
      <section className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="text-sm font-semibold">Probar resolución de periodo</div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-medium text-muted-foreground">Fecha de evento</label>
          <Input
            type="date"
            value={fechaTest}
            onChange={(e) => setFechaTest(e.target.value)}
            className="w-44"
          />
          <Button variant="outline" onClick={probar}>
            Probar
          </Button>
        </div>

        {testOut && (
          <div className="text-sm space-y-1">
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
              <b>Periodo destino:</b> <span className="font-semibold">{testOut.periodoDestino}</span>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
