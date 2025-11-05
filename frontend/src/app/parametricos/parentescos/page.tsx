'use client';
import { useEffect, useState } from 'react';
import { api, getErrorMessage } from '@/servicios/api';
import type { Parentesco } from '@/tipos/modelos';

export default function ParentescosPage() {
  const [lista, setLista] = useState<Parentesco[]>([]);
  const [codigo, setCodigo] = useState<number>(0);
  const [desc, setDesc] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const cargar = async () => {
    const datos = await api<Parentesco[]>('/parametricos/parentescos');
    setLista(datos);
  };

  useEffect(() => { void cargar(); }, []);

  const crear = async () => {
    try {
      await api('/parametricos/parentescos', {
        method: 'POST',
        body: JSON.stringify({ codigo: Number(codigo), descripcion: desc }),
      });
      setCodigo(0);
      setDesc('');
      setMsg('Creado');
      await cargar();
    } catch (e) {
      setMsg(getErrorMessage(e));
    }
  };

  const toggle = async (id: Parentesco['id'], activo: boolean) => {
    try {
      await api(`/parametricos/parentescos/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ activo: !activo }),
      });
      await cargar();
    } catch (e) {
      setMsg(getErrorMessage(e));
    }
  };

  return (
    <main style={{ padding: 24 }}>
      <h1>Parentescos</h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          type="number"
          value={codigo}
          onChange={(e) => setCodigo(Number(e.target.value))}
          placeholder="Código"
        />
        <input
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Descripción"
        />
        <button onClick={crear}>Crear</button>
      </div>

      <ul>
        {lista.map((p) => (
          <li key={String(p.id)}>
            {p.codigo} - {p.descripcion} [{p.activo ? 'activo' : 'inactivo'}]
            <button onClick={() => toggle(p.id, p.activo)} style={{ marginLeft: 8 }}>
              Toggle
            </button>
          </li>
        ))}
      </ul>

      {msg && <p>{msg}</p>}
    </main>
  );
}