'use client';
import { useState, useEffect, useMemo } from 'react';
import { api, getErrorMessage } from '@/servicios/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InputPeriodo } from '@/components/InputPeriodo';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';

type NovedadManual = {
  id: string;
  periodo: string;
  afiliado: {
    id: string;
    apellido: string | null;
    nombre: string | null;
    dni: string | null;
  } | null;
  padron: { id: string; padron: string | null } | { id: null; padron: string | null };
  padronRaw: string;
  centro: number | null;
  codigo: string;
  importe: string;
  observacion: string | null;
  creadoPor: string | null;
  creadoEn: string;
};

type Paged<T> = { items: T[]; total: number; page: number; limit: number };

type AfiliadoSuggest = {
  id: string;
  dni: string | null;
  apellido: string | null;
  nombre: string | null;
};

type PadronLite = {
  id: string;
  padron: string | null;
  centro: number | null;
};

function qs(params: Record<string, any>) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') {
      q.set(k, String(v));
    }
  });
  return q.toString();
}

export default function NovedadesManualesPage() {
  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const periodoHoy = `${today.getFullYear()}-${pad(today.getMonth() + 1)}`;

  const [periodo, setPeriodo] = useState(periodoHoy);
  const [codigo, setCodigo] = useState('');
  const [qtext, setQtext] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(20);

  const [items, setItems] = useState<NovedadManual[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Form modal
  const [formOpen, setFormOpen] = useState(false);
  const [formEditId, setFormEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    periodo: periodoHoy,
    afiliadoId: '',
    padronId: '',
    padronRaw: '',
    centro: '',
    codigo: '',
    importe: '',
    observacion: '',
  });

  // Búsqueda de afiliados
  const [busquedaAfiliado, setBusquedaAfiliado] = useState('');
  const [afiliadosResults, setAfiliadosResults] = useState<AfiliadoSuggest[]>([]);
  const [afiliadoSeleccionado, setAfiliadoSeleccionado] = useState<AfiliadoSuggest | null>(null);
  const [padronesDisponibles, setPadronesDisponibles] = useState<PadronLite[]>([]);

  const listQS = useMemo(
    () =>
      qs({
        periodo,
        codigo: codigo || undefined,
        q: qtext || undefined,
        page,
        limit,
      }),
    [periodo, codigo, qtext, page, limit]
  );

  const cargar = async () => {
    setMsg(null);
    setLoading(true);
    try {
      const data = (await api(`/novedades/manuales?${listQS}`, {
        method: 'GET',
      })) as Paged<NovedadManual>;
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
  }, [periodo, codigo, qtext]);

  useEffect(() => {
    void cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listQS]);

  // Buscar afiliados
  useEffect(() => {
    if (!busquedaAfiliado.trim()) {
      setAfiliadosResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      try {
        const res = await api<AfiliadoSuggest[]>(
          `/afiliados/suggest?q=${encodeURIComponent(busquedaAfiliado)}`,
          { method: 'GET' }
        );
        setAfiliadosResults(res ?? []);
      } catch {
        setAfiliadosResults([]);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [busquedaAfiliado]);

  // Cargar padrones cuando se selecciona un afiliado
  useEffect(() => {
    if (!afiliadoSeleccionado?.id) {
      setPadronesDisponibles([]);
      return;
    }
    (async () => {
      try {
        const res = await api<PadronLite[]>(
          `/padrones?afiliadoId=${encodeURIComponent(afiliadoSeleccionado.id)}`,
          { method: 'GET' }
        );
        setPadronesDisponibles(res ?? []);
      } catch {
        setPadronesDisponibles([]);
      }
    })();
  }, [afiliadoSeleccionado]);

  const abrirFormNuevo = () => {
    setFormEditId(null);
    setFormData({
      periodo: periodoHoy,
      afiliadoId: '',
      padronId: '',
      padronRaw: '',
      centro: '',
      codigo: '',
      importe: '',
      observacion: '',
    });
    setAfiliadoSeleccionado(null);
    setBusquedaAfiliado('');
    setFormOpen(true);
  };

  const abrirFormEditar = (item: NovedadManual) => {
    setFormEditId(item.id);
    setFormData({
      periodo: item.periodo,
      afiliadoId: item.afiliado?.id || '',
      padronId: item.padron.id || '',
      padronRaw: item.padronRaw,
      centro: item.centro?.toString() || '',
      codigo: item.codigo,
      importe: item.importe,
      observacion: item.observacion || '',
    });
    setAfiliadoSeleccionado(item.afiliado);
    setBusquedaAfiliado(
      item.afiliado ? `${item.afiliado.apellido || ''} ${item.afiliado.nombre || ''}`.trim() : ''
    );
    setFormOpen(true);
  };

  const guardarForm = async () => {
    if (!formData.afiliadoId || !formData.codigo || !formData.importe) {
      setMsg('Faltan campos requeridos');
      return;
    }

    setMsg(null);
    try {
      if (formEditId) {
        // Actualizar
        await api(`/novedades/manuales/${formEditId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            padronId: formData.padronId || null,
            padronRaw: formData.padronRaw,
            centro: formData.centro ? parseInt(formData.centro) : null,
            codigo: formData.codigo,
            importe: parseFloat(formData.importe),
            observacion: formData.observacion || null,
          }),
        });
      } else {
        // Crear
        await api('/novedades/manuales', {
          method: 'POST',
          body: JSON.stringify({
            periodo: formData.periodo,
            afiliadoId: formData.afiliadoId,
            padronId: formData.padronId || null,
            padronRaw: formData.padronRaw,
            centro: formData.centro ? parseInt(formData.centro) : null,
            codigo: formData.codigo,
            importe: parseFloat(formData.importe),
            observacion: formData.observacion || null,
          }),
        });
      }
      setFormOpen(false);
      void cargar();
    } catch (e) {
      setMsg(getErrorMessage(e));
    }
  };

  const eliminar = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar esta novedad?')) return;

    setMsg(null);
    try {
      await api(`/novedades/manuales/${id}`, { method: 'DELETE' });
      void cargar();
    } catch (e) {
      setMsg(getErrorMessage(e));
    }
  };

  const lastPage = Math.max(1, Math.ceil((total || 0) / (limit || 20)));

  return (
    <main className="p-6 max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Novedades Manuales</h1>
        <Button onClick={abrirFormNuevo}>+ Nueva Novedad</Button>
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
          <label className="text-xs font-medium text-muted-foreground">Código</label>
          <Input
            type="text"
            placeholder="P40, J17, J22..."
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            className="w-40"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Búsqueda</label>
          <Input
            type="text"
            placeholder="DNI, nombre, padrón..."
            value={qtext}
            onChange={(e) => setQtext(e.target.value)}
            className="w-52"
          />
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
          <p className="text-sm text-muted-foreground">No hay novedades para mostrar</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Afiliado</TableHead>
                  <TableHead>Padrón</TableHead>
                  <TableHead>Centro</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead className="text-right">Importe</TableHead>
                  <TableHead>Observación</TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      {item.afiliado
                        ? `${item.afiliado.apellido || ''}, ${item.afiliado.nombre || ''}`.trim() ||
                          `DNI: ${item.afiliado.dni || 'N/A'}`
                        : 'N/A'}
                    </TableCell>
                    <TableCell>{item.padronRaw}</TableCell>
                    <TableCell>{item.centro || '—'}</TableCell>
                    <TableCell>{item.codigo}</TableCell>
                    <TableCell className="text-right">
                      ${parseFloat(item.importe).toLocaleString('es-AR', {
                        minimumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell>{item.observacion || '—'}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-2">
                        <Button size="sm" onClick={() => abrirFormEditar(item)}>
                          Editar
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => eliminar(item.id)}>
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

      {/* Modal Form */}
      {formOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setFormOpen(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: 24,
              borderRadius: 8,
              maxWidth: 600,
              width: '90%',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0 }}>
              {formEditId ? 'Editar Novedad' : 'Nueva Novedad'}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Período */}
              {!formEditId && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    Período (mm/aa) *
                  </label>
                  <InputPeriodo
                    value={formData.periodo}
                    onChange={(periodoISO) => setFormData({ ...formData, periodo: periodoISO })}
                    placeholder="mm/aa"
                  />
                </div>
              )}

              {/* Búsqueda Afiliado */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Afiliado *
                </label>
                <Input
                  type="text"
                  placeholder="Buscar por DNI o nombre..."
                  value={busquedaAfiliado}
                  onChange={(e) => {
                    setBusquedaAfiliado(e.target.value);
                    setAfiliadoSeleccionado(null);
                    setFormData({ ...formData, afiliadoId: '' });
                  }}
                />
                {afiliadosResults.length > 0 && !afiliadoSeleccionado && (
                  <div
                    style={{
                      border: '1px solid #ddd',
                      borderRadius: 4,
                      marginTop: 4,
                      maxHeight: 200,
                      overflowY: 'auto',
                    }}
                  >
                    {afiliadosResults.map((a) => (
                      <div
                        key={a.id}
                        onClick={() => {
                          setAfiliadoSeleccionado(a);
                          setFormData({ ...formData, afiliadoId: a.id });
                      const nombreCompleto = [a.apellido, a.nombre].filter(Boolean).join(', ') || `DNI: ${a.dni || 'N/A'}`;
                      setBusquedaAfiliado(nombreCompleto);
                          setAfiliadosResults([]);
                        }}
                        style={{
                          padding: 8,
                          cursor: 'pointer',
                          borderBottom: '1px solid #eee',
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLDivElement).style.backgroundColor = '#f0f0f0';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLDivElement).style.backgroundColor = 'white';
                        }}
                      >
                        {(() => {
                          const nombreCompleto = [a.apellido, a.nombre].filter(Boolean).join(', ');
                          return nombreCompleto ? `${nombreCompleto} (DNI: ${a.dni || 'N/A'})` : `DNI: ${a.dni || 'N/A'}`;
                        })()}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Padrón */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Padrón
                </label>
                {padronesDisponibles.length > 0 ? (
                  <select
                    value={formData.padronId}
                    onChange={(e) => {
                      const padronSeleccionado = padronesDisponibles.find(
                        (p) => p.id === e.target.value
                      );
                      setFormData({
                        ...formData,
                        padronId: e.target.value,
                        padronRaw: padronSeleccionado?.padron || '',
                        centro: padronSeleccionado?.centro?.toString() || '',
                      });
                    }}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs"
                  >
                    <option value="">Seleccionar padrón...</option>
                    {padronesDisponibles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.padron} (Centro: {p.centro || 'N/A'})
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    type="text"
                    placeholder="Número de padrón (ej: 123456-7)"
                    value={formData.padronRaw}
                    onChange={(e) => setFormData({ ...formData, padronRaw: e.target.value })}
                  />
                )}
              </div>

              {/* Centro */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Centro
                </label>
                <Input
                  type="number"
                  placeholder="Número de centro"
                  value={formData.centro}
                  onChange={(e) => setFormData({ ...formData, centro: e.target.value })}
                />
              </div>

              {/* Código */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Código (P40, J17, J22...) *
                </label>
                <Input
                  type="text"
                  placeholder="P40"
                  value={formData.codigo}
                  onChange={(e) =>
                    setFormData({ ...formData, codigo: e.target.value.toUpperCase() })
                  }
                />
              </div>

              {/* Importe */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Importe *
                </label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.importe}
                  onChange={(e) => setFormData({ ...formData, importe: e.target.value })}
                />
              </div>

              {/* Observación */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Observación
                </label>
                <textarea
                  value={formData.observacion}
                  onChange={(e) => setFormData({ ...formData, observacion: e.target.value })}
                  className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setFormOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={guardarForm}>Guardar</Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

