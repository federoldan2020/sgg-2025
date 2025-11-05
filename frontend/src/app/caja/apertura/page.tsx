"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cajaService } from "@/servicios/cajaService";
import { getErrorMessage } from "@/servicios/api";

export default function AperturaCajaPage() {
  const router = useRouter();
  const [opening, setOpening] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const st = await cajaService.estado();
      if (st.abierta && st.cajaId) router.replace("/caja");
    })();
  }, [router]);

  const abrir = async () => {
    try {
      setOpening(true);
      const r = await cajaService.abrir("Central");
      setMsg(`Caja #${String(r.id)} abierta correctamente.`);
      router.replace("/caja");
    } catch (e) {
      setMsg(getErrorMessage(e));
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold mb-2">Apertura de Caja</h1>
      <p className="text-sm text-muted-foreground mb-6">Abrí la caja para habilitar cobros.</p>
      {msg && <div className="mb-4">{msg}</div>}
      <button className="btn btn-primary" onClick={abrir} disabled={opening}>
        {opening ? "Abriendo…" : "Abrir Caja"}
      </button>
    </div>
  );
}
