'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

export default function OrdenesHomePage() {
  const router = useRouter();
  const [afiliadoId, setAfiliadoId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const ir = useCallback(() => {
    const id = afiliadoId.trim();
    if (!id) {
      setError('Ingresá un ID de afiliado');
      return;
    }
    setError(null);
    router.push(`/ordenes/${encodeURIComponent(id)}`);
  }, [router, afiliadoId]);

  return (
    <main style={{ padding: 24, maxWidth: 520 }}>
      <h1 style={{ marginBottom: 16 }}>Órdenes por afiliado</h1>

      <label htmlFor="afiliadoId">ID de afiliado</label>
      <input
        id="afiliadoId"
        value={afiliadoId}
        onChange={(e) => setAfiliadoId(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') ir();
        }}
        placeholder="Ej: 1001"
        style={{
          display: 'block',
          width: '100%',
          padding: '8px 10px',
          marginTop: 6,
          marginBottom: 10,
          border: '1px solid #ccc',
          borderRadius: 4,
        }}
      />

      <button onClick={ir} style={{ padding: '8px 14px' }}>
        Ver órdenes
      </button>

      {error && (
        <p style={{ color: 'crimson', marginTop: 12 }}>
          {error}
        </p>
      )}

      <p style={{ marginTop: 16, color: '#666', fontSize: 14 }}>
        Ingresá el ID y presioná Enter o el botón para ver las órdenes del afiliado.
      </p>
    </main>
  );
}
