"use client";

import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * Versión "shape flexible" del integrante.
 * El backend devuelve dos formatos según el endpoint:
 *   - `parentescoNombre` (string plano, endpoint del módulo coseguro).
 *   - `parentesco: { codigo, descripcion }` (Prisma include en otros endpoints).
 *
 * El componente acepta ambas y resuelve el label.
 */
export type IntegranteShape = {
  id: string | number;
  nombre?: string | null;
  dni?: string | number | null;
  fechaNacimiento?: string | null;
  activo?: boolean | null;
  esColateral?: boolean | null;
  esEstudiante?: boolean | null;
  esDiscapacitado?: boolean | null;
  tieneAportes?: boolean | null;
  parentescoNombre?: string | null;
  parentescoId?: string | number;
  parentesco?: {
    codigo?: string | number | null;
    descripcion?: string | null;
  } | null;
};

type Props = {
  /** Id del afiliado titular — para construir el link de "Gestionar". */
  afiliadoId: string | number;
  integrantes: IntegranteShape[];
  /** Si es true, oculta el botón "Gestionar" (ej. cuando no hay coseguro). */
  hideCTA?: boolean;
  className?: string;
};

function edadDesde(fechaNac?: string | null): number | null {
  if (!fechaNac) return null;
  const d = new Date(fechaNac);
  if (Number.isNaN(d.getTime())) return null;
  const hoy = new Date();
  let edad = hoy.getFullYear() - d.getFullYear();
  const m = hoy.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < d.getDate())) edad--;
  return edad;
}

function formatDni(dni: string | number | null | undefined) {
  if (dni == null) return "—";
  const s = String(dni).replace(/\D+/g, "");
  if (!s) return "—";
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function parentescoLabel(i: IntegranteShape) {
  return (
    i.parentescoNombre ||
    i.parentesco?.descripcion ||
    (i.parentesco?.codigo != null ? String(i.parentesco.codigo) : null) ||
    "—"
  );
}

/**
 * Sección de "Grupo familiar" reutilizable.
 * SOLO LECTURA — la edición/alta/baja se hace en /coseguro/[id] (tab Cobertura).
 * Por eso incluye un CTA hacia ese detalle.
 */
export function GrupoFamiliarSection({
  afiliadoId,
  integrantes,
  hideCTA = false,
  className,
}: Props) {
  const totales = React.useMemo(() => {
    const activos = integrantes.filter((i) => i.activo !== false);
    const conJ38 = activos.filter((i) => i.esColateral !== false);
    return {
      total: integrantes.length,
      activos: activos.length,
      conJ38: conJ38.length,
      grupoFam: activos.length - conJ38.length,
    };
  }, [integrantes]);

  return (
    <div
      className={`rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm ${className ?? ""}`}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-neutral-900">
            Grupo familiar
          </div>
          <div className="mt-0.5 text-xs text-neutral-500">
            {totales.activos} activo{totales.activos === 1 ? "" : "s"}
            {totales.conJ38 > 0 && (
              <>
                {" · "}
                {totales.conJ38} con J38
              </>
            )}
            {totales.grupoFam > 0 && (
              <>
                {" · "}
                {totales.grupoFam} sin recargo
              </>
            )}
            {totales.total > totales.activos && (
              <>
                {" · "}
                {totales.total - totales.activos} baja
                {totales.total - totales.activos === 1 ? "" : "s"}
              </>
            )}
          </div>
        </div>

        {!hideCTA && (
          <Link href={`/coseguro/${afiliadoId}`}>
            <Button variant="outline" size="sm">
              Gestionar grupo familiar →
            </Button>
          </Link>
        )}
      </div>

      {integrantes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center text-sm text-neutral-500">
          Sin integrantes cargados.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b text-xs uppercase text-neutral-500">
              <tr>
                <th className="py-2 text-left">Parentesco</th>
                <th className="py-2 text-left">Nombre</th>
                <th className="py-2 text-left">DNI</th>
                <th className="py-2 text-center">Edad</th>
                <th className="py-2 text-left">Condición</th>
                <th className="py-2 text-center">Rol</th>
                <th className="py-2 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {integrantes.map((i) => {
                const edad = edadDesde(i.fechaNacimiento);
                const flags: string[] = [];
                if (i.esEstudiante) flags.push("Estudiante");
                if (i.esDiscapacitado) flags.push("Discap.");
                if (i.tieneAportes) flags.push("Con aportes");
                const esJ38 = i.esColateral !== false;
                return (
                  <tr key={String(i.id)} className="hover:bg-neutral-50">
                    <td className="py-2 text-neutral-700">{parentescoLabel(i)}</td>
                    <td className="py-2 font-semibold text-neutral-900">
                      {i.nombre || "—"}
                    </td>
                    <td className="py-2 text-neutral-600">{formatDni(i.dni)}</td>
                    <td className="py-2 text-center tabular-nums">
                      {edad ?? "—"}
                    </td>
                    <td className="py-2">
                      {flags.length === 0 ? (
                        <span className="text-neutral-400">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {flags.map((f) => (
                            <Badge key={f} variant="secondary">
                              {f}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-2 text-center">
                      <Badge variant={esJ38 ? "medical" : "secondary"}>
                        {esJ38 ? "J38" : "GF"}
                      </Badge>
                    </td>
                    <td className="py-2 text-center">
                      <Badge variant={i.activo === false ? "secondary" : "success"}>
                        {i.activo === false ? "Baja" : "Activo"}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
