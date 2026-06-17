"use client";

import * as React from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  historialSuspensiones,
  type Suspension,
} from "@/servicios/suspensiones";

type Props = {
  afiliadoId: string;
};

/**
 * Tab "Historial" del coseguro.
 *
 * Por ahora muestra el historial de suspensiones del afiliado (es lo único
 * que el backend expone hoy en términos de timeline). Cuando agreguemos
 * eventos de coseguro (alta/baja J22, cambios de imputación, cambios de
 * J38, reasignaciones), los unificamos con el mismo componente.
 */
export function TabHistorial({ afiliadoId }: Props) {
  const [suspensiones, setSuspensiones] = React.useState<Suspension[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const sus = await historialSuspensiones(afiliadoId);
        if (!cancel) setSuspensiones(sus);
      } catch (e) {
        if (!cancel) {
          setError(e instanceof Error ? e.message : "Error cargando historial");
        }
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [afiliadoId]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Suspensiones</CardTitle>
            <CardDescription>
              Historial de suspensiones de cobertura del afiliado.
            </CardDescription>
          </div>
          <Link href={`/afiliados/${afiliadoId}/estado`}>
            <Button variant="outline" size="sm">
              Ver estado completo →
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-neutral-500">Cargando…</div>
          ) : error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          ) : suspensiones.length === 0 ? (
            <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center text-sm text-neutral-500">
              Sin suspensiones registradas.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-neutral-200">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-xs uppercase text-neutral-600">
                  <tr>
                    <th className="px-3 py-2 text-left">Período origen</th>
                    <th className="px-3 py-2 text-center">Estado</th>
                    <th className="px-3 py-2 text-left">Inicio</th>
                    <th className="px-3 py-2 text-left">Firme</th>
                    <th className="px-3 py-2 text-left">Fin</th>
                    <th className="px-3 py-2 text-left">Motivo fin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {suspensiones.map((s) => (
                    <tr key={s.id} className="hover:bg-neutral-50">
                      <td className="px-3 py-2 tabular-nums">{s.periodoOrigen}</td>
                      <td className="px-3 py-2 text-center">
                        <Badge variant={badgeVariant(s.estado)}>
                          {s.estado}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">{fmt(s.fechaInicio)}</td>
                      <td className="px-3 py-2">{fmt(s.fechaFirme)}</td>
                      <td className="px-3 py-2">{fmt(s.fechaFin)}</td>
                      <td className="px-3 py-2 text-neutral-600">
                        {s.motivoFin || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Eventos del coseguro
            <Badge variant="warning">Próximamente</Badge>
          </CardTitle>
          <CardDescription>
            Alta/baja del J22, reasignaciones de padrón, cambios de
            integrantes y otras acciones quedarán acá cuando el backend
            exponga el feed de auditoría.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

function badgeVariant(
  estado: Suspension["estado"],
): "default" | "secondary" | "success" | "warning" | "error" {
  switch (estado) {
    case "firme":
      return "error";
    case "provisoria":
      return "warning";
    case "revertida":
    case "rehabilitada":
      return "success";
    default:
      return "secondary";
  }
}

function fmt(d?: string | null) {
  if (!d) return "—";
  return d.slice(0, 10);
}
