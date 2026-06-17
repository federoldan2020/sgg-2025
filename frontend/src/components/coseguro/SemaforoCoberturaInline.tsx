"use client";

import * as React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Cobertura } from "@/servicios/suspensiones";

type Estado = "ok" | "warn" | "off" | "loading";

function estadoDe(esperado: number, cubierto: boolean | undefined): Estado {
  if (esperado === 0) return "off";
  if (cubierto === true) return "ok";
  return "warn";
}

function Dot({ estado, label, hint }: { estado: Estado; label: string; hint: string }) {
  const color =
    estado === "ok"
      ? "bg-green-500"
      : estado === "warn"
        ? "bg-amber-500"
        : estado === "loading"
          ? "bg-neutral-300 animate-pulse"
          : "bg-neutral-300";
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex items-center gap-1.5">
            <span
              className={cn("inline-block size-2.5 rounded-full", color)}
              aria-label={`${label}: ${estado}`}
            />
            <span className="text-xs font-medium text-neutral-700">{label}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs">{hint}</div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

type Props = {
  cobertura?: Cobertura | null;
  loading?: boolean;
};

/**
 * Tres dots: J17 / J22 / J38, con tooltip de "Esperado X vs Cobrado Y".
 * "off" = el concepto no aplica al afiliado (esperado=0).
 */
export function SemaforoCoberturaInline({ cobertura, loading }: Props) {
  if (loading) {
    return (
      <div className="inline-flex items-center gap-4">
        <Dot estado="loading" label="J17" hint="Cargando…" />
        <Dot estado="loading" label="J22" hint="Cargando…" />
        <Dot estado="loading" label="J38" hint="Cargando…" />
      </div>
    );
  }

  if (!cobertura) {
    return (
      <div className="inline-flex items-center gap-4">
        <Dot estado="off" label="J17" hint="Sin datos de cobertura para el período" />
        <Dot estado="off" label="J22" hint="Sin datos de cobertura para el período" />
        <Dot estado="off" label="J38" hint="Sin datos de cobertura para el período" />
      </div>
    );
  }

  const fmt = (n: number) =>
    n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  return (
    <div className="inline-flex items-center gap-4">
      <Dot
        estado={estadoDe(cobertura.j17Esperado, cobertura.j17Cubierto)}
        label="J17"
        hint={`Cuota social — esperado $${fmt(cobertura.j17Esperado)} · cobrado $${fmt(cobertura.j17Cobrado)}`}
      />
      <Dot
        estado={estadoDe(cobertura.j22Esperado, cobertura.j22Cubierto)}
        label="J22"
        hint={`Coseguro — esperado $${fmt(cobertura.j22Esperado)} · cobrado $${fmt(cobertura.j22Cobrado)}`}
      />
      <Dot
        estado={estadoDe(cobertura.j38Esperado, cobertura.j38Cubierto)}
        label="J38"
        hint={`Colaterales — esperado $${fmt(cobertura.j38Esperado)} · cobrado $${fmt(cobertura.j38Cobrado)}`}
      />
    </div>
  );
}
