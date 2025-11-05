'use client';
import { useState } from 'react';
import { api, getErrorMessage } from '@/servicios/api';

export default function GenerarNovedadesPage() {
  const [periodo, setPeriodo] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [res, setRes] = useState<any>(null);
  const [msg, setMsg] = useState<string|null>(null);

  const generar = async () => {
    setMsg(null);
    try {
      const r = await api(`/novedades/generar?periodo=${encodeURIComponent(periodo)}`, { method: 'POST' });
      setRes(r);
    } catch (e) { setMsg(getErrorMessage(e)); }
  };

  const descargar = () => {
    if (!res?.csv) return;
    const blob = new Blob([res.csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `novedades_${periodo}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main style={{ padding: 24 }}>
      <h1>Generar Novedades</h1>
      <input placeholder="YYYY-MM" value={periodo} onChange={(e)=>setPeriodo(e.target.value)} />
      <button onClick={generar} style={{ marginLeft: 8 }}>Generar</button>
      {msg && <p>{msg}</p>}
      {res && (
        <div style={{ marginTop: 16 }}>
          <p><b>Lote:</b> {res.loteId} | <b>Período:</b> {res.periodo}</p>
          <p><b>Registros:</b> {res.totalRegistros} | <b>Total:</b> ${res.totalImporte}</p>
          <button onClick={descargar}>Descargar CSV</button>
        </div>
      )}
    </main>
  );
}
