/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { api } from "@/servicios/api";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  CreditCard,
  FileText,
  Hash,
  Layers,
  Loader2,
  Search,
  Store,
  Wallet,
} from "lucide-react";

import { PageContainer, PageHeader, Money, EmptyState } from "@/components/ui-kit";

/* ============================================================
   Tipos según endpoints
   ============================================================ */
type PadronLite = {
  id: string;
  padron: string;
  afiliadoId: string;
  activo: boolean;
  sistema: string | null;
  saldo: string;
  cupo: string;
};

type AfiliadoSuggest = {
  id: string;
  dni: string;
  display: string;
};

type Comercio = {
  id: string;
  organizacionId: string;
  codigo: string;
  razonSocial: string;
  domicilio: string | null;
  localidad: string | null;
  fechaIngreso: string | null;
  telefono1: string | null;
  telefono2: string | null;
  email: string | null;
  grupo: number | null;
  departamento: number | null;
  rubro: number | null;
  tipo: number | null;
  cuoMax: number | null;
  pIVA: string | null;
  pGanancia: string | null;
  pIngresosBrutos: string | null;
  pLoteHogar: string | null;
  pRetencion: string | null;
  cuit: string | null;
  iibb: string | null;
  usoContable: boolean | null;
  baja: boolean | null;
  confirma: boolean | null;
  saldoActual: string | null;
  createdAt: string;
  updatedAt: string;
};

type OrdenCreditoLite = {
  id: string;
  fecha: string;
  comercioRazon: string;
  monto: number;
  cuotas: number;
  padron: string;
  estado: "OK" | "PEND" | "ANULADA" | string;
};

/* ============================================================
   Fetchers
   ============================================================ */
const buscarAfiliados = async (q: string) =>
  api<AfiliadoSuggest[]>(`/afiliados/suggest?q=${encodeURIComponent(q)}`, { method: "GET" });

const padronesActivos = async (afiliadoId: string) =>
  api<PadronLite[]>(`/padrones?afiliadoId=${encodeURIComponent(afiliadoId)}`, { method: "GET" });

const buscarComercios = async (q: string) =>
  api<Comercio[]>(`/comercios?q=${encodeURIComponent(q)}`, { method: "GET" });

const crearOrden = async (payload: {
  afiliadoId: string;
  padronId: string;
  comercioId: string;
  monto: number;
  cuotas: number;
}) => api(`/ordenes`, { method: "POST", body: JSON.stringify(payload) });

const listarOrdenesAfiliado = async (afiliadoId: string) =>
  api<any[]>(`/ordenes/${encodeURIComponent(afiliadoId)}`, { method: "GET" });

/* ============================================================
   Helpers
   ============================================================ */
function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const h = setTimeout(() => setV(value), ms);
    return () => clearTimeout(h);
  }, [value, ms]);
  return v;
}

function fmtFechaHora(iso: string) {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("es-AR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(d);
  } catch {
    return iso;
  }
}

