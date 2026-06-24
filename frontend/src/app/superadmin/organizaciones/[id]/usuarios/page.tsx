"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import AuthGate from "@/components/auth/AuthGate";
import { api, getErrorMessage } from "@/servicios/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageContainer, PageHeader } from "@/components/ui-kit";

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
          headers: { "X-Organizacion-ID": id },
        }),
        api<UsuarioRow[]>(`/organizaciones/${id}/usuarios`, {
          headers: { "X-Organizacion-ID": id },
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
    <AuthGate roles={["SUPERADMIN"]}>
      <PageContainer>
        <PageHeader
          title={`Usuarios de ${org?.nombre ?? "organización"}`}
          subtitle="Visualización de usuarios y roles para esta organización"
        >
          <Button variant="outline" size="sm" asChild>
            <Link href="/superadmin/organizaciones">
              ← Volver a organizaciones
            </Link>
          </Button>
        </PageHeader>

        {msg && (
          <div
            className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
            role="alert"
          >
            {msg}
          </div>
        )}

        <Card className="overflow-hidden rounded-xl border-neutral-200">
          <CardHeader>
            <CardTitle className="text-neutral-900">
              Listado de usuarios
            </CardTitle>
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
                    <TableHead className="font-semibold text-neutral-700">
                      Nombre
                    </TableHead>
                    <TableHead className="font-semibold text-neutral-700">
                      Email
                    </TableHead>
                    <TableHead className="font-semibold text-neutral-700">
                      Roles
                    </TableHead>
                    <TableHead className="font-semibold text-neutral-700">
                      Estado
                    </TableHead>
                    <TableHead className="font-semibold text-neutral-700">
                      Último login
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usuarios.map((u) => (
                    <TableRow key={u.id} className="border-neutral-100">
                      <TableCell className="font-medium text-neutral-900">
                        {u.apellido}, {u.nombre}
                      </TableCell>
                      <TableCell className="text-neutral-600">
                        {u.email}
                      </TableCell>
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
                          variant={u.estado === "ACTIVO" ? "default" : "outline"}
                          className="font-medium"
                        >
                          {u.estado}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-neutral-600">
                        {u.ultimoLogin
                          ? new Date(u.ultimoLogin).toLocaleString("es-AR")
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {!loading && usuarios.length === 0 && (
              <div className="border-t border-neutral-100 bg-neutral-50/60 px-6 py-4 text-sm text-neutral-500">
                No hay usuarios en esta organización.
              </div>
            )}
          </CardContent>
        </Card>
      </PageContainer>
    </AuthGate>
  );
}
