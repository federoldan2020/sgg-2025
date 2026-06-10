'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { api, apiFetch, getErrorMessage } from '@/servicios/api';

type OperacionPreview = {
  fila: number;
  operacion: 'CREAR' | 'ACTUALIZAR' | 'ERROR' | 'WARNING';
  dniTitular?: string;
  nombreFamiliar?: string;
  status: 'OK' | 'ERROR' | 'WARNING';
  mensaje?: string;
  continuar?: boolean;
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

export default function ImportarFamiliaresPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [ignoreWarnings, setIgnoreWarnings] = useState(false);
  const [importErrors, setImportErrors] = useState<Array<{ fila: number; mensaje: string }> | null>(null);

  const upload = async (endpoint: string, body: FormData) => {
    const r = await apiFetch(endpoint, {
      method: 'POST',
      body,
    }, { includeJsonContentType: false });
    return r.json() as Promise<ImportPreviewResponse>;
  };

  const downloadFile = async (endpoint: string, fallbackName: string) => {
    setError(null);
    try {
      const response = await apiFetch(endpoint, { method: 'GET' }, { includeJsonContentType: false });
      const blob = await response.blob();
      const disposition = response.headers.get('content-disposition') || '';
      const match = disposition.match(/filename="([^"]+)"/i);
      const filename = match?.[1] || fallbackName;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    }
  };

  const onPreview = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('mode', 'upsert');
      const data = await upload('/colaterales/import/preview', fd);
      setPreview(data);
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const onConfirm = async () => {
    if (!preview) return;
    setLoading(true);
    setError(null);
    setImportErrors(null);
    setProgress(5);
    const ticker = window.setInterval(() => {
      setProgress((p) => (p >= 95 ? p : p + Math.max(1, Math.floor((95 - p) / 6))));
    }, 350);
    try {
      const data = await api<{ resumen: { creados: number; actualizados: number; errores: number }; errores?: Array<{ fila: number; mensaje: string }> }>('/colaterales/import/confirm', {
        method: 'POST',
        body: JSON.stringify({ previewId: preview.previewId, ignoreWarnings }),
      });
      setPreview(null);
      setProgress(100);
      if (data.resumen?.errores && data.resumen.errores > 0) {
        // Importación parcial: algunos se importaron, otros tuvieron errores
        const totalProcesados = (data.resumen.creados || 0) + (data.resumen.actualizados || 0);
        if (totalProcesados > 0) {
          setError(
            `Importación parcial: ${totalProcesados} registros procesados correctamente (${data.resumen.creados} creados, ${data.resumen.actualizados} actualizados), ${data.resumen.errores} con errores`,
          );
        } else {
          setError(
            `Importación fallida: todos los registros tuvieron errores (${data.resumen.errores} errores)`,
          );
        }
        if (Array.isArray(data.errores)) {
          setImportErrors(data.errores);
        }
      } else {
        // Importación completamente exitosa
        alert(`Importación exitosa: ${data.resumen.creados} creados, ${data.resumen.actualizados} actualizados`);
      }
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    } finally {
      window.clearInterval(ticker);
      setTimeout(() => setProgress(0), 800);
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Importar Familiares</CardTitle>
          <CardDescription>
            Cargá el CSV o XLSX según la plantilla y previsualizá los cambios antes de confirmar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <input
              type="file"
              accept=".csv,.xlsx"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="text-sm"
            />
            <Button onClick={onPreview} disabled={!file || loading}>
              Previsualizar
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                void downloadFile('/colaterales/import/template.xlsx', 'plantilla_familiares.xlsx')
              }
              disabled={loading}
            >
              Descargar plantilla
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                void downloadFile('/colaterales/import/ejemplo.xlsx', 'ejemplo_familiares.xlsx')
              }
              disabled={loading}
            >
              Descargar ejemplo
            </Button>
          </div>

          {error && (
            <div
              className={`p-3 rounded-md ${
                error.includes('parcial') && !error.includes('fallida')
                  ? 'text-amber-700 bg-amber-50 border border-amber-200'
                  : 'text-red-600 bg-red-50 border border-red-200'
              }`}
            >
              {error}
            </div>
          )}
          {importErrors && importErrors.length > 0 && (
            <div className="border rounded-md p-3 text-sm text-red-700 bg-red-50">
              <div className="font-semibold mb-2">Errores de importación (primeros 50)</div>
              <div className="max-h-64 overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      <th className="text-left pr-3">Fila</th>
                      <th className="text-left">Mensaje</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importErrors.slice(0, 50).map((e, i) => (
                      <tr key={`${e.fila}-${i}`}>
                        <td className="pr-3">{e.fila}</td>
                        <td>{e.mensaje}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {loading && progress > 0 && (
            <div className="space-y-2">
              <div className="text-xs text-slate-500">
                Procesando importación... {progress}%
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {preview && (
            <div className="space-y-4">
              <div className="flex gap-6 text-sm flex-wrap">
                <div>
                  Totales: <b>{preview.resumen.total}</b>
                </div>
                <div className="text-green-700">
                  Crear: <b>{preview.resumen.aCrear}</b>
                </div>
                <div className="text-yellow-700">
                  Actualizar: <b>{preview.resumen.aActualizar}</b>
                </div>
                <div className="text-red-700">
                  Errores: <b>{preview.resumen.errores}</b>
                </div>
                <div className="text-amber-700">
                  Warnings: <b>{preview.resumen.warnings}</b>
                </div>
              </div>
              {preview.resumen.warnings > 0 && (
                <label className="flex items-center gap-2 text-sm text-amber-700">
                  <input
                    type="checkbox"
                    checked={ignoreWarnings}
                    onChange={(e) => setIgnoreWarnings(e.target.checked)}
                  />
                  Continuar a pesar de los warnings (se importarán igual)
                </label>
              )}

              <div className="border rounded-md overflow-auto max-h-[60vh]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fila</TableHead>
                      <TableHead>Operación</TableHead>
                      <TableHead>DNI Titular</TableHead>
                      <TableHead>Nombre Familiar</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Mensaje</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.operaciones.map((op: OperacionPreview, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell>{op.fila}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              op.operacion === 'CREAR'
                                ? 'default'
                                : op.operacion === 'ACTUALIZAR'
                                ? 'secondary'
                                : 'error'
                            }
                          >
                            {op.operacion}
                          </Badge>
                        </TableCell>
                        <TableCell>{op.dniTitular || '-'}</TableCell>
                        <TableCell>{op.nombreFamiliar || '-'}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              op.status === 'OK'
                                ? 'default'
                                : op.status === 'WARNING'
                                ? 'secondary'
                                : 'error'
                            }
                          >
                            {op.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xl whitespace-pre-wrap text-xs">
                          {op.mensaje || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={onConfirm}
                  disabled={
                    !preview.puedeConfirmar ||
                    loading ||
                    (preview.resumen.warnings > 0 && !ignoreWarnings)
                  }
                >
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
