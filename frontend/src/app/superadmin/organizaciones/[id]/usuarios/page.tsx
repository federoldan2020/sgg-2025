'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AuthGate from '@/components/auth/AuthGate';
import { api, getErrorMessage } from '@/servicios/api';
import { Button } from '@/components/ui/button';
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

type OrgInfo = {
  id: string;
  nombre: string;
  activo: boolean;
};

export default function SuperadminOrgUsuariosPage() {
  const params = useParams();
  const id = params?.id as string;

  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const cargar = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [orgData, usersData] = await Promise.all([
        api<OrgInfo>(`/organizaciones/${id}`, {
          headers: { 'X-Organizacion-ID': id },
        }),
        api<UsuarioRow[]>(`/organizaciones/${id}/usuarios`, {
          headers: { 'X-Organizacion-ID': id },
        }),
      ]);
      setOrg(orgData);
      setUsuarios(Array.isArray(usersData) ? usersData : []);
    } catch (e) {
      setMsg(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void cargar();
  }, [id]);

  return (
    <AuthGate roles={['SUPERADMIN']}>
      <main className="p-6 max-w-6xl mx-auto">
        <div className="mb-4">
          <Link href="/superadmin/organizaciones" className="text-blue-600 hover:underline">
            ← Volver a organizaciones
          </Link>
        </div>

        <h1 className="text-2xl font-bold mb-4">
          Usuarios de {org?.nombre ?? 'Organización'}
        </h1>

        {msg && (
          <div className="mb-4 p-3 rounded bg-red-100 text-red-800">{msg}</div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Listado de usuarios</CardTitle>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usuarios.map((u) => (
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {!loading && usuarios.length === 0 && (
              <p className="text-gray-500">No hay usuarios en esta organización.</p>
            )}
          </CardContent>
        </Card>
      </main>
    </AuthGate>
  );
}
