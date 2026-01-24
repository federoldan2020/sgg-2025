"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/servicios/api";
import { formatearFechaArgentina } from "@/utiles/formatos";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  Eye,
} from "lucide-react";

// shadcn
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"; // TODO: Verificar que el módulo existe y está correctamente tipado
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

/* ============================
 * Tipos
 * ============================ */
type AfiliadoSuggest = {
  id: string;
  dni: string;
  display: string;
};

type PadronLite = {
  id: string;
  padron: string;
  afiliadoId: string;
  activo: boolean;
  sistema: string | null;
  saldo: string;
  cupo: string;
};

type Movimiento = {
  id: string;
  fecha: string;
  naturaleza: "debito" | "credito";
  origen: string;
  concepto: string;
  importe: string | number;
  padronId?: string | null;
  obligacionId?: string | null;
  ordenId?: string | null;
  cuotaId?: string | null;
  pagoId?: string | null;
  saldoPosterior?: string | number | null;
  saldoPendiente?: string | number | null;
  asientoId?: string | null;
};

type CtaCteResp = {
  movimientos: Movimiento[];
  saldoFinal: number;
};

type PagoDetalle = {
  id: string;
  fecha: string;
  importe: number;
  concepto: string;
  pagoId?: string | null;
  pagoFecha?: string | null;
  pagoTotal?: number | null;
  origen?: string | null; // 'pago_caja' o 'nomina'
  periodoContable?: string | null;
};

type CuotaDetalle = {
  id: string;
  numero: number;
  periodoVenc: string;
  importe: number;
  cancelado: number;
  saldo: number;
  estado: string;
  totalPagado: number;
  porcentajePagado: number;
  estadoCalculado: "pagada" | "parcialmente_pagada" | "pendiente";
  pagos: PagoDetalle[];
};

type OrdenDetallesPagos = {
  orden: {
    id: string;
    descripcion: string;
    fechaAlta: string;
    importeTotal: number;
    saldoTotal: number;
    cantidadCuotas: number;
    estado: string;
    totalPagado: number;
    porcentajePagado: number;
  };
  cuotas: CuotaDetalle[];
};

/* ============================
 * Fetchers
 * ============================ */
const buscarAfiliados = async (q: string) =>
  api<AfiliadoSuggest[]>(`/afiliados/suggest?q=${encodeURIComponent(q)}`, {
    method: "GET",
  });

const padronesActivos = async (afiliadoId: string) =>
  api<PadronLite[]>(`/padrones?afiliadoId=${encodeURIComponent(afiliadoId)}`, {
    method: "GET",
  });

const listarMovimientos = (params: {
  afiliadoId: string;
  padronId?: string;
  take?: number;
  periodoContable?: string;
}): Promise<CtaCteResp> => {
  const qs = new URLSearchParams();
  qs.set("afiliadoId", params.afiliadoId);
  if (params.padronId) qs.set("padronId", params.padronId);
  if (params.take) qs.set("take", String(params.take));
  if (params.periodoContable) qs.set("periodoContable", params.periodoContable);
  return api<CtaCteResp>(`/movimientos?${qs.toString()}`, { method: "GET" });
};

const obtenerDetallesPagosOrden = async (
  ordenId: string
): Promise<OrdenDetallesPagos> => {
  return api<OrdenDetallesPagos>(`/ordenes/detalles-pagos/${ordenId}`, {
    method: "GET",
  });
};

/* ============================
 * Helpers
 * ============================ */
const money = (n: number | string) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(typeof n === "string" ? Number(n || 0) : n || 0);

function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const h = setTimeout(() => setV(value), ms);
    return () => clearTimeout(h);
  }, [value, ms]);
  return v;
}

function fmtFecha(iso: string) {
  return formatearFechaArgentina(iso) || iso;
}

/* ============================
 * Page
 * ============================ */
