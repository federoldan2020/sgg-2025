'use client';
import { useState, useEffect, useMemo } from 'react';
import { api, getErrorMessage, API_URL, ORG } from '@/servicios/api';
import { formatearPeriodoArgentina } from '@/utiles/formatos';
import { InputPeriodo } from '@/components/InputPeriodo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';

type Generada = {
  id: string;
  periodo: string;
  sistema: string;
  archivoNombre: string;
  totalRegistros: number;
  totalImporte: string;
  generadoPor: string | null;
  generadoEn: string;
};

type Paged<T> = { items: T[]; total: number; page: number; limit: number };

function qs(params: Record<string, any>) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') {
      q.set(k, String(v));
    }
  });
  return q.toString();
}

export default function NovedadesGeneradasPage() {
  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const periodoHoy = `${today.getFullYear()}-${pad(today.getMonth() + 1)}`;

  const [periodo, setPeriodo] = useState(periodoHoy);
  const [sistema, setSistema] = useState<'' | 'ES' | 'SG'>('');
  const [page, setPage] = useState(1);
  const [limit] = useState(20);

  const [items, setItems] = useState<Generada[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const listQS = useMemo(
    () =>
      qs({
        periodo,
        sistema: sistema || undefined,
        page,
        limit,
      }),
    [periodo, sistema, page, limit]
  );

  const cargar = async () => {
    setMsg(null);
    setLoading(true);
    try {
      const data = (await api(`/novedades/generadas?${listQS}`, {
        method: 'GET',
      })) as Paged<Generada>;
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (e) {
      setMsg(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [periodo, sistema]);

  useEffect(() => {
    void cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listQS]);

  const descargarTxt = async (id: string, nombre: string) => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

      const response = await fetch(`${API_URL}/novedades/generadas/${id}/txt`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
          'X-Organizacion-ID': ORG,
        },
      });

      if (!response.ok) throw new Error('Error al descargar');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombre;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setMsg(getErrorMessage(e));
    }
  };

  const eliminarGeneracion = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar esta generación de novedades?')) return;

    setMsg(null);
    setLoading(true);
    try {
      await api(`/novedades/generadas/${id}`, { method: 'DELETE' });
      void cargar(); // Recargar la lista
    } catch (e) {
      setMsg(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const lastPage = Math.max(1, Math.ceil((total || 0) / (limit || 20)));

  return (
    <main className="p-6 max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Generaciones de Novedades</h1>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            Período (mm/aa)
          </label>
          <InputPeriodo
            value={periodo}
            onChange={(periodoISO) => setPeriodo(periodoISO)}
            placeholder="mm/aa"
            className="w-40"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Sistema</label>
          <select
            value={sistema}
            onChange={(e) => setSistema(e.target.value as '' | 'ES' | 'SG')}
            className="h-9 w-40 rounded-md border border-input bg-background px-3 text-sm shadow-xs"
          >
            <option value="">Todos</option>
            <option value="ES">ES - Escuela</option>
            <option value="SG">SG - Sueldos Generales</option>
          </select>
        </div>
      </div>

      {msg && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {msg}
        </div>
      )}

      {/* Tabla */}
      <div className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay generaciones para mostrar</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Período</TableHead>
                  <TableHead>Sistema</TableHead>
                  <TableHead>Archivo</TableHead>
                  <TableHead className="text-right">Registros</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Generado</TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{formatearPeriodoArgentina(item.periodo)}</TableCell>
                    <TableCell>{item.sistema}</TableCell>
                    <TableCell>{item.archivoNombre}</TableCell>
                    <TableCell className="text-right">{item.totalRegistros}</TableCell>
                    <TableCell className="text-right">
                      ${parseFloat(item.totalImporte).toLocaleString('es-AR', {
                        minimumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell>{new Date(item.generadoEn).toLocaleString('es-AR')}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-2">
                        <Button size="sm" onClick={() => descargarTxt(item.id, item.archivoNombre)}>
                          Descargar
                        </Button>
                        <Button
                          size="sm"
                          variant="error"
                          onClick={() => eliminarGeneracion(item.id)}
                          disabled={loading}
                        >
                          Eliminar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Paginación */}
            {lastPage > 1 && (
              <div className="flex items-center gap-3 text-sm">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Anterior
                </Button>
                <span className="text-muted-foreground">
                  Página {page} de {lastPage} (Total: {total})
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                  disabled={page >= lastPage}
                >
                  Siguiente
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

