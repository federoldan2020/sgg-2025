"use client";

import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { formatearFechaArgentina } from "@/utiles/formatos";
import { obtenerDetallesPagosOrden } from "./api";
import { DetallesOrden } from "./DetallesOrden";
import type { Movimiento, OrdenDetallesPagos } from "./types";

const money = (n: number | string) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(typeof n === "string" ? Number(n || 0) : n || 0);

const fmtFecha = (iso: string) => formatearFechaArgentina(iso) || iso;

const getEstadoBadge = (
  saldoPendiente: string | number | null | undefined,
  importe: string | number,
) => {
  if (saldoPendiente == null) return null;
  const saldoNum = Number(saldoPendiente);
  const importeNum = Number(importe);

  if (saldoNum <= 0.01)
    return {
      label: "Pagada",
      icon: CheckCircle2,
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  if (saldoNum < importeNum)
    return {
      label: "Parcial",
      icon: Clock,
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  return {
    label: "Pendiente",
    icon: AlertCircle,
    className: "border-border bg-muted text-muted-foreground",
  };
};

const origenBadgeClass = (origen: string) => {
  switch (origen) {
    case "nomina":
      return "bg-blue-50 text-blue-700";
    case "pago_caja":
      return "bg-amber-50 text-amber-700";
    case "orden_credito":
      return "bg-purple-50 text-purple-700";
    case "cuota":
      return "bg-indigo-50 text-indigo-700";
    case "ajuste":
      return "bg-muted text-foreground";
    case "anulacion":
      return "bg-red-50 text-red-700";
    default:
      return "bg-muted text-muted-foreground";
  }
};

export function TablaMovimientos({
  rows,
  loading,
  padronesMap,
}: {
  rows: Movimiento[];
  loading: boolean;
  /** id → string "padron (sistema?)" para mostrar al lado del concepto. */
  padronesMap?: Map<string, string>;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [ordenIdSel, setOrdenIdSel] = useState<string | null>(null);

  const [cache, setCache] = useState<Map<string, OrdenDetallesPagos>>(new Map());
  const [loadingOrden, setLoadingOrden] = useState(false);

  const openOrden = async (ordenId: string) => {
    setOrdenIdSel(ordenId);
    setSheetOpen(true);

    if (cache.has(ordenId)) return;

    setLoadingOrden(true);
    try {
      const detalles = await obtenerDetallesPagosOrden(ordenId);
      setCache((prev) => {
        const n = new Map(prev);
        n.set(ordenId, detalles);
        return n;
      });
    } finally {
      setLoadingOrden(false);
    }
  };

  const detalles = ordenIdSel ? cache.get(ordenIdSel) : null;

  if (loading && rows.length === 0) {
    return (
      <Card className="p-5">
        <div className="space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </Card>
    );
  }

  if (!loading && rows.length === 0) {
    return (
      <Card className="p-10 text-center">
        <Search className="mx-auto h-10 w-10 text-muted-foreground/70" />
        <p className="mt-4 text-sm font-semibold">Sin movimientos</p>
        <p className="mt-2 text-sm text-muted-foreground">
          No hay movimientos para el período/padrón seleccionado.
        </p>
      </Card>
    );
  }

  return (
    <>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b">
                <TableHead className="w-[120px]">Fecha</TableHead>
                <TableHead>Concepto</TableHead>
                <TableHead className="text-right">Debe</TableHead>
                <TableHead className="text-right">Haber</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead className="w-[72px] text-right">Detalle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((m) => {
                const isDebito = m.naturaleza === "debito";
                const origenLabel = m.origen.replace(/_/g, " ");
                const estado = getEstadoBadge(m.saldoPendiente, m.importe);

                const saldoCell = (() => {
                  if (m.naturaleza === "debito" && m.saldoPendiente != null)
                    return money(m.saldoPendiente);
                  if (m.saldoPosterior != null) return money(m.saldoPosterior);
                  return "—";
                })();

                return (
                  <TableRow key={m.id} className="hover:bg-muted/40">
                    <TableCell className="py-3 font-medium">
                      {fmtFecha(m.fecha)}
                    </TableCell>

                    <TableCell className="py-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-sm truncate">
                          {m.concepto}
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <Badge
                            variant="secondary"
                            className={cn("rounded", origenBadgeClass(m.origen))}
                          >
                            {origenLabel}
                          </Badge>

                          {m.padronId && padronesMap?.get(String(m.padronId)) && (
                            <Badge
                              variant="outline"
                              className="rounded border-medical-200 bg-medical-50 text-medical-700 font-mono"
                            >
                              Padrón {padronesMap.get(String(m.padronId))}
                            </Badge>
                          )}

                          {estado && (
                            <Badge
                              variant="outline"
                              className={cn("rounded-full gap-1", estado.className)}
                            >
                              <estado.icon className="h-3 w-3" />
                              {estado.label}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="py-3 text-right font-semibold tabular-nums text-destructive">
                      {isDebito ? money(m.importe) : "—"}
                    </TableCell>

                    <TableCell className="py-3 text-right font-semibold tabular-nums text-emerald-600">
                      {!isDebito ? money(m.importe) : "—"}
                    </TableCell>

                    <TableCell className="py-3 text-right font-semibold tabular-nums">
                      {saldoCell}
                    </TableCell>

                    <TableCell className="py-3 text-right">
                      {m.ordenId ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openOrden(m.ordenId!)}
                          aria-label="Ver detalle de orden"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Detalle de orden</SheetTitle>
            <SheetDescription>
              {ordenIdSel ? `Orden #${ordenIdSel}` : "—"}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4">
            {loadingOrden && !detalles ? (
              <div className="space-y-3">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : detalles ? (
              <DetallesOrden detalles={detalles} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Seleccioná una orden para ver el detalle.
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