export default function MovimientosPage() {
  const searchParams = useSearchParams();
  const afiliadoIdParam = searchParams.get("afiliadoId");

  const [afiliado, setAfiliado] = useState<AfiliadoSuggest | null>(null);

  const [padrones, setPadrones] = useState<PadronLite[]>([]);
  const [padronId, setPadronId] = useState<string>("");

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const dSelectedDate = useDebounced(selectedDate, 250);

  const [data, setData] = useState<CtaCteResp | null>(null);
  const [loading, setLoading] = useState(false);

  // preselección por querystring
  useEffect(() => {
    if (!afiliadoIdParam) return;
    buscarAfiliados(afiliadoIdParam).then((res) => {
      if (res?.length) setAfiliado(res[0]);
    });
  }, [afiliadoIdParam]);

  // cargar padrones al seleccionar afiliado
  useEffect(() => {
    if (!afiliado?.id) {
      setPadrones([]);
      setPadronId("");
      return;
    }
    padronesActivos(afiliado.id).then((res) => {
      setPadrones(res);
      setPadronId((prev) => prev || res?.[0]?.id || "");
    });
  }, [afiliado?.id]);

  // cargar movimientos
  useEffect(() => {
    (async () => {
      if (!afiliado?.id) {
        setData(null);
        return;
      }
      setLoading(true);
      try {
        const year = dSelectedDate.getFullYear();
        const month = dSelectedDate.getMonth();
        const periodoContable = `${year}-${String(month + 1).padStart(2, "0")}`;

        const resp = await listarMovimientos({
          afiliadoId: afiliado.id,
          padronId: padronId || undefined,
          periodoContable,
          take: 500,
        });

        setData(resp);
      } finally {
        setLoading(false);
      }
    })();
  }, [afiliado?.id, padronId, dSelectedDate]);

  const padronSel = useMemo(
    () => padrones.find((p) => p.id === padronId),
    [padrones, padronId]
  );

  const saldoFinal = data?.saldoFinal ?? 0;

  const totalDebitos =
    data?.movimientos
      .filter((m) => m.naturaleza === "debito")
      .reduce((a, b) => a + Number(b.importe || 0), 0) ?? 0;

  const totalCreditos =
    data?.movimientos
      .filter((m) => m.naturaleza === "credito")
      .reduce((a, b) => a + Number(b.importe || 0), 0) ?? 0;

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto px-6">
      {/* PageHeader */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Movimientos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cuenta corriente de afiliados
          </p>
        </div>

        <AfiliadoCombobox value={afiliado} onSelect={setAfiliado} />
      </div>

      {!afiliado ? (
        <EmptyState />
      ) : (
        <>
          {/* EntitySummaryCard */}
          <Card className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-xl font-semibold truncate">{afiliado.display}</h2>
                <div className="mt-1 text-xs text-muted-foreground">
                  DNI {afiliado.dni}
                </div>

                {padronSel && (
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                    <Badge
                      variant="outline"
                      className={cn(
                        "rounded-full",
                        padronSel.activo
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-border bg-muted text-muted-foreground"
                      )}
                    >
                      {padronSel.activo ? "Activo" : "Inactivo"}
                    </Badge>

                    <span className="text-muted-foreground">
                      Saldo:{" "}
                      <span className="font-semibold text-foreground tabular-nums">
                        {money(padronSel.saldo)}
                      </span>
                    </span>

                    <span className="text-muted-foreground">
                      Cupo:{" "}
                      <span className="font-semibold text-foreground tabular-nums">
                        {money(padronSel.cupo)}
                      </span>
                    </span>

                    {padronSel.sistema && (
                      <span className="text-muted-foreground">
                        Sistema:{" "}
                        <span className="font-semibold text-foreground">
                          {padronSel.sistema}
                        </span>
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="text-xs font-medium text-muted-foreground">
                  Padrón
                </div>

                <Select value={padronId} onValueChange={setPadronId}>
                  <SelectTrigger className="h-10 w-[180px]">
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {padrones.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.padron} {!p.activo ? "(inactivo)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator className="my-4" />

            <PeriodToolbar
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              disabled={!afiliado}
            />
          </Card>

          {/* KPI Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <KpiCard
              label="Lo que nos debe"
              value={money(totalDebitos)}
              tone="debit"
            />
            <KpiCard
              label="Lo que nos paga"
              value={money(totalCreditos)}
              tone="credit"
            />
            <KpiCard
              label={
                saldoFinal < 0
                  ? "Saldo final (a favor del afiliado)"
                  : "Saldo final (deuda total acumulada)"
              }
              value={money(saldoFinal)}
              tone={saldoFinal < 0 ? "credit" : saldoFinal > 0 ? "debit" : "neutral"}
            />
          </div>

          {/* Table */}
          <TablaMovimientos
            rows={data?.movimientos || []}
            loading={loading}
          />
        </>
      )}
    </div>
  );
}

/* ============================
 * UI Pieces
 * ============================ */

function EmptyState() {
  return (
    <Card className="p-10">
      <div className="text-center">
        <Search className="mx-auto h-10 w-10 text-muted-foreground/70" />
        <h3 className="mt-4 text-sm font-semibold">Sin afiliado seleccionado</h3>
        <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
          Busca un afiliado por DNI, nombre o padrón para ver su cuenta corriente.
        </p>
      </div>
    </Card>
  );
}

function KpiCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "debit" | "credit" | "neutral";
}) {
  return (
    <Card className="p-5">
      <div className="space-y-1">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div
          className={cn(
            "text-2xl font-semibold tabular-nums",
            tone === "debit" && "text-destructive",
            tone === "credit" && "text-emerald-600"
          )}
        >
          {value}
        </div>
      </div>
    </Card>
  );
}

/**
 * PeriodToolbar premium (no “flota”, todo consistente)
 */
function PeriodToolbar({
  selectedDate,
  onDateChange,
  disabled,
}: {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  disabled: boolean;
}) {
  const isCurrentMonth = useMemo(() => {
    const now = new Date();
    return (
      selectedDate.getFullYear() === now.getFullYear() &&
      selectedDate.getMonth() === now.getMonth()
    );
  }, [selectedDate]);

  const monthYear = useMemo(() => {
    return selectedDate.toLocaleString("es-AR", { month: "long", year: "numeric" });
  }, [selectedDate]);

  const goToPrevMonth = () => {
    const d = new Date(selectedDate);
    d.setMonth(d.getMonth() - 1);
    onDateChange(d);
  };

  const goToNextMonth = () => {
    const d = new Date(selectedDate);
    d.setMonth(d.getMonth() + 1);
    onDateChange(d);
  };

  const goToToday = () => onDateChange(new Date());

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="inline-flex items-center gap-2 rounded-lg border bg-background px-2 py-1">
        <Button
          variant="outline"
          size="icon"
          onClick={goToPrevMonth}
          disabled={disabled}
          aria-label="Mes anterior"
          className="h-8 w-8"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="min-w-[160px] text-center text-sm font-medium capitalize">
          {monthYear}
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={goToNextMonth}
          disabled={disabled}
          aria-label="Mes siguiente"
          className="h-8 w-8"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        {!isCurrentMonth && (
          <>
            <Separator orientation="vertical" className="mx-1 h-6" />
            <Button
              variant="outline"
              size="sm"
              onClick={goToToday}
              disabled={disabled}
              className="h-8"
            >
              Hoy
            </Button>
          </>
        )}
      </div>

      <div className="text-xs text-muted-foreground">
        Tip: usá el selector para navegar por período contable.
      </div>
    </div>
  );
}

/**
 * Combobox shadcn para afiliados (Popover + Command)
 * - evita dropdown "a mano"
 * - mejor UX + accesibilidad
 */
function AfiliadoCombobox({
  value,
  onSelect,
}: {
  value: AfiliadoSuggest | null;
  onSelect: (a: AfiliadoSuggest | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 250);
  const [items, setItems] = useState<AfiliadoSuggest[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (dq.trim().length < 2) {
      setItems([]);
      return;
    }
    setLoading(true);
    buscarAfiliados(dq)
      .then(setItems)
      .finally(() => setLoading(false));
  }, [dq]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-10 w-[420px] justify-start gap-2 text-muted-foreground"
          onClick={() => setOpen(true)}
        >
          <Search className="h-4 w-4" />
          <span className={cn("truncate", value ? "text-foreground" : "")}>
            {value ? value.display : "Buscar afiliado (DNI, nombre o padrón)…"}
          </span>
        </Button>
      </PopoverTrigger>

      <PopoverContent className="p-0 w-[420px]" align="end">
        <Command>
          <CommandInput
            ref={inputRef as React.RefObject<HTMLInputElement>}
            placeholder="Escribí al menos 2 caracteres…"
            value={q}
            onValueChange={setQ}
          />
          <CommandList>
            {loading && (
              <div className="p-3">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="mt-2 h-3 w-1/3" />
              </div>
            )}
            {!loading && <CommandEmpty>Sin resultados.</CommandEmpty>}

            <CommandGroup heading="Afiliados">
              {items.map((s) => (
                <CommandItem
                  key={s.id}
                  value={`${s.display} ${s.dni}`}
                  onSelect={() => {
                    onSelect(s);
                    setOpen(false);
                    setQ("");
                    setItems([]);
                  }}
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{s.display}</span>
                    <span className="text-xs text-muted-foreground">DNI {s.dni}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>

            {value && (
              <>
                <Separator />
                <div className="p-2">
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-destructive"
                    onClick={() => {
                      onSelect(null);
                      setOpen(false);
                      setQ("");
                      setItems([]);
                    }}
                  >
                    Quitar selección
                  </Button>
                </div>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function TablaMovimientos({ rows, loading }: { rows: Movimiento[]; loading: boolean }) {
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

  const getEstadoBadge = (
    saldoPendiente: string | number | null | undefined,
    importe: string | number
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
      case "ajuste":
        return "bg-muted text-foreground";
      case "anulacion":
        return "bg-red-50 text-red-700";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

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
                  // Standard: mostramos "Saldo" (pendiente si aplica, sino saldo posterior)
                  if (m.naturaleza === "debito" && m.saldoPendiente != null) return money(m.saldoPendiente);
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

      {/* Sheet detalle de orden */}
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

/* ============================
 * Detalle Orden (mantenido, estilado con tokens)
 * ============================ */

function DetallesOrden({ detalles }: { detalles: OrdenDetallesPagos }) {
  const { orden, cuotas } = detalles;

  const estadoBadge = (estado: string) => {
    // si querés normalizar estados desde backend, hacelo acá
    return (
      <Badge variant="outline" className="rounded-full">
        {estado}
      </Badge>
    );
  };

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
                                      : "bg-amber-50 text-amber-700"
                                  )}
                                >
                                  {esNomina ? "Nómina" : "Caja"}
                                  {pago.periodoContable ? ` (${pago.periodoContable})` : ""}
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
