/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api, getErrorMessage } from '@/servicios/api';

export default function LoteNominaDetalle() {
  const { loteId } = useParams<{ loteId: string }>();
  const [data, setData] = useState<any>(null);
  const [msg, setMsg] = useState<string|null>(null);

  useEffect(() => {
    if (!loteId) return;
    (async () => {
      try { setData(await api(`/nomina/lotes/${loteId}`)); }
      catch (e) { setMsg(getErrorMessage(e)); }
    })();
  }, [loteId]);

  return (
    <main style={{ padding: 24 }}>
      <h1>Lote Nómina #{loteId}</h1>
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