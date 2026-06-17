"use client";

import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui-kit/Money";

type Props = {
  afiliadoId: string | number;
  estado: "activo" | "baja" | "ninguno";
  precioJ22: number | string | null | undefined;
  precioJ38: number | string | null | undefined;
  padronImputacion?: string | null;
  fechaAlta?: string | null;
  className?: string;
};

/**
 * Resumen compacto del coseguro para la ficha del afiliado.
 *
 * Reemplaza al panel "Coseguro" mínimo que sólo mostraba J22 base.
 * Incluye desglose J22 / J38 / total y CTA al detalle (donde se gestiona
 * activación, imputación y grupo familiar).
 */
export function CoseguroResumenSection({
  afiliadoId,
  estado,
  precioJ22,
  precioJ38,
  padronImputacion,
  fechaAlta,
  className,
}: Props) {
  const j22 = Number(precioJ22 ?? 0) || 0;
  const j38 = Number(precioJ38 ?? 0) || 0;
  const total = j22 + j38;

  const variant: "success" | "error" | "secondary" =
    estado === "activo" ? "success" : estado === "baja" ? "error" : "secondary";
  const label =
    estado === "activo" ? "Activo" : estado === "baja" ? "Baja" : "Sin alta";

  return (
    <div
      className={`rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm ${className ?? ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-base font-semibold text-neutral-900">Coseguro</div>
        <Badge variant={variant}>{label}</Badge>
      </div>

      <div className="mt-4 space-y-3 text-sm">
        <Row label="J22 (titular)" value={<Money amount={j22} />} />
        <Row label="J38 (colaterales)" value={<Money amount={j38} />} />
        <div className="h-px w-full bg-neutral-100" />
        <Row
          label="Total mensual"
          value={
            <span className="font-bold text-neutral-900">
              <Money amount={total} />
            </span>
          }
        />
        <div className="h-px w-full bg-neutral-100" />
        <Row
          label="Padrón imputación"
          value={padronImputacion || "—"}
        />
        {fechaAlta && (
          <Row label="Alta" value={fechaAlta.slice(0, 10)} />
        )}
      </div>

      <div className="mt-4">
        <Link href={`/coseguro/${afiliadoId}`}>
          <Button variant="outline" size="sm" className="w-full">
            Gestionar coseguro →
          </Button>
        </Link>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-neutral-500">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}
