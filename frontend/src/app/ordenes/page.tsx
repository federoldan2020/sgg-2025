'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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
    <main className="p-6 max-w-lg space-y-4">
      <h1 className="text-xl font-semibold">Órdenes por afiliado</h1>

      <div className="space-y-2">
        <label htmlFor="afiliadoId" className="text-xs font-medium text-muted-foreground">
          ID de afiliado
        </label>
        <Input
          id="afiliadoId"
          value={afiliadoId}
          onChange={(e) => setAfiliadoId(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') ir();
          }}
          placeholder="Ej: 1001"
        />
      </div>

      <Button onClick={ir}>Ver órdenes</Button>

      {error && (
        <p className="text-sm text-destructive">
          {error}
        </p>
      )}

      <p className="text-sm text-muted-foreground">
        Ingresá el ID y presioná Enter o el botón para ver las órdenes del afiliado.
      </p>
    </main>
  );
}
