'use client';
import { useState } from 'react';
import { api, getErrorMessage } from '@/servicios/api';
import type { CrearObligacionDto, CrearObligacionResp } from '@/tipos/dtos';

export default function NuevaObligacionPage() {
  const [afiliadoId, setAfiliadoId] = useState('');
  const [padronId, setPadronId] = useState('');
  const [conceptoCodigo, setConceptoCodigo] = useState('CUOTA_SOC');
  const [periodo, setPeriodo] = useState('2025-09');
  const [monto, setMonto] = useState('10000');
  const [msg, setMsg] = useState<string | null>(null);

  const crear = async () => {
    try {
      const payload: CrearObligacionDto = {
        afiliadoId: Number(afiliadoId),
        padronId: padronId ? Number(padronId) : undefined,
        conceptoCodigo,
        periodo,
        monto: Number(monto),
      };
      const r = await api<CrearObligacionResp>('/obligaciones', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setMsg(`Obligación creada: ID ${String(r.id)}`);
    } catch (e: unknown) {
      setMsg(`Error: ${getErrorMessage(e)}`);
    }
  };

  return (
    <main style={{ padding: 24 }}>
      <h1>Nueva Obligación</h1>
      <label>ID Afiliado</label><br/>
      <input value={afiliadoId} onChange={(e) => setAfiliadoId(e.target.value)} /><br/>
      <label>ID Padrón (opcional)</label><br/>
      <input value={padronId} onChange={(e) => setPadronId(e.target.value)} /><br/>
      <label>Concepto</label><br/>
      <input value={conceptoCodigo} onChange={(e) => setConceptoCodigo(e.target.value)} /><br/>
      <label>Período</label><br/>
      <input value={periodo} onChange={(e) => setPeriodo(e.target.value)} /><br/>
      <label>Monto</label><br/>
      <input value={monto} onChange={(e) => setMonto(e.target.value)} /><br/>
      <button onClick={crear}>Crear</button>
      {msg && <p>{msg}</p>}
    </main>
  );
}
