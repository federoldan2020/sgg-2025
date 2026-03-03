/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/servicios/api";

// shadcn
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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

// icons
import {
  Search,
  X,
  User,
  CreditCard,
  Wallet,
  TrendingUp,
  DollarSign,
  Hash,
  Store,
  CheckCircle,
  FileText,
  AlertCircle,
} from "lucide-react";

// ============================
// Tipos según TUS endpoints
// ============================
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
  fecha: string; // ISO
  comercioRazon: string;
  monto: number;
  cuotas: number;
  padron: string;
  estado: "OK" | "PEND" | "ANULADA" | string;
};

// ---------- Fetchers ----------
const buscarAfiliados = async (q: string) =>
  api<AfiliadoSuggest[]>(`/afiliados/suggest?q=${encodeURIComponent(q)}`, {
    method: "GET",
  });

const padronesActivos = async (afiliadoId: string) =>
  api<PadronLite[]>(`/padrones?afiliadoId=${encodeURIComponent(afiliadoId)}`, {
    method: "GET",
  });

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

// ============================
// Helpers
// ============================
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

// Normaliza una orden del backend a OrdenCreditoLite para la grilla
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

const EstadoBadge = ({ estado }: { estado: string }) => {
  const config = {
    OK: {
      bg: "bg-emerald-100",
      border: "border-emerald-300",
      text: "text-emerald-700",
      dot: "bg-emerald-500",
    },
    PEND: {
      bg: "bg-amber-100",
      border: "border-amber-300",
      text: "text-amber-700",
      dot: "bg-amber-500",
    },
    ANULADA: {
      bg: "bg-rose-100",
      border: "border-rose-300",
      text: "text-rose-700",
      dot: "bg-rose-500",
    },
  };

  const style = config[estado as keyof typeof config] || {
    bg: "bg-gray-100",
    border: "border-gray-300",
    text: "text-gray-700",
    dot: "bg-gray-500",
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-full px-3 py-1 font-medium",
        style.bg,
        style.border,
        style.text
      )}
    >
      <div className="flex items-center gap-1.5">
        <div className={cn("w-1.5 h-1.5 rounded-full", style.dot)} />
        {estado}
      </div>
    </Badge>
  );
};

