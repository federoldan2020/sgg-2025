"use client";

import { AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { formatearFechaArgentina } from "@/utiles/formatos";
import type { OrdenDetallesPagos } from "./types";

const money = (n: number | string) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(typeof n === "string" ? Number(n || 0) : n || 0);

const fmtFecha = (iso: string) => formatearFechaArgentina(iso) || iso;

export function DetallesOrden({ detalles }: { detalles: OrdenDetallesPagos }) {
  const { orden, cuotas } = detalles;

  const estadoBadge = (estado: string) => (
    <Badge variant="outline" className="rounded-full">
      {estado}
    </Badge>
  );

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold truncate">{orden.descripcion}</h4>
              {estadoBadge(orden.estado)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Alta: {fmtFecha(orden.fechaAlta)}
            </p>
          </div>

          <div className="text-right">
            <div className="text-xs text-muted-foreground">Total</div>
            <div className="text-sm font-semibold tabular-nums">
              {money(orden.importeTotal)}
            </div>
          </div>
        </div>

        <Separator className="my-3" />

        <div className="grid grid-cols-3 gap-3">
          <div>
            <div className="text-xs text-muted-foreground">Pagado</div>
            <div className="text-sm font-semibold tabular-nums text-emerald-600">
              {money(orden.totalPagado)}
            </div>
            <div className="text-xs text-muted-foreground">
              {orden.porcentajePagado.toFixed(1)}%
            </div>
          </div>

          <div>
            <div className="text-xs text-muted-foreground">Pendiente</div>
            <div className="text-sm font-semibold tabular-nums text-destructive">
              {money(orden.saldoTotal)}
            </div>
          </div>

          <div>
            <div className="text-xs text-muted-foreground">Cuotas</div>
            <div className="text-sm font-semibold tabular-nums">
              {orden.cantidadCuotas}
            </div>
          </div>
        </div>
      </Card>

      <div className="space-y-2">
        <div className="text-sm font-semibold">Cuotas</div>

        {cuotas.map((cuota) => {
          const badge =
            cuota.estadoCalculado === "pagada"
              ? {
                  label: "Pagada",
                  icon: CheckCircle2,
                  className: "border-emerald-200 bg-emerald-50 text-emerald-700",
                }
              : cuota.estadoCalculado === "parcialmente_pagada"
              ? {
                  label: "Parcial",
                  icon: Clock,
                  className: "border-amber-200 bg-amber-50 text-amber-700",
                }
              : {
                  label: "Pendiente",
                  icon: AlertCircle,
                  className: "border-border bg-muted text-muted-foreground",
                };

          const Icon = badge.icon;

          return (
            <Card key={cuota.id} className="p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold">
                      Cuota {cuota.numero}/{orden.cantidadCuotas}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({cuota.periodoVenc})
                    </span>
                    <Badge
                      variant="outline"
                      className={cn("rounded-full gap-1", badge.className)}
                    >
                      <Icon className="h-3 w-3" />
                      {badge.label}
                    </Badge>
                  </div>

                  {cuota.pagos?.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <div className="text-xs font-semibold text-muted-foreground">
                        Pagos
                      </div>

                      <div className="space-y-1">
                        {cuota.pagos.map((pago) => {
                          const esNomina = pago.origen === "nomina";
                          return (
                            <div
                              key={pago.id}
                              className="flex items-center justify-between rounded-md bg-muted/50 px-2 py-1.5 text-xs gap-2"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <Badge
                                  variant="secondary"
                                  className={cn(
                                    "rounded",
                                    esNomina
                                      ? "bg-blue-50 text-blue-700"
                                      : "bg-amber-50 text-amber-700",
                                  )}
                                >
                                  {esNomina ? "Nómina" : "Caja"}
                                  {pago.periodoContable
                                    ? ` (${pago.periodoContable})`
                                    : ""}
                                </Badge>
                                <span className="text-muted-foreground">
                                  {fmtFecha(pago.fecha)}
                                </span>
                              </div>

                              <span className="font-semibold tabular-nums text-emerald-600">
                                {money(pago.importe)}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex items-center justify-between pt-1 text-xs font-semibold">
                        <span>Total pagado:</span>
                        <span className="tabular-nums text-emerald-600">
                          {money(cuota.totalPagado)} ({cuota.porcentajePagado.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="text-right shrink-0">
                  <div className="text-sm font-semibold tabular-nums">
                    {money(cuota.importe)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Saldo: <span className="tabular-nums">{money(cuota.saldo)}</span>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
