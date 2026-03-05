'use client';

import { useEffect, useState } from 'react';
import { Search, UserPlus, X, KeyRound, Monitor, Pencil } from 'lucide-react';
import AuthGate from '@/components/auth/AuthGate';
import { api, getErrorMessage } from '@/servicios/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui-kit';

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

  const cerrarModal = () => {
    setModal(null);
    setMsg(null);
  };

  const ModalOverlay = ({ children }: { children: React.ReactNode }) => (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={cerrarModal}
    >
      {children}
    </div>
  );

  const ModalDialog = ({
    title,
    description,
    children,
    maxWidth = 'max-w-2xl',
    onClickStop,
  }: {
    title: string;
    description?: string;
    children: React.ReactNode;
    maxWidth?: string;
    onClickStop?: (e: React.MouseEvent) => void;
  }) => (
    <Card
      className={`w-full ${maxWidth} rounded-xl border-neutral-200 shadow-xl`}
      onClick={onClickStop ?? ((e) => e.stopPropagation())}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-neutral-100 pb-4">
        <div>
          <CardTitle className="text-lg font-semibold text-neutral-900">{title}</CardTitle>
          {description && (
            <CardDescription className="mt-1">{description}</CardDescription>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
          onClick={cerrarModal}
          aria-label="Cerrar"
        >
          <X className="size-4" />
        </Button>
      </CardHeader>
      <CardContent className="pt-5">{children}</CardContent>
    </Card>
  );

  const FormField = ({
    id,
    label,
    type = 'text',
    placeholder,
    value,
    onChange,
    required,
  }: {
    id: string;
    label: string;
    type?: string;
    placeholder?: string;
    value: string;
    onChange: (v: string) => void;
    required?: boolean;
  }) => (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-medium text-neutral-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </Label>
      <Input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border-neutral-200 bg-white"
      />
    </div>
  );

  return (
    <AuthGate roles={['ADMIN', 'SUPERADMIN']}>
      <div className="mx-auto max-w-6xl">
        <PageHeader
          title="ABM Usuarios"
          subtitle="Administración de usuarios y roles de la organización"
        >
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
              <Input
                placeholder="Buscar por nombre, apellido, email..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-64 rounded-lg border-neutral-200 pl-9"
              />
            </div>
            <Button onClick={abrirCrear} className="gap-2">
              <UserPlus className="size-4" />
              Nuevo usuario
            </Button>
          </div>
        </PageHeader>

        {msg && (
          <div
            className="mb-6 rounded-lg border border-medical-200 bg-medical-50 px-4 py-3 text-sm font-medium text-medical-800"
            role="alert"
          >
            {msg}
          </div>
        )}

        <Card className="overflow-hidden rounded-xl border-neutral-200">
          <CardHeader>
            <CardTitle className="text-neutral-900">Usuarios de la organización</CardTitle>
            <CardDescription>Listado de usuarios con sus roles y estado</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-sm text-neutral-500">
                Cargando…
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-neutral-200 hover:bg-transparent">
                    <TableHead className="font-semibold text-neutral-700">Nombre</TableHead>
                    <TableHead className="font-semibold text-neutral-700">Email</TableHead>
                    <TableHead className="font-semibold text-neutral-700">Roles</TableHead>
                    <TableHead className="font-semibold text-neutral-700">Estado</TableHead>
                    <TableHead className="font-semibold text-neutral-700">Último login</TableHead>
                    <TableHead className="text-right font-semibold text-neutral-700">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lista.map((u) => (
                    <TableRow key={u.id} className="border-neutral-100">
                      <TableCell className="font-medium text-neutral-900">
                        {u.apellido}, {u.nombre}
                      </TableCell>
                      <TableCell className="text-neutral-600">{u.email}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          {u.roles?.map((r) => (
                            <Badge key={r} variant="secondary" className="font-medium">
                              {r}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={u.estado === 'ACTIVO' ? 'default' : 'outline'}
                          className="font-medium"
                        >
                          {u.estado}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-neutral-600">
                        {u.ultimoLogin
                          ? new Date(u.ultimoLogin).toLocaleString('es-AR')
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={() => abrirEditar(u)}
                          >
                            <Pencil className="size-3.5" />
                            Editar
                          </Button>
                          {u.estado !== 'ACTIVO' && (
                            <Button variant="outline" size="sm" onClick={() => activar(u)}>
                              Activar
                            </Button>
                          )}
                          {u.estado === 'ACTIVO' && (
                            <Button variant="outline" size="sm" onClick={() => desactivar(u)}>
                              Desactivar
                            </Button>
                          )}
                          <Button variant="outline" size="sm" onClick={() => bloquear(u)}>
                            Bloquear
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={() => abrirResetPassword(u)}
                          >
                            <KeyRound className="size-3.5" />
                            Reset pass
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={() => abrirSesiones(u)}
                          >
                            <Monitor className="size-3.5" />
                            Sesiones
                          </Button>
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
          <ModalOverlay>
            <ModalDialog
              title="Nuevo usuario"
              description="Completa los datos del nuevo usuario."
              maxWidth="max-w-2xl"
            >
              <form
                className="space-y-6"
                onSubmit={(e) => {
                  e.preventDefault();
                  submitCrear();
                }}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    id="crear-email"
                    label="Email"
                    type="email"
                    placeholder="correo@ejemplo.com"
                    value={form.email}
                    onChange={(v) => setForm((f) => ({ ...f, email: v }))}
                    required
                  />
                  <FormField
                    id="crear-username"
                    label="Usuario (opcional)"
                    placeholder="Nombre de usuario"
                    value={form.username}
                    onChange={(v) => setForm((f) => ({ ...f, username: v }))}
                  />
                  <FormField
                    id="crear-password"
                    label="Contraseña"
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={form.password}
                    onChange={(v) => setForm((f) => ({ ...f, password: v }))}
                    required
                  />
                  <div className="grid gap-4 sm:grid-cols-2 sm:col-span-2">
                    <FormField
                      id="crear-nombre"
                      label="Nombre"
                      placeholder="Nombre"
                      value={form.nombre}
                      onChange={(v) => setForm((f) => ({ ...f, nombre: v }))}
                      required
                    />
                    <FormField
                      id="crear-apellido"
                      label="Apellido"
                      placeholder="Apellido"
                      value={form.apellido}
                      onChange={(v) => setForm((f) => ({ ...f, apellido: v }))}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-neutral-700">Roles</Label>
                  <div className="flex flex-wrap gap-2">
                    {ROLES_DISPONIBLES.filter((r) => r !== 'SUPERADMIN').map((r) => (
                      <Badge
                        key={r}
                        variant={form.roles.includes(r) ? 'default' : 'outline'}
                        className="cursor-pointer px-3 py-1 text-xs font-semibold tracking-wide transition-colors hover:opacity-90"
                        onClick={() => toggleRol(r)}
                      >
                        {r}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-neutral-500">
                    Podés asignar uno o varios roles según los permisos que necesite el usuario.
                  </p>
                </div>
                <div className="flex justify-end gap-2 border-t border-neutral-100 pt-4">
                  <Button type="button" variant="outline" onClick={cerrarModal}>
                    Cancelar
                  </Button>
                  <Button type="submit">Crear usuario</Button>
                </div>
              </form>
            </ModalDialog>
          </ModalOverlay>
        )}

        {modal === 'editar' && (
          <ModalOverlay>
            <ModalDialog
              title="Editar usuario"
              description="Modifica los datos del usuario."
              maxWidth="max-w-2xl"
            >
              <form
                className="space-y-6"
                onSubmit={(e) => {
                  e.preventDefault();
                  submitEditar();
                }}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    id="editar-email"
                    label="Email"
                    type="email"
                    placeholder="correo@ejemplo.com"
                    value={form.email}
                    onChange={(v) => setForm((f) => ({ ...f, email: v }))}
                    required
                  />
                  <FormField
                    id="editar-username"
                    label="Usuario (opcional)"
                    placeholder="Nombre de usuario"
                    value={form.username}
                    onChange={(v) => setForm((f) => ({ ...f, username: v }))}
                  />
                  <div className="grid gap-4 sm:grid-cols-2 sm:col-span-2">
                    <FormField
                      id="editar-nombre"
                      label="Nombre"
                      placeholder="Nombre"
                      value={form.nombre}
                      onChange={(v) => setForm((f) => ({ ...f, nombre: v }))}
                      required
                    />
                    <FormField
                      id="editar-apellido"
                      label="Apellido"
                      placeholder="Apellido"
                      value={form.apellido}
                      onChange={(v) => setForm((f) => ({ ...f, apellido: v }))}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-neutral-700">Roles</Label>
                  <div className="flex flex-wrap gap-2">
                    {ROLES_DISPONIBLES.filter((r) => r !== 'SUPERADMIN').map((r) => (
                      <Badge
                        key={r}
                        variant={form.roles.includes(r) ? 'default' : 'outline'}
                        className="cursor-pointer px-3 py-1 text-xs font-semibold tracking-wide transition-colors hover:opacity-90"
                        onClick={() => toggleRol(r)}
                      >
                        {r}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-neutral-500">
                    Ajustá los roles para actualizar los permisos del usuario.
                  </p>
                </div>
                <div className="flex justify-end gap-2 border-t border-neutral-100 pt-4">
                  <Button type="button" variant="outline" onClick={cerrarModal}>
                    Cancelar
                  </Button>
                  <Button type="submit">Guardar cambios</Button>
                </div>
              </form>
            </ModalDialog>
          </ModalOverlay>
        )}

        {modal === 'reset' && (
          <ModalOverlay>
            <ModalDialog
              title="Restablecer contraseña"
              description="Define una nueva contraseña para el usuario."
            >
              <form
                className="space-y-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  submitResetPassword();
                }}
              >
                <FormField
                  id="reset-password"
                  label="Nueva contraseña"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={resetPasswordNueva}
                  onChange={setResetPasswordNueva}
                  required
                />
                <div className="flex justify-end gap-2 border-t border-neutral-100 pt-4">
                  <Button type="button" variant="outline" onClick={cerrarModal}>
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={resetPasswordNueva.length < 6}
                  >
                    Restablecer contraseña
                  </Button>
                </div>
              </form>
            </ModalDialog>
          </ModalOverlay>
        )}

        {modal === 'sesiones' && (
          <ModalOverlay>
            <ModalDialog
              title="Sesiones activas"
              description="Dispositivos y sesiones del usuario."
              maxWidth="max-w-2xl"
            >
              {sesionesUsuario.length === 0 ? (
                <p className="py-6 text-center text-sm text-neutral-500">
                  No hay sesiones activas
                </p>
              ) : (
                <ul className="space-y-3">
                  {sesionesUsuario.map((s, i) => (
                    <li
                      key={i}
                      className="rounded-lg border border-neutral-200 bg-neutral-50/50 p-4 text-sm"
                    >
                      <p className="font-medium text-neutral-800">
                        IP: {s.ipAddress || '—'} · {s.userAgent || '—'}
                      </p>
                      <p className="mt-1 text-xs text-neutral-500">
                        Creada: {new Date(s.creadoEn).toLocaleString('es-AR')} · Último uso:{' '}
                        {new Date(s.ultimoUso).toLocaleString('es-AR')}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4 flex justify-end border-t border-neutral-100 pt-4">
                <Button variant="outline" onClick={cerrarModal}>
                  Cerrar
                </Button>
              </div>
            </ModalDialog>
          </ModalOverlay>
        )}
      </div>
    </AuthGate>
  );
}