function initials(name?: string | null): string {
  if (!name) return "—";
  const parts = name.trim().split(/[\s,]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "—";
}

function normalizeOrdenBackend(o: any): OrdenCreditoLite {
  const fechaSrc = o.fechaAlta ?? o.createdAt ?? o.fecha ?? new Date().toISOString();
  const comercioRazon =
    o.comercio?.razonSocial ??
    o.comercioRazon ??
    (typeof o.comercio === "string" ? o.comercio : null) ??
    "—";
  const cuotasCount = Array.isArray(o.cuotas)
    ? o.cuotas.length
    : Number.isFinite(Number(o.cantidadCuotas ?? o.cuotas))
    ? Number(o.cantidadCuotas ?? o.cuotas)
    : 1;
  const montoNum = Number(o.importeTotal ?? o.total ?? o.monto ?? o.importe ?? 0);
  const padronStr = o.padron?.padron ?? o.padronLabel ?? o.padron ?? o.padronId ?? "—";

  return {
    id: String(o.id),
    fecha: String(fechaSrc),
    comercioRazon: String(comercioRazon),
    monto: montoNum,
    cuotas: cuotasCount,
    padron: String(padronStr),
    estado: String(o.estado ?? "PEND"),
  };
}

/* ============================================================
   Estado badge
   ============================================================ */
function EstadoBadge({ estado }: { estado: string }) {
  const style =
    estado === "OK"
      ? { dot: "bg-emerald-500", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" }
      : estado === "ANULADA"
      ? { dot: "bg-rose-500", cls: "border-rose-200 bg-rose-50 text-rose-700" }
      : estado === "PEND"
      ? { dot: "bg-amber-500", cls: "border-amber-200 bg-amber-50 text-amber-700" }
      : { dot: "bg-neutral-400", cls: "border-neutral-200 bg-neutral-50 text-neutral-700" };

  return (
    <Badge variant="outline" className={cn("gap-1.5 px-2 py-0 text-[11px]", style.cls)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
      {estado}
    </Badge>
  );
}

/* ============================================================
   Página
   ============================================================ */
export default function OrdenesCreditoNuevaPage() {
  const [afQuery, setAfQuery] = useState("");
  const debouncedQuery = useDebounced(afQuery, 220);
  const [afOpts, setAfOpts] = useState<AfiliadoSuggest[]>([]);
  const [afi, setAfi] = useState<AfiliadoSuggest | null>(null);
  const [showOpts, setShowOpts] = useState(false);

  const [padrones, setPadrones] = useState<PadronLite[]>([]);
  const [padronId, setPadronId] = useState<string>("");
  const [ultimas, setUltimas] = useState<OrdenCreditoLite[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);

  // suggest afiliados (debounced)
  useEffect(() => {
    let cancel = false;
    (async () => {
      const q = debouncedQuery.trim();
      if (q.length < 2) return setAfOpts([]);
      const r = await buscarAfiliados(q).catch(() => []);
      if (!cancel) setAfOpts(r);
    })();
    return () => {
      cancel = true;
    };
  }, [debouncedQuery]);

  // al cambiar afiliado: padrones + últimas órdenes
  useEffect(() => {
    if (!afi?.id) {
      setPadrones([]);
      setPadronId("");
      setUltimas([]);
      return;
    }
    let cancel = false;
    (async () => {
      const [ps, ordsRaw] = await Promise.all([
        padronesActivos(afi.id).catch(() => [] as PadronLite[]),
        listarOrdenesAfiliado(afi.id).catch(() => [] as any[]),
      ]);
      if (cancel) return;
      setPadrones(ps);
      setPadronId((prev) => prev || ps[0]?.id || "");
      setUltimas(Array.isArray(ordsRaw) ? ordsRaw.map(normalizeOrdenBackend) : []);
    })();
    return () => {
      cancel = true;
    };
  }, [afi?.id]);

  const padronSel = useMemo(
    () => padrones.find((p) => p.id === padronId),
    [padrones, padronId]
  );

  const resetAll = useCallback(() => {
    setAfi(null);
    setAfQuery("");
    setAfOpts([]);
    setPadrones([]);
    setPadronId("");
    setUltimas([]);
    setTimeout(() => inputRef.current?.focus(), 80);
  }, []);

  // atajos: Ctrl+K focus search, Esc reset
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const target = e.target as HTMLElement;
      const editing =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable ||
        target.closest("[role='combobox']") ||
        target.closest("[role='dialog']");

      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        return;
      }
      if (editing) return;
      if (e.key === "Escape" && afi) {
        e.preventDefault();
        resetAll();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [afi, resetAll]);

  const onCreada = (nueva: OrdenCreditoLite) => {
    setUltimas((prev) => [nueva, ...prev].slice(0, 50));
  };

  return (
    <PageContainer>
      {/* ===== Toolbar sticky: buscador de afiliado ===== */}
      <div className="sticky top-14 z-30 -mx-6 border-b border-neutral-200 bg-white px-6 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute inset-y-0 left-3 my-auto h-4 w-4 text-muted-foreground/80" />
          <Input
            ref={inputRef}
            placeholder="Buscar afiliado por DNI o nombre…"
            value={afQuery}
            onFocus={() => setShowOpts(true)}
            onBlur={() => setTimeout(() => setShowOpts(false), 150)}
            onChange={(e) => {
              setAfQuery(e.target.value);
              setShowOpts(true);
              if (afi) setAfi(null);
            }}
            className="h-11 rounded-xl pl-10 pr-20"
            autoFocus
          />
          <kbd className="pointer-events-none absolute inset-y-0 right-3 my-auto hidden h-fit items-center rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-neutral-400 sm:flex">
            Ctrl K
          </kbd>

          {showOpts && debouncedQuery.trim().length >= 2 && !afi && afOpts.length > 0 && (
            <div className="isolate absolute left-0 right-0 top-full z-[60] mt-1 max-h-80 overflow-y-auto rounded-xl border border-neutral-200 bg-white shadow-xl ring-1 ring-black/5">
              {afOpts.map((o) => (
                <button
                  key={o.id}
                  className="block w-full border-b border-neutral-100 bg-white px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-medical-50"
                  onClick={() => {
                    setAfi(o);
                    setAfQuery(o.display);
                    setShowOpts(false);
                  }}
                >
                  <div className="text-sm font-medium text-neutral-900">{o.display}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">DNI: {o.dni}</div>
                </button>
              ))}
            </div>
          )}
        </div>
          <div className="hidden items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600 lg:flex">
            <span className="font-medium text-neutral-800">Emisión rápida</span>
            <span className="h-3.5 w-px bg-neutral-200" />
            <span>Afiliado, padrón, comercio y cuotas</span>
          </div>
        </div>
      </div>

      <PageHeader
        title="Órdenes de Crédito"
        subtitle="Emisión a comercios · cupo y cuotas"
        className="mb-6 pb-3"
      >
        <Button
          variant="ghost"
          onClick={resetAll}
          className="rounded-xl"
          disabled={!afi}
        >
          Limpiar
          <kbd className="ml-1.5 rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-neutral-400">
            Esc
          </kbd>
        </Button>
      </PageHeader>

      {!afi ? (
        <Card className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <CardContent className="px-6 py-14">
            <div className="mx-auto flex w-full max-w-2xl flex-col items-center text-center">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-medical-50 text-medical-600 shadow-sm">
                <Search className="h-7 w-7" />
              </div>
              <h2 className="text-xl font-semibold tracking-tight text-neutral-900">
                Buscá un afiliado para emitir órdenes
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-neutral-600">
                Ingresá el DNI o el nombre en el buscador superior para revisar
                padrones, cupo disponible y registrar órdenes a comercios.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
                <kbd className="rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-neutral-500">
                  Ctrl K
                </kbd>
                <span>buscar</span>
                <span className="opacity-50">·</span>
                <kbd className="rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-neutral-500">
                  Esc
                </kbd>
                <span>limpiar</span>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {/* ===== Tarjeta de afiliado + KPIs del padrón ===== */}
          <Card className="rounded-2xl border-border/60 shadow-sm">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-medical-400 to-medical-600 text-base font-bold text-white shadow-sm">
                  {initials(afi.display)}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-base font-semibold tracking-tight sm:text-lg">{afi.display}</h2>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>DNI {afi.dni || "—"}</span>
                    {padrones.length > 0 && (
                      <>
                        <span className="opacity-50">·</span>
                        <span>
                          {padrones.length} padr{padrones.length === 1 ? "ón" : "ones"}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Selector de padrón */}
                <div className="shrink-0">
                  <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Padrón
                  </label>
                  <Select
                    value={padronId}
                    onValueChange={setPadronId}
                    disabled={padrones.length === 0}
                  >
                    <SelectTrigger className="h-10 w-[210px] rounded-xl border-neutral-200 bg-white">
                      <SelectValue placeholder="Seleccionar…" />
                    </SelectTrigger>
                    <SelectContent>
                      {padrones.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "h-2 w-2 rounded-full",
                                p.activo ? "bg-emerald-500" : "bg-neutral-400"
                              )}
                            />
                            {p.padron}
                            {p.sistema && (
                              <span className="text-xs text-muted-foreground">· {p.sistema}</span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* KPIs del padrón seleccionado */}
              {padronSel && (
                <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  <KpiTile
                    label="Estado"
                    value={padronSel.activo ? "Activo" : "Inactivo"}
                    accent={padronSel.activo ? "emerald" : "neutral"}
                  />
                  <KpiTile
                    label="Cupo"
                    money={Number(padronSel.cupo)}
                    icon={<Layers className="h-3.5 w-3.5" />}
                  />
                  <KpiTile
                    label="Saldo usado"
                    money={Number(padronSel.saldo)}
                    icon={<Wallet className="h-3.5 w-3.5" />}
                    accent="rose"
                  />
                  <KpiTile
                    label="Disponible"
                    money={Number(padronSel.cupo) - Number(padronSel.saldo)}
                    icon={<CreditCard className="h-3.5 w-3.5" />}
                    accent="medical"
                    emphasize
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* ===== Form nueva orden ===== */}
          <OrdenForm
            afiliado={afi}
            padronId={padronId}
            padronSel={padronSel}
            padronLabel={padronSel?.padron ?? ""}
            onCreada={onCreada}
          />

          {/* ===== Últimas órdenes ===== */}
          <Card className="rounded-2xl border-border/60 shadow-sm">
            <CardHeader className="pb-2.5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="h-4 w-4" />
                    Últimas órdenes
                  </CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {ultimas.length} orden{ultimas.length !== 1 ? "es" : ""} registrada
                    {ultimas.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <TablaOrdenes rows={ultimas} />
            </CardContent>
          </Card>
        </div>
      )}
    </PageContainer>
  );
}

/* ============================================================
   KPI Tile
   ============================================================ */
function KpiTile({
  label,
  value,
  money,
  icon,
  accent = "default",
  emphasize = false,
}: {
  label: string;
  value?: string;
  money?: number;
  icon?: React.ReactNode;
  accent?: "default" | "emerald" | "rose" | "medical" | "neutral";
  emphasize?: boolean;
}) {
  const accentMap: Record<string, string> = {
    default: "text-neutral-900",
    emerald: "text-emerald-700",
    rose: "text-rose-700",
    medical: "text-medical-700",
    neutral: "text-neutral-500",
  };
  return (
    <div
      className={cn(
        "rounded-xl border p-3",
        emphasize
          ? "border-medical-200 bg-medical-50/60"
          : "border-border/60 bg-muted/30"
      )}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={cn("mt-1 text-sm font-semibold tabular-nums sm:text-base", accentMap[accent])}>
        {money !== undefined ? <Money amount={money} /> : value}
      </div>
    </div>
  );
}

/* ============================================================
   Comercio combobox
   ============================================================ */
function ComercioCombobox({
  value,
  onChange,
}: {
  value: Comercio | null;
  onChange: (c: Comercio | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 250);
  const [items, setItems] = useState<Comercio[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (dq.trim().length < 2) {
      setItems([]);
      return;
    }
    setLoading(true);
    buscarComercios(dq)
      .then(setItems)
      .finally(() => setLoading(false));
  }, [dq]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-10 w-full justify-start gap-2 rounded-xl border-neutral-200 bg-white",
            !value && "text-muted-foreground"
          )}
        >
          <Store className="h-4 w-4 shrink-0 text-medical-600" />
          <span className="truncate">{value ? value.razonSocial : "Seleccionar comercio…"}</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[min(520px,calc(100vw-2rem))] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Buscar por razón social, código o CUIT…"
            value={q}
            onValueChange={(v) => {
              setQ(v);
              if (value) onChange(null);
            }}
          />
          <CommandList>
            {loading ? (
              <div className="p-3 text-sm text-muted-foreground">Buscando…</div>
            ) : (
              <CommandEmpty>Sin resultados.</CommandEmpty>
            )}
            <CommandGroup heading="Comercios">
              {items.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`${c.razonSocial} ${c.codigo} ${c.cuit ?? ""}`}
                  onSelect={() => {
                    onChange(c);
                    setOpen(false);
                    setQ("");
                    setItems([]);
                  }}
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{c.razonSocial}</span>
                    <span className="text-xs text-muted-foreground">
                      Código {c.codigo} {c.cuit ? `· CUIT ${c.cuit}` : ""}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/* ============================================================
   Form nueva orden
   ============================================================ */
function OrdenForm({
  afiliado,
  padronId,
  padronSel,
  padronLabel,
  onCreada,
}: {
  afiliado: AfiliadoSuggest;
  padronId: string;
  padronSel: PadronLite | undefined;
  padronLabel: string;
  onCreada: (op: OrdenCreditoLite) => void;
}) {
  const [monto, setMonto] = useState<string>("");
  const [cuotas, setCuotas] = useState<number>(1);
  const [comercio, setComercio] = useState<Comercio | null>(null);
  const [loading, setLoading] = useState(false);

  const enCuotas = Number(cuotas) > 1;
  const montoNum = Number(monto) || 0;
  const cupoDisponible = padronSel
    ? Number(padronSel.cupo) - Number(padronSel.saldo)
    : 0;
  const excedeCupo = montoNum > cupoDisponible && !!padronSel;
  const excedeCuotasMax = comercio?.cuoMax ? cuotas > comercio.cuoMax : false;

  const canSubmit = Boolean(
    afiliado?.id &&
      padronId &&
      comercio?.id &&
      montoNum > 0 &&
      cuotas >= 1 &&
      !excedeCupo &&
      !excedeCuotasMax
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !comercio) return;

    setLoading(true);
    try {
      await crearOrden({
        afiliadoId: afiliado.id,
        padronId,
        comercioId: comercio.id,
        monto: montoNum,
        cuotas: Number(cuotas),
      });

      onCreada({
        id: crypto.randomUUID(),
        fecha: new Date().toISOString(),
        comercioRazon: comercio.razonSocial,
        monto: montoNum,
        cuotas: Number(cuotas),
        padron: padronLabel || padronId,
        estado: "OK",
      });

      setMonto("");
      setCuotas(1);
      setComercio(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="rounded-2xl border-border/60 shadow-sm">
      <CardHeader className="pb-2.5">
        <CardTitle className="flex items-center gap-2 text-base">
          <CheckCircle2 className="h-4 w-4" />
          Nueva orden
        </CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">
          Completá comercio, monto y cuotas para emitir la orden
        </p>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3.5 md:grid-cols-12">
          {/* Comercio */}
          <div className="md:col-span-5">
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Store className="h-3.5 w-3.5" />
              Comercio <span className="text-rose-500">*</span>
            </label>
            <ComercioCombobox value={comercio} onChange={setComercio} />
            {comercio?.cuoMax ? (
              <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                Hasta {comercio.cuoMax} cuota{comercio.cuoMax !== 1 ? "s" : ""}
              </div>
            ) : null}
          </div>

          {/* Monto */}
          <div className="md:col-span-3">
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Wallet className="h-3.5 w-3.5" />
              Monto
            </label>
            <Input
              className={cn(
                "h-10 rounded-xl text-right tabular-nums",
                excedeCupo &&
                  "border-rose-300 focus-visible:border-rose-500 focus-visible:ring-rose-500"
              )}
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              placeholder="0,00"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
            />
            {excedeCupo ? (
              <div className="mt-1.5 flex items-center gap-1 text-xs text-rose-600">
                <AlertCircle className="h-3 w-3" />
                Excede el disponible (<Money amount={cupoDisponible} />)
              </div>
            ) : montoNum > 0 && padronSel ? (
              <div className="mt-1.5 flex items-center gap-1 text-xs text-emerald-600">
                <Check className="h-3 w-3" />
                Queda <Money amount={cupoDisponible - montoNum} />
              </div>
            ) : null}
          </div>

          {/* Cuotas */}
          <div className="md:col-span-2">
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Hash className="h-3.5 w-3.5" />
              Cuotas
            </label>
            <Input
              className={cn(
                "h-10 rounded-xl text-right tabular-nums",
                excedeCuotasMax &&
                  "border-rose-300 focus-visible:border-rose-500 focus-visible:ring-rose-500"
              )}
              type="number"
              min={1}
              step={1}
              value={cuotas}
              onChange={(e) => setCuotas(Math.max(1, Number(e.target.value) || 1))}
            />
            {excedeCuotasMax ? (
              <div className="mt-1.5 flex items-center gap-1 text-xs text-rose-600">
                <AlertCircle className="h-3 w-3" />
                Máximo {comercio?.cuoMax}
              </div>
            ) : enCuotas && montoNum > 0 ? (
              <div className="mt-1.5 text-xs tabular-nums text-medical-700">
                {cuotas} × <Money amount={montoNum / cuotas} />
              </div>
            ) : null}
          </div>

          {/* Botón */}
          <div className="md:col-span-2 flex items-end">
            <Button
              type="submit"
              size="lg"
              className="h-10 w-full rounded-xl font-semibold"
              disabled={!canSubmit || loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creando…
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Emitir
                </>
              )}
            </Button>
          </div>
        </form>

        {/* Padrón informativo (cuando no hay selección o no hay padrones) */}
        {!padronId && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <span>
              Seleccioná un padrón del afiliado para poder emitir la orden.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ============================================================
   Tabla últimas órdenes
   ============================================================ */
function TablaOrdenes({ rows }: { rows: OrdenCreditoLite[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        className="py-8"
        title="Sin órdenes registradas"
        description="Las órdenes emitidas para este afiliado aparecerán acá."
        icon={
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <FileText className="h-5 w-5" />
          </div>
        }
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border/60">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[160px]">Fecha</TableHead>
            <TableHead>Comercio</TableHead>
            <TableHead className="w-[140px] text-right">Monto</TableHead>
            <TableHead className="w-[90px] text-center">Cuotas</TableHead>
            <TableHead className="w-[140px]">Padrón</TableHead>
            <TableHead className="w-[110px]">Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="text-sm tabular-nums text-muted-foreground">
                {fmtFechaHora(r.fecha)}
              </TableCell>
              <TableCell className="max-w-[520px] truncate font-medium">{r.comercioRazon}</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                <Money amount={r.monto} />
              </TableCell>
              <TableCell className="text-center text-sm">{r.cuotas}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{r.padron}</TableCell>
              <TableCell>
                <EstadoBadge estado={r.estado} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
