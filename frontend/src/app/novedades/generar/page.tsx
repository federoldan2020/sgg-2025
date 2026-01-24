'use client';
import { useState } from 'react';
import { api, getErrorMessage, API_URL, ORG } from '@/servicios/api';
import { InputPeriodo } from '@/components/InputPeriodo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function GenerarNovedadesPage() {
  // Periodo por defecto: mes actual
  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const periodoHoy = `${today.getFullYear()}-${pad(today.getMonth() + 1)}`;

  const [periodo, setPeriodo] = useState(periodoHoy);
  const [sistema, setSistema] = useState<'ES' | 'SG'>('ES');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [res, setRes] = useState<{
    id: string;
    periodo: string;
    sistema: string;
    archivoNombre: string;
    totalRegistros: number;
    totalImporte: string;
  } | null>(null);

  const generar = async () => {
    if (!periodo || !/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo)) {
      setMsg('Período inválido (formato: YYYY-MM)');
      return;
    }

    setMsg(null);
    setLoading(true);
    try {
      const r = await api(
        `/novedades/generar?periodo=${encodeURIComponent(periodo)}&sistema=${sistema}`,
        { method: 'POST' }
      );
      setRes(r);
      setMsg('Novedades generadas correctamente');
    } catch (e) {
      setMsg(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const descargarTxt = async () => {
    if (!res?.id) return;

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

      const response = await fetch(`${API_URL}/novedades/generadas/${res.id}/txt`, {
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
      a.download = res.archivoNombre || `novedades_${periodo}_${sistema}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setMsg(getErrorMessage(e));
    }
  };

  return (
    <main className="p-6 max-w-3xl space-y-6">
      <h1 className="text-xl font-semibold">Generar Novedades</h1>

      <div className="space-y-4">
        {/* Periodo */}
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

        {/* Sistema */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Sistema</label>
          <select
            value={sistema}
            onChange={(e) => setSistema(e.target.value as 'ES' | 'SG')}
            className="h-9 w-40 rounded-md border border-input bg-background px-3 text-sm shadow-xs"
          >
            <option value="ES">ES - Escuela</option>
            <option value="SG">SG - Sueldos Generales</option>
          </select>
        </div>

        {/* Botón Generar */}
        <div>
          <Button onClick={generar} disabled={loading}>
            {loading ? 'Generando...' : 'Generar Novedades'}
          </Button>
        </div>

        {/* Mensajes */}
        {msg && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {msg}
          </div>
        )}

        {/* Resultado */}
        {res && (
          <div className="rounded-lg border border-border bg-card p-4 shadow-sm space-y-2">
            <h3 className="text-sm font-semibold">Generación Exitosa</h3>
            <p className="text-sm">
              <strong>ID:</strong> {res.id}
            </p>
            <p className="text-sm">
              <strong>Período:</strong> {res.periodo}
            </p>
            <p className="text-sm">
              <strong>Sistema:</strong> {res.sistema}
            </p>
            <p className="text-sm">
              <strong>Archivo:</strong> {res.archivoNombre}
            </p>
            <p className="text-sm">
              <strong>Registros:</strong> {res.totalRegistros}
            </p>
            <p className="text-sm">
              <strong>Total Importe:</strong>{' '}
              ${parseFloat(res.totalImporte).toLocaleString('es-AR', {
                minimumFractionDigits: 2,
              })}
            </p>
            <Button variant="secondary" onClick={descargarTxt}>
              Descargar TXT
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
