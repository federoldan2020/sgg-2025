"use client";

import * as React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Props = {
  /** Órdenes consumidas en el mes corriente. `null` mientras no haya endpoint. */
  consumidas?: number | null;
  /** Cupo total mensual vigente. `null` mientras no haya endpoint. */
  cupo?: number | null;
  loading?: boolean;
};

/**
 * Indicador inline del cupo de órdenes de farmacia del mes corriente.
 * Mientras el backend (`OrdenFarmaciaConsumo`) no exponga el endpoint, se
 * renderiza un placeholder "—/4" tomando el cupo de regla si está disponible.
 */
export function CupoOrdenesInline({ consumidas, cupo, loading }: Props) {
  if (loading) {
    return (
      <div className="inline-flex items-center gap-1.5 text-xs text-neutral-500">
        <span className="inline-block size-2.5 rounded-full bg-neutral-300 animate-pulse" />
        <span>Órdenes …</span>
      </div>
    );
  }

  const tieneDatos = typeof consumidas === "number" && typeof cupo === "number";
  const restantes = tieneDatos ? Math.max(0, cupo! - consumidas!) : null;
  const sinSaldo = tieneDatos && restantes === 0;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium",
              sinSaldo
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-neutral-200 bg-white text-neutral-700",
            )}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <line x1="3" y1="10" x2="21" y2="10" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="16" y1="2" x2="16" y2="6" />
            </svg>
            <span>
              Órdenes{" "}
              <span className="tabular-nums">
                {tieneDatos ? `${consumidas}/${cupo}` : "—"}
              </span>
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs">
            {tieneDatos
              ? `${restantes} disponibles de ${cupo} este mes`
              : "Cupo mensual de órdenes de farmacia (pendiente de conectar al backend)"}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