// ============================
// Page principal
// ============================
export default function OrdenesCreditoPage() {
  const [afiliado, setAfiliado] = useState<AfiliadoSuggest | null>(null);
  const [padrones, setPadrones] = useState<PadronLite[]>([]);
  const [padronId, setPadronId] = useState<string>("");
  const [ultimas, setUltimas] = useState<OrdenCreditoLite[]>([]);

  // cargar padrones y últimas cuando cambia afiliado
  useEffect(() => {
    (async () => {
      if (!afiliado?.id) {
        setPadrones([]);
        setPadronId("");
        setUltimas([]);
        return;
      }
      const [ps, ordsRaw] = await Promise.all([
        padronesActivos(afiliado.id),
        listarOrdenesAfiliado(afiliado.id),
      ]);

      setPadrones(ps);
      setPadronId((prev) => prev || ps[0]?.id || "");

      const mapped = Array.isArray(ordsRaw) ? ordsRaw.map(normalizeOrdenBackend) : [];
      setUltimas(mapped);
    })();
  }, [afiliado?.id]);

  const padronSel = useMemo(
    () => padrones.find((p) => p.id === padronId),
    [padrones, padronId]
  );

  return (
    <div className="min-h-dvh bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/20">
      <Header afiliado={afiliado} onSelectAfiliado={setAfiliado} />

      <main className="mx-auto w-full max-w-6xl px-4 py-6 space-y-6">
        {/* Estado vacío cuando no hay afiliado */}
        {!afiliado ? (
          <Card className="p-12 text-center border-2 border-dashed border-blue-200 bg-white/50 backdrop-blur-sm">
            <div className="w-16 h-16 mx-auto bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl flex items-center justify-center">
              <User className="h-8 w-8 text-blue-600" />
            </div>
            <h3 className="mt-4 text-lg font-bold text-gray-900">Seleccioná un afiliado</h3>
            <p className="text-sm text-gray-600 mt-2 max-w-md mx-auto">
              Usá el buscador en el encabezado o presioná{" "}
              <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs font-mono">
                Ctrl+K
              </kbd>{" "}
              para comenzar
            </p>
          </Card>
        ) : (
          <>
            {/* Summary */}
            <Card className="p-5 border-l-4 border-l-blue-500 bg-gradient-to-br from-blue-50/50 to-white shadow-md">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm text-blue-600 font-semibold">
                    <User className="h-4 w-4" />
                    Afiliado Seleccionado
                  </div>
                  <div className="mt-2 text-lg font-bold text-gray-900 truncate">
                    {afiliado.display}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-gray-600">
                    <CreditCard className="h-3.5 w-3.5" />
                    DNI {afiliado.dni || "—"}
                  </div>

                  {padronSel && (
                    <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                      {/* Estado */}
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "w-2.5 h-2.5 rounded-full ring-2 ring-offset-2",
                            padronSel.activo
                              ? "bg-emerald-500 ring-emerald-200"
                              : "bg-gray-400 ring-gray-200"
                          )}
                        />
                        <span className="text-xs font-semibold text-gray-700">
                          {padronSel.activo ? "Activo" : "Inactivo"}
                        </span>
                      </div>

                      {/* Saldo */}
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-500 flex items-center gap-1 mb-0.5">
                          <Wallet className="h-3 w-3" />
                          Saldo
                        </span>
                        <span className="text-sm font-bold text-rose-600 tabular-nums">
                          {money(padronSel.saldo)}
                        </span>
                      </div>

                      {/* Cupo */}
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-500 flex items-center gap-1 mb-0.5">
                          <TrendingUp className="h-3 w-3" />
                          Cupo
                        </span>
                        <span className="text-sm font-bold text-emerald-600 tabular-nums">
                          {money(padronSel.cupo)}
                        </span>
                      </div>

                      {/* Disponible */}
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-500 flex items-center gap-1 mb-0.5">
                          <DollarSign className="h-3 w-3" />
                          Disponible
                        </span>
                        <span className="text-sm font-bold text-blue-600 tabular-nums">
                          {money(Number(padronSel.cupo) - Number(padronSel.saldo))}
                        </span>
                      </div>

                      {/* Sistema */}
                      {padronSel.sistema && (
                        <div className="flex flex-col col-span-2 md:col-span-4">
                          <span className="text-xs text-gray-500 mb-0.5">Sistema</span>
                          <span className="text-sm font-semibold text-indigo-600">
                            {padronSel.sistema}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Selector de padrón con estilo */}
                <div className="flex items-center gap-3 md:pt-1 bg-white rounded-lg p-3 border-2 border-blue-100 shadow-sm">
                  <div className="text-xs font-semibold text-gray-700">Padrón</div>
                  <Select
                    value={padronId}
                    onValueChange={setPadronId}
                    disabled={!afiliado || padrones.length === 0}
                  >
                    <SelectTrigger className="h-10 w-[220px] border-blue-200 focus:border-blue-500 focus:ring-blue-500">
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {padrones.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          <div className="flex items-center gap-2">
                            <div
                              className={cn(
                                "w-2 h-2 rounded-full",
                                p.activo ? "bg-emerald-500" : "bg-gray-400"
                              )}
                            />
                            {p.padron}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>

            {/* Form */}
            <OrdenForm
              afiliado={afiliado}
              padronId={padronId}
              padronSel={padronSel}
              padronLabel={padronSel?.padron ?? ""}
              onCreada={(nueva) => setUltimas((prev) => [nueva, ...prev].slice(0, 50))}
            />

            {/* Últimas órdenes */}
            <Card className="overflow-hidden shadow-md border-t-4 border-t-indigo-500">
              <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-gray-50 to-white border-b">
                <div>
                  <div className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <FileText className="h-5 w-5 text-indigo-600" />
                    Últimas Órdenes
                  </div>
                  <div className="text-xs text-gray-600 mt-0.5">
                    {ultimas.length} orden{ultimas.length !== 1 ? "es" : ""} registrada
                    {ultimas.length !== 1 ? "s" : ""}
                  </div>
                </div>
              </div>
              <TablaOrdenes rows={ultimas} />
            </Card>
          </>
        )}
      </main>
    </div>
  );
}

// ============================
// Header premium (Combobox afiliado + limpiar)
// ============================
function Header({
  onSelectAfiliado,
  afiliado,
}: {
  onSelectAfiliado: (a: AfiliadoSuggest | null) => void;
  afiliado: AfiliadoSuggest | null;
}) {
  // Ctrl/Cmd + K
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const el = document.getElementById("afiliado-combobox-trigger");
        (el as HTMLButtonElement | null)?.click();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b bg-gradient-to-r from-blue-600 to-indigo-600 shadow-lg">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-4">
        <div className="min-w-0">
          <div className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
              <CreditCard className="h-5 w-5 text-white" />
            </div>
            Órdenes de Crédito
          </div>
          <div className="text-xs text-blue-100 ml-10">Gestión y emisión</div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <AfiliadoCombobox value={afiliado} onSelect={onSelectAfiliado} />
          <Button
            variant="secondary"
            size="sm"
            className="h-10 bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm"
            onClick={() => onSelectAfiliado(null)}
            disabled={!afiliado}
          >
            <X className="h-4 w-4 mr-2" />
            Limpiar
          </Button>
        </div>
      </div>
    </header>
  );
}

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
          id="afiliado-combobox-trigger"
          variant="outline"
          className="h-10 w-[420px] justify-start gap-2 bg-white/95 hover:bg-white border-white/50 backdrop-blur-sm"
        >
          <Search className="h-4 w-4 text-blue-600" />
          <span className={cn("truncate", value ? "text-gray-900 font-medium" : "text-gray-500")}>
            {value ? value.display : "Buscar afiliado… (Ctrl+K)"}
          </span>
        </Button>
      </PopoverTrigger>

      <PopoverContent className="p-0 w-[420px]" align="end">
        <Command>
          <CommandInput placeholder="DNI, nombre o padrón…" value={q} onValueChange={setQ} />
          <CommandList>
            {loading ? (
              <div className="p-3 text-sm text-muted-foreground">Buscando…</div>
            ) : (
              <CommandEmpty>Sin resultados.</CommandEmpty>
            )}
            <CommandGroup heading="Afiliados">
              {items.map((a) => (
                <CommandItem
                  key={a.id}
                  value={`${a.display} ${a.dni}`}
                  onSelect={() => {
                    onSelect(a);
                    setOpen(false);
                    setQ("");
                    setItems([]);
                  }}
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{a.display}</span>
                    <span className="text-xs text-muted-foreground">DNI {a.dni || "—"}</span>
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

// ============================
// Comercio picker premium (Popover + Command)
// ============================
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
            "h-11 w-full justify-start border-purple-200 focus:border-purple-500 bg-white",
            value ? "text-gray-900 font-medium" : "text-gray-500"
          )}
        >
          <Store className="h-4 w-4 mr-2 text-purple-600" />
          <span className="truncate">{value ? value.razonSocial : "Seleccionar comercio…"}</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent className="p-0 w-[520px]" align="start">
        <Command>
          <CommandInput
            placeholder="Buscar por razón social, código, CUIT…"
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

// ============================
// Form premium con validaciones visuales
// ============================
function OrdenForm({
  afiliado,
  padronId,
  padronSel,
  padronLabel,
  onCreada,
}: {
  afiliado: AfiliadoSuggest | null;
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
  const excedeCupo = montoNum > cupoDisponible && padronSel;
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
    if (!canSubmit || !afiliado || !comercio) return;

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
    <Card className="p-6 border-l-4 border-l-indigo-500 shadow-md bg-gradient-to-br from-indigo-50/30 to-white">
      <div className="mb-5">
        <div className="text-base font-bold text-gray-900 flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
            <CheckCircle className="h-5 w-5 text-indigo-600" />
          </div>
          Nueva Orden
        </div>
        <div className="text-sm text-gray-600 mt-1 ml-10">
          Completá los datos y confirmá para generar la orden
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-5 md:grid-cols-12">
        {/* Padrón (readonly) */}
        <div className="md:col-span-3">
          <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-gray-700">
            <CreditCard className="h-3.5 w-3.5 text-gray-600" />
            Padrón
          </label>
          <Input
            readOnly
            className="h-11 bg-gray-100 border-gray-200 text-gray-700 font-medium"
            value={padronId ? padronLabel || "—" : "—"}
          />
        </div>

        {/* Monto */}
        <div className="md:col-span-3">
          <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-gray-700">
            <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
            Monto
          </label>
          <Input
            className={cn(
              "h-11 bg-white font-semibold",
              excedeCupo
                ? "border-rose-300 focus:border-rose-500 focus:ring-rose-500"
                : "border-emerald-200 focus:border-emerald-500 focus:ring-emerald-500"
            )}
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            placeholder="0,00"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
          />
          {excedeCupo && (
            <div className="mt-1.5 text-xs text-rose-600 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Excede el cupo disponible ({money(cupoDisponible)})
            </div>
          )}
          {!excedeCupo && montoNum > 0 && padronSel && (
            <div className="mt-1.5 text-xs text-emerald-600 flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              Disponible: {money(cupoDisponible - montoNum)}
            </div>
          )}
        </div>

        {/* Cuotas */}
        <div className="md:col-span-2">
          <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-gray-700">
            <Hash className="h-3.5 w-3.5 text-blue-600" />
            Cuotas
          </label>
          <Input
            className={cn(
              "h-11 bg-white font-semibold",
              excedeCuotasMax
                ? "border-rose-300 focus:border-rose-500 focus:ring-rose-500"
                : "border-blue-200 focus:border-blue-500 focus:ring-blue-500"
            )}
            type="number"
            min={1}
            step={1}
            value={cuotas}
            onChange={(e) => setCuotas(Math.max(1, Number(e.target.value) || 1))}
          />
          {excedeCuotasMax && (
            <div className="mt-1.5 text-xs text-rose-600 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Máximo {comercio?.cuoMax} cuotas
            </div>
          )}
          {!excedeCuotasMax && montoNum > 0 && enCuotas && (
            <div className="mt-2 p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-xs text-blue-700 font-medium">
                {cuotas}x {money(montoNum / cuotas)}
              </div>
            </div>
          )}
        </div>

        {/* Comercio */}
        <div className="md:col-span-3">
          <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-gray-700">
            <Store className="h-3.5 w-3.5 text-purple-600" />
            Comercio <span className="text-rose-500">*</span>
          </label>
          <ComercioCombobox value={comercio} onChange={setComercio} />
          {comercio?.cuoMax && (
            <div className="mt-1.5 text-xs text-purple-600">
              Máx. {comercio.cuoMax} cuota{comercio.cuoMax !== 1 ? "s" : ""}
            </div>
          )}
        </div>

        {/* Botón */}
        <div className="md:col-span-1 flex items-end">
          <Button
            type="submit"
            className="h-11 w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all"
            disabled={!canSubmit || loading}
          >
            {loading ? (
              <>
                <div className="h-4 w-4 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creando…
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Crear
              </>
            )}
          </Button>
        </div>
      </form>
    </Card>
  );
}

// ============================
// Tabla premium
// ============================
function TablaOrdenes({ rows }: { rows: OrdenCreditoLite[] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50/50">
            <TableHead className="w-[160px] font-semibold text-gray-700">Fecha</TableHead>
            <TableHead className="font-semibold text-gray-700">Comercio</TableHead>
            <TableHead className="w-[140px] text-right font-semibold text-gray-700">
              Monto
            </TableHead>
            <TableHead className="w-[110px] text-center font-semibold text-gray-700">
              Cuotas
            </TableHead>
            <TableHead className="w-[140px] font-semibold text-gray-700">Padrón</TableHead>
            <TableHead className="w-[140px] font-semibold text-gray-700">Estado</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {rows.map((r, idx) => (
            <TableRow
              key={r.id}
              className={cn(
                "hover:bg-blue-50/50 transition-colors",
                idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"
              )}
            >
              <TableCell className="font-medium text-gray-700">
                {fmtFechaHora(r.fecha)}
              </TableCell>
              <TableCell className="max-w-[520px] truncate text-gray-900">
                {r.comercioRazon}
              </TableCell>
              <TableCell className="text-right font-bold tabular-nums text-gray-900">
                {money(r.monto)}
              </TableCell>
              <TableCell className="text-center font-semibold text-gray-700">
                {r.cuotas}
              </TableCell>
              <TableCell className="text-gray-700">{r.padron}</TableCell>
              <TableCell>
                <EstadoBadge estado={r.estado} />
              </TableCell>
            </TableRow>
          ))}

          {rows.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={6}
                className="py-16 text-center text-sm text-gray-500"
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                    <FileText className="h-6 w-6 text-gray-400" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-700">Sin órdenes registradas</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Las órdenes creadas aparecerán aquí
                    </div>
                  </div>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}