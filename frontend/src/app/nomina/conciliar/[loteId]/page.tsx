/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';
import { useEffect, useState } from 'react';
import { api, getErrorMessage } from '@/servicios/api';

export default function LoteNominaDetalle({ params }: { params: { loteId: string } }) {
  const [data, setData] = useState<any>(null);
  const [msg, setMsg] = useState<string|null>(null);

  useEffect(() => {
    (async () => {
      try { setData(await api(`/nomina/lotes/${params.loteId}`)); }
      catch (e) { setMsg(getErrorMessage(e)); }
    })();
  }, [params.loteId]);

  return (
    <main style={{ padding: 24 }}>
      <h1>Lote Nómina #{params.loteId}</h1>
      {msg && <p>{msg}</p>}
      {data && (
        <>
          <p><b>Período:</b> {data.periodo} | <b>Estado:</b> {data.estado}</p>
          <ul>
            {data.detalles?.map((d: any) => (
              <li key={d.id}>
                Afiliado {d.afiliadoId} | Padron {d.padronId ?? '-'} | {d.codigo} | ${d.monto}
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}