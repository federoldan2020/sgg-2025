'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AuthGate from '@/components/auth/AuthGate';
import { api, getErrorMessage } from '@/servicios/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

type OrganizacionRow = {
  id: string;
  nombre: string;
  activo: boolean;
  creadoEn: string;
  _count?: { usuarios: number };
};

export default function SuperadminOrganizacionesPage() {
  const [lista, setLista] = useState<OrganizacionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [modal, setModal] = useState<'crear' | 'editar' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formNombre, setFormNombre] = useState('');
  const [formActivo, setFormActivo] = useState(true);

  const cargar = async () => {
    setLoading(true);
    try {
      const data = await api<OrganizacionRow[]>('/organizaciones');
      setLista(Array.isArray(data) ? data : []);
    } catch (e) {
      setMsg(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void cargar();
  }, []);

  const abrirCrear = () => {
    setFormNombre('');
    setFormActivo(true);
    setModal('crear');
    setEditingId(null);
  };

  const abrirEditar = (o: OrganizacionRow) => {
    setFormNombre(o.nombre);
    setFormActivo(o.activo);
    setEditingId(o.id);
    setModal('editar');
  };

  const submitCrear = async () => {
    try {
      await api('/organizaciones', {
        method: 'POST',
        body: JSON.stringify({ nombre: formNombre, activo: formActivo }),
      });
      setMsg('Organización creada');
      setModal(null);
      void cargar();
    } catch (e) {
      setMsg(getErrorMessage(e));
    }
  };

  const submitEditar = async () => {
    if (!editingId) return;
    try {
      await api(`/organizaciones/${editingId}`, {
        method: 'PUT',
        body: JSON.stringify({ nombre: formNombre, activo: formActivo }),
      });
      setMsg('Organización actualizada');
      setModal(null);
      void cargar();
    } catch (e) {
      setMsg(getErrorMessage(e));
    }
  };

  return (
    <AuthGate roles={['SUPERADMIN']}>
      <main className="p-6 max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">ABM Organizaciones (Superadmin)</h1>

        <div className="flex gap-4 mb-4">
          <Button onClick={abrirCrear}>Nueva organización</Button>
        </div>

        {msg && (
          <div className="mb-4 p-3 rounded bg-blue-100 text-blue-800">{msg}</div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Organizaciones</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p>Cargando…</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Usuarios</TableHead>
                    <TableHead>Creado</TableHead>
                    <TableHead></TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lista.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell>{o.nombre}</TableCell>
                      <TableCell>
                        <Badge variant={o.activo ? 'default' : 'outline'}>
                          {o.activo ? 'Activa' : 'Inactiva'}
                        </Badge>
                      </TableCell>
                      <TableCell>{o._count?.usuarios ?? 0}</TableCell>
                      <TableCell>
                        {new Date(o.creadoEn).toLocaleDateString('es-AR')}
                      </TableCell>
                      <TableCell>
                        <Link href={`/superadmin/organizaciones/${o.id}/usuarios`}>
                          <Button variant="outline" size="sm">Ver usuarios</Button>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => abrirEditar(o)}>
                          Editar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {modal === 'crear' && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md">
              <CardHeader className="flex flex-row justify-between">
                <CardTitle>Nueva organización</CardTitle>
                <Button variant="ghost" onClick={() => setModal(null)}>✕</Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Nombre"
                  value={formNombre}
                  onChange={(e) => setFormNombre(e.target.value)}
                />
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formActivo}
                    onChange={(e) => setFormActivo(e.target.checked)}
                  />
                  Activa
                </label>
                <div className="flex gap-2">
                  <Button onClick={submitCrear}>Crear</Button>
                  <Button variant="outline" onClick={() => setModal(null)}>Cancelar</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {modal === 'editar' && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md">
              <CardHeader className="flex flex-row justify-between">
                <CardTitle>Editar organización</CardTitle>
                <Button variant="ghost" onClick={() => setModal(null)}>✕</Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Nombre"
                  value={formNombre}
                  onChange={(e) => setFormNombre(e.target.value)}
                />
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formActivo}
                    onChange={(e) => setFormActivo(e.target.checked)}
                  />
                  Activa
                </label>
                <div className="flex gap-2">
                  <Button onClick={submitEditar}>Guardar</Button>
                  <Button variant="outline" onClick={() => setModal(null)}>Cancelar</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </AuthGate>
  );
}
