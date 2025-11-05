'use client';
import { useState } from 'react';
import { api, getErrorMessage } from '@/servicios/api';

type Item = { afiliadoId?: number; dni?: number; padronId?: number; codigo: string; monto: number; };

export default function ConciliarNominaNuevo() {
  const [periodo, setPeriodo] = useState('');
  const [texto, setTexto] = useState(''); // pegar CSV/TXT provisional
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [preview, setPreview] = useState<any>(null);
  const [msg, setMsg] = useState<string|null>(null);

  const parse = (): Item[] => {
    // Formato tentativo: dni;codigo;monto
    return texto.split('\n').map(l => l.trim()).filter(Boolean).map(linea => {
      const [dni, codigo, monto] = linea.split(/[;,]+/).map(s=>s.trim());
      return { dni: Number(dni), codigo, monto: Number(monto) };
    });
  };

  const enviarPreview = async () => {
    setMsg(null);
    try {
      const items = parse();
      const r = await api('/nomina/preview', {
        method: 'POST',
        body: JSON.stringify({ periodo, items }),
      });
      setPreview(r);
    } catch (e) { setMsg(getErrorMessage(e)); }
  };

  const confirmar = async () => {
    if (!preview?.loteId) return;
    try {
      await api(`/nomina/confirmar/${preview.loteId}`, { method: 'POST' });
      setMsg('Conciliación confirmada.');
    } catch (e) { setMsg(getErrorMessage(e)); }
  };

  return (
    <main style={{ padding: 24 }}>
      <h1>Conciliar Nómina (preview)</h1>
      <input placeholder="YYYY-MM" value={periodo} onChange={(e)=>setPeriodo(e.target.value)} />
      <br/><br/>
      <textarea value={texto} onChange={(e)=>setTexto(e.target.value)} placeholder="Pega líneas: dni;codigo;monto" rows={8} cols={80} />
      <br/>
      <button onClick={enviarPreview}>Previsualizar</button>
      {msg && <p>{msg}</p>}
      {preview && (
        <div style={{ marginTop: 16 }}>
          <p><b>Lote:</b> {preview.loteId} | <b>Período:</b> {periodo}</p>
          {/* Renderiza resumen si el service lo devuelve */}
          <button onClick={confirmar}>Confirmar conciliación</button>
        </div>
      )}
    </main>
  );
}