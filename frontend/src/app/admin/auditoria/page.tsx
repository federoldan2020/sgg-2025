'use client';

import { useEffect, useState } from 'react';
import AuthGate from '@/components/auth/AuthGate';
import { api, getErrorMessage } from '@/servicios/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type EventoAuditoria = {
  id: string;
  organizacionId?: string | null;
  usuarioId?: string | null;
  accion: string;
  entidad: string;
  entidadId?: string | null;
  payloadAntes?: unknown;
  payloadDespues?: unknown;
  ipAddress?: string | null;
  creadoEn: string;
};

type Respuesta = {
  eventos: EventoAuditoria[];
  total: number;
  limit: number;
  offset: number;
};

export default function AdminAuditoriaPage() {
  const [data, setData] = useState<Respuesta | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const cargar = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      params.set('offset', String(offset));
      const resp = await api<Respuesta>(`/auditoria?${params.toString()}`);
      setData(resp);
    } catch (e) {
      setMsg(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void cargar();
  }, [offset]);

  return (
    <AuthGate roles={['ADMIN', 'SUPERADMIN']}>
      <main className="p-6 max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Auditoría</h1>

        {msg && (
          <div className="mb-4 p-3 rounded bg-red-100 text-red-800">{msg}</div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Eventos recientes</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p>Cargando…</p>
            ) : data ? (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Acción</TableHead>
                      <TableHead>Entidad</TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead>Usuario</TableHead>
                      <TableHead>IP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.eventos.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>
                          {new Date(e.creadoEn).toLocaleString('es-AR')}
                        </TableCell>
                        <TableCell>{e.accion}</TableCell>
                        <TableCell>{e.entidad}</TableCell>
                        <TableCell className="font-mono text-xs">{e.entidadId || '-'}</TableCell>
                        <TableCell>{e.usuarioId || '-'}</TableCell>
                        <TableCell>{e.ipAddress || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="flex justify-between items-center mt-4">
                  <span className="text-sm text-gray-500">
                    Mostrando {data.eventos.length} de {data.total}
                  </span>
                  <div className="flex gap-2">
                    <button
                      className="px-3 py-1 border rounded disabled:opacity-50"
                      disabled={offset === 0}
                      onClick={() => setOffset((o) => Math.max(0, o - limit))}
                    >
                      Anterior
                    </button>
                    <button
                      className="px-3 py-1 border rounded disabled:opacity-50"
                      disabled={offset + limit >= data.total}
                      onClick={() => setOffset((o) => o + limit)}
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <p>Sin datos</p>
            )}
          </CardContent>
        </Card>
      </main>
    </AuthGate>
  );
}
