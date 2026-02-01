'use client';

import { useEffect, useState } from 'react';
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

type UsuarioRow = {
  id: string;
  email: string;
  username?: string | null;
  nombre: string;
  apellido: string;
  roles: string[];
  estado: string;
  ultimoLogin?: string | null;
  creadoEn: string;
  sedeId?: string | null;
};

const ROLES_DISPONIBLES = [
  'ADMIN', 'OPERACION', 'COSEGURO', 'NOMINA', 'CONTABILIDAD',
  'TERCEROS', 'AFILIADOS', 'FINANZAS', 'TESORERIA', 'CAJA', 'SOLO_LECTURA',
];

export default function AdminUsuariosPage() {
  const [lista, setLista] = useState<UsuarioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [modal, setModal] = useState<'crear' | 'editar' | 'reset' | 'sesiones' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [resetPasswordNueva, setResetPasswordNueva] = useState('');
  const [sesionesUsuario, setSesionesUsuario] = useState<Array<{ ipAddress?: string; userAgent?: string; creadoEn: string; ultimoUso: string }>>([]);
  const [form, setForm] = useState({
    email: '',
    username: '',
    password: '',
    nombre: '',
    apellido: '',
    roles: [] as string[],
  });

  const cargar = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (busqueda) params.set('busqueda', busqueda);
      const data = await api<UsuarioRow[]>(
        `/usuarios${params.toString() ? '?' + params.toString() : ''}`
      );
      setLista(Array.isArray(data) ? data : []);
    } catch (e) {
      setMsg(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void cargar();
  }, [busqueda]);

  const abrirCrear = () => {
    setForm({ email: '', username: '', password: '', nombre: '', apellido: '', roles: ['OPERACION'] });
    setModal('crear');
    setEditingId(null);
  };

  const abrirEditar = (u: UsuarioRow) => {
    setForm({
      email: u.email,
      username: u.username || '',
      password: '',
      nombre: u.nombre,
      apellido: u.apellido,
      roles: u.roles || [],
    });
    setEditingId(u.id);
    setModal('editar');
  };

  const submitCrear = async () => {
    try {
      const body: Record<string, unknown> = {
        email: form.email,
        nombre: form.nombre,
        apellido: form.apellido,
        roles: form.roles,
        password: form.password,
      };
      if (form.username) body.username = form.username;
      await api('/usuarios', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setMsg('Usuario creado');
      setModal(null);
      void cargar();
    } catch (e) {
      setMsg(getErrorMessage(e));
    }
  };

  const submitEditar = async () => {
    if (!editingId) return;
    try {
      await api(`/usuarios/${editingId}`, {
        method: 'PUT',
        body: JSON.stringify({
          email: form.email,
          username: form.username || undefined,
          nombre: form.nombre,
          apellido: form.apellido,
          roles: form.roles,
        }),
      });
      setMsg('Usuario actualizado');
      setModal(null);
      void cargar();
    } catch (e) {
      setMsg(getErrorMessage(e));
    }
  };

  const toggleRol = (rol: string) => {
    setForm((f) => ({
      ...f,
      roles: f.roles.includes(rol) ? f.roles.filter((r) => r !== rol) : [...f.roles, rol],
    }));
  };

  const activar = async (u: UsuarioRow) => {
    try {
      await api(`/usuarios/${u.id}/activar`, { method: 'PUT' });
      setMsg(`${u.nombre} activado`);
      void cargar();
    } catch (e) {
      setMsg(getErrorMessage(e));
    }
  };

  const desactivar = async (u: UsuarioRow) => {
    if (!confirm(`¿Desactivar a ${u.nombre} ${u.apellido}?`)) return;
    try {
      await api(`/usuarios/${u.id}/desactivar`, { method: 'PUT' });
      setMsg(`${u.nombre} desactivado`);
      void cargar();
    } catch (e) {
      setMsg(getErrorMessage(e));
    }
  };

  const bloquear = async (u: UsuarioRow) => {
    const hasta = prompt('Bloquear hasta (fecha YYYY-MM-DD o vacío para indefinido):');
    try {
      await api(`/usuarios/${u.id}/bloquear`, {
        method: 'PUT',
        body: JSON.stringify({ hasta: hasta || undefined }),
      });
      setMsg(`${u.nombre} bloqueado`);
      void cargar();
    } catch (e) {
      setMsg(getErrorMessage(e));
    }
  };

  const abrirResetPassword = (u: UsuarioRow) => {
    setEditingId(u.id);
    setResetPasswordNueva('');
    setModal('reset');
  };

  const submitResetPassword = async () => {
    if (!editingId || !resetPasswordNueva || resetPasswordNueva.length < 6) {
      setMsg('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    try {
      await api(`/usuarios/${editingId}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ passwordNueva: resetPasswordNueva }),
      });
      setMsg('Contraseña restablecida');
      setModal(null);
    } catch (e) {
      setMsg(getErrorMessage(e));
    }
  };

  const abrirSesiones = async (u: UsuarioRow) => {
    try {
      const data = await api<Array<{ ipAddress?: string; userAgent?: string; creadoEn: string; ultimoUso: string }>>(`/usuarios/${u.id}/sesiones`);
      setSesionesUsuario(data || []);
      setModal('sesiones');
    } catch (e) {
      setMsg(getErrorMessage(e));
    }
  };

  return (
    <AuthGate roles={['ADMIN', 'SUPERADMIN']}>
      <main className="p-6 max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">ABM Usuarios</h1>

        <div className="flex gap-4 mb-4">
          <Input
            placeholder="Buscar por nombre, apellido, email..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="max-w-sm"
          />
          <Button onClick={abrirCrear}>Nuevo usuario</Button>
        </div>

        {msg && (
          <div className="mb-4 p-3 rounded bg-blue-100 text-blue-800">{msg}</div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Usuarios de la organización</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p>Cargando…</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Último login</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lista.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>{u.apellido}, {u.nombre}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {u.roles?.map((r) => (
                            <Badge key={r} variant="secondary">{r}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.estado === 'ACTIVO' ? 'default' : 'outline'}>
                          {u.estado}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {u.ultimoLogin
                          ? new Date(u.ultimoLogin).toLocaleString('es-AR')
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end flex-wrap">
                          <Button variant="outline" size="sm" onClick={() => abrirEditar(u)}>Editar</Button>
                          {u.estado !== 'ACTIVO' && (
                            <Button variant="outline" size="sm" onClick={() => activar(u)}>Activar</Button>
                          )}
                          {u.estado === 'ACTIVO' && (
                            <Button variant="outline" size="sm" onClick={() => desactivar(u)}>Desactivar</Button>
                          )}
                          <Button variant="outline" size="sm" onClick={() => bloquear(u)}>Bloquear</Button>
                          <Button variant="outline" size="sm" onClick={() => abrirResetPassword(u)}>Reset pass</Button>
                          <Button variant="outline" size="sm" onClick={() => abrirSesiones(u)}>Sesiones</Button>
                        </div>
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
                <CardTitle>Nuevo usuario</CardTitle>
                <Button variant="ghost" onClick={() => setModal(null)}>✕</Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
                <Input
                  placeholder="Usuario (opcional)"
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                />
                <Input
                  placeholder="Contraseña"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                />
                <Input
                  placeholder="Nombre"
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                />
                <Input
                  placeholder="Apellido"
                  value={form.apellido}
                  onChange={(e) => setForm((f) => ({ ...f, apellido: e.target.value }))}
                />
                <div>
                  <p className="text-sm mb-2">Roles</p>
                  <div className="flex flex-wrap gap-2">
                    {ROLES_DISPONIBLES.filter((r) => r !== 'SUPERADMIN').map((r) => (
                      <Badge
                        key={r}
                        variant={form.roles.includes(r) ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => toggleRol(r)}
                      >
                        {r}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={submitCrear}>Crear</Button>
                  <Button variant="outline" onClick={() => setModal(null)}>Cancelar</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {modal === 'reset' && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md">
              <CardHeader className="flex flex-row justify-between">
                <CardTitle>Restablecer contraseña</CardTitle>
                <Button variant="ghost" onClick={() => setModal(null)}>✕</Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Nueva contraseña (mín. 6 caracteres)"
                  type="password"
                  value={resetPasswordNueva}
                  onChange={(e) => setResetPasswordNueva(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button onClick={submitResetPassword} disabled={resetPasswordNueva.length < 6}>
                    Restablecer
                  </Button>
                  <Button variant="outline" onClick={() => setModal(null)}>Cancelar</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {modal === 'sesiones' && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-2xl">
              <CardHeader className="flex flex-row justify-between">
                <CardTitle>Sesiones activas</CardTitle>
                <Button variant="ghost" onClick={() => setModal(null)}>✕</Button>
              </CardHeader>
              <CardContent>
                {sesionesUsuario.length === 0 ? (
                  <p className="text-gray-500">No hay sesiones activas</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {sesionesUsuario.map((s, i) => (
                      <li key={i} className="border rounded p-2">
                        <p>IP: {s.ipAddress || '-'} | {s.userAgent || '-'}</p>
                        <p className="text-gray-500 text-xs">
                          Creada: {new Date(s.creadoEn).toLocaleString('es-AR')} |
                          Último uso: {new Date(s.ultimoUso).toLocaleString('es-AR')}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {modal === 'editar' && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md">
              <CardHeader className="flex flex-row justify-between">
                <CardTitle>Editar usuario</CardTitle>
                <Button variant="ghost" onClick={() => setModal(null)}>✕</Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
                <Input
                  placeholder="Usuario (opcional)"
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                />
                <Input
                  placeholder="Nombre"
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                />
                <Input
                  placeholder="Apellido"
                  value={form.apellido}
                  onChange={(e) => setForm((f) => ({ ...f, apellido: e.target.value }))}
                />
                <div>
                  <p className="text-sm mb-2">Roles</p>
                  <div className="flex flex-wrap gap-2">
                    {ROLES_DISPONIBLES.filter((r) => r !== 'SUPERADMIN').map((r) => (
                      <Badge
                        key={r}
                        variant={form.roles.includes(r) ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => toggleRol(r)}
                      >
                        {r}
                      </Badge>
                    ))}
                  </div>
                </div>
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
