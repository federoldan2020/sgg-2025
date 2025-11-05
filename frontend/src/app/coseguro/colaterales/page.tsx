'use client';
import { useState } from 'react';
import { api, getErrorMessage } from '@/servicios/api';

type Item = { parentescoCodigo: number; nombre: string; fechaNacimiento?: string };

export default function ColateralesPage() {
  const [afiliadoId, setAfiliadoId] = useState('');
  const [items, setItems] = useState<Item[]>([
    { parentescoCodigo: 2, nombre: '', fechaNacimiento: '' }, // 2 = HIJO/A
  ]);
  const [msg, setMsg] = useState<string | null>(null);

  const agregar = () =>
    setItems([...items, { parentescoCodigo: 2, nombre: '', fechaNacimiento: '' }]);

  const guardar = async () => {
    try {
      await api('/coseguro/colaterales', {
        method: 'POST',
        body: JSON.stringify({
          afiliadoId: Number(afiliadoId),
          items: items.map((i) => ({
            parentescoCodigo: Number(i.parentescoCodigo),
            nombre: i.nombre,
            fechaNacimiento: i.fechaNacimiento || undefined,
          })),
        }),
      });
      setMsg('Colaterales cargados');
    } catch (e) {
      setMsg(getErrorMessage(e));
    }
  };

  return (
    <main style={{ padding: 24 }}>
      <h1>Colaterales</h1>
      <label>Afiliado ID</label><br/>
      <input value={afiliadoId} onChange={(e) => setAfiliadoId(e.target.value)} /><br/>
      <h3>Listado</h3>
      {items.map((it, idx) => (
        <div key={idx} style={{ marginBottom: 8 }}>
          <select
            value={it.parentescoCodigo}
            onChange={(e) => {
              const v = [...items];
              v[idx].parentescoCodigo = Number(e.target.value);
              setItems(v);
            }}
          >
            <option value={1}>1 - CONYUGE</option>
            <option value={2}>2 - HIJO/A</option>
            <option value={3}>3 - PADRE/MADRE</option>
            <option value={4}>4 - HERMANO/A</option>
            <option value={6}>6 - HIJO DISCAPACITADO</option>
            <option value={7}>7 - SUEGRO/A</option>
            <option value={8}>8 - HIJO/A DISC (MAYOR 26)</option>
            <option value={9}>9 - NIETO/A MENOR TENENCIA</option>
            <option value={10}>10 - HIJO DISC (21-26)</option>
            <option value={11}>11 - CONY.C/AP Y/O ADM.PUBL</option>
          </select>
          <input
            placeholder="Nombre"
            value={it.nombre}
            onChange={(e) => {
              const v = [...items]; v[idx].nombre = e.target.value; setItems(v);
            }}
          />
          <input
            placeholder="Fecha Nac. yyyy-mm-dd"
            value={it.fechaNacimiento}
            onChange={(e) => {
              const v = [...items]; v[idx].fechaNacimiento = e.target.value; setItems(v);
            }}
          />
        </div>
      ))}
      <button onClick={agregar}>+ Agregar</button>
      <br/><br/>
      <button onClick={guardar}>Guardar</button>
      {msg && <p>{msg}</p>}
    </main>
  );
}