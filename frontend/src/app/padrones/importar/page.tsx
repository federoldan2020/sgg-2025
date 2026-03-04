'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { API_URL, getErrorMessage } from '@/servicios/api';

type OperacionPreview = {
  fila: number;
  operacion: 'CREAR' | 'ACTUALIZAR' | 'ERROR' | 'WARNING';
  dni: string;
  padron: string;
  status: 'OK' | 'ERROR' | 'WARNING';
  mensaje?: string;
};

type ImportPreviewResponse = {
  previewId: string;
  resumen: {
    total: number;
    aCrear: number;
    aActualizar: number;
    errores: number;
    warnings: number;
  };
  operaciones: OperacionPreview[];
  puedeConfirmar: boolean;
};

type ImportConfirmResponse = {
  exitoso: boolean;
  resumen: { total: number; creados: number; actualizados: number; errores: number };
  errores?: Array<{ fila: number; mensaje: string }>;
};

export default function ImportarPadronesPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const orgId = typeof window !== 'undefined' ? (localStorage.getItem('orgId') || process.env.NEXT_PUBLIC_TENANT_ID || '') : '';
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') || '' : '';

  const upload = async (endpoint: string, body: FormData) => {
    const r = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      body,
      headers: {
        'X-Organizacion-ID': orgId,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json() as Promise<ImportPreviewResponse>;
  };

  const onPreview = async () => {
    if (!file) return;
    setLoading(true); setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('mode', 'upsert');
      const data = await upload('/padrones/import/preview', fd);
      setPreview(data);
    } catch (e: unknown) { setError(getErrorMessage(e)); }
    finally { setLoading(false); }
  };

  const onConfirm = async () => {
    if (!preview) return;
    setLoading(true); setError(null);
    try {
      const r = await fetch(`${API_URL}/padrones/import/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Organizacion-ID': orgId, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ previewId: preview.previewId }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data: ImportConfirmResponse = await r.json();
      setPreview(null);
      if (data.exitoso) {
        alert(`Importación: creados ${data.resumen.creados}, actualizados ${data.resumen.actualizados}`);
      } else {
        alert(`Importación con errores: ${data.resumen.errores}`);
      }
    } catch (e: unknown) { setError(getErrorMessage(e)); }
    finally { setLoading(false); }
  };

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Importar Padrones</CardTitle>
          <CardDescription>Cargá el CSV según la plantilla y previsualizá los cambios</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <Button onClick={onPreview} disabled={!file || loading}>Previsualizar</Button>
            <a href={`${API_URL}/padrones/import/template`} className="text-blue-600 underline" target="_blank" rel="noreferrer">Descargar plantilla</a>
            <a href={`${API_URL}/padrones/import/ejemplo`} className="text-blue-600 underline" target="_blank" rel="noreferrer">Descargar ejemplo</a>
          </div>

          {error && <div className="text-red-600">{error}</div>}

          {preview && (
            <div className="space-y-4">
              <div className="flex gap-6 text-sm">
                <div>Totales: <b>{preview.resumen.total}</b></div>
                <div className="text-green-700">Crear: <b>{preview.resumen.aCrear}</b></div>
                <div className="text-yellow-700">Actualizar: <b>{preview.resumen.aActualizar}</b></div>
                <div className="text-red-700">Errores: <b>{preview.resumen.errores}</b></div>
                <div className="text-amber-700">Warnings: <b>{preview.resumen.warnings}</b></div>
              </div>

              <div className="border rounded-md overflow-auto max-h-[60vh]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fila</TableHead>
                      <TableHead>Operación</TableHead>
                      <TableHead>DNI</TableHead>
                      <TableHead>Padrón</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Mensaje</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.operaciones.map((op: OperacionPreview, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell>{op.fila}</TableCell>
                        <TableCell>
                          <Badge variant={op.operacion === 'CREAR' ? 'default' : op.operacion === 'ACTUALIZAR' ? 'secondary' : 'error'}>
                            {op.operacion}
                          </Badge>
                        </TableCell>
                        <TableCell>{op.dni}</TableCell>
                        <TableCell>{op.padron}</TableCell>
                        <TableCell>{op.status}</TableCell>
                        <TableCell className="max-w-xl whitespace-pre-wrap text-xs">{op.mensaje || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex gap-3">
                <Button onClick={onConfirm} disabled={!preview.puedeConfirmar || loading}>
                  Confirmar importación
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
