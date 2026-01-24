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
import { Search, X } from "lucide-react";

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
  const cls =
    estado === "OK"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : estado === "PEND"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : estado === "ANULADA"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : "border-border bg-muted text-muted-foreground";

  return (
    <Badge variant="outline" className={cn("rounded-full", cls)}>
      {estado}
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
    <div className="min-h-dvh bg-muted/40">
      <Header afiliado={afiliado} onSelectAfiliado={setAfiliado} />

      <main className="mx-auto w-full max-w-6xl px-4 py-6 space-y-6">
        {/* Summary */}
        <Card className="p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="text-sm text-muted-foreground">Afiliado</div>
              <div className="mt-1 text-base font-semibold truncate">
                {afiliado ? afiliado.display : "Sin afiliado seleccionado"}
              </div>
              {afiliado && (
                <div className="mt-1 text-xs text-muted-foreground">
                  DNI {afiliado.dni || "—"}
                </div>
              )}

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
                      <span className="font-semibold text-foreground">{padronSel.sistema}</span>
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 md:pt-1">
              <div className="text-xs font-medium text-muted-foreground">Padrón</div>
              <Select
                value={padronId}
                onValueChange={setPadronId}
                disabled={!afiliado || padrones.length === 0}
              >
                <SelectTrigger className="h-10 w-[220px]">
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
        </Card>

        {/* Form */}
        <OrdenForm
          afiliado={afiliado}
          padronId={padronId}
          padronLabel={padronSel?.padron ?? ""}
          onCreada={(nueva) => setUltimas((prev) => [nueva, ...prev].slice(0, 50))}
        />

        {/* Últimas órdenes */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <div className="text-sm font-semibold">Últimas órdenes</div>
              <div className="text-xs text-muted-foreground">
                Listado de órdenes del afiliado seleccionado
              </div>
            </div>
          </div>
          <Separator />
          <TablaOrdenes rows={ultimas} />
        </Card>
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
        // Abrimos popover desde botón (UX simple)
        const el = document.getElementById("afiliado-combobox-trigger");
        (el as HTMLButtonElement | null)?.click();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3">
        <div className="min-w-0">
          <div className="text-base font-semibold tracking-tight">Órdenes de Crédito</div>
          <div className="text-xs text-muted-foreground">Gestión y emisión</div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <AfiliadoCombobox value={afiliado} onSelect={onSelectAfiliado} />
          <Button
            variant="outline"
            size="sm"
            className="h-10"
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
          className="h-10 w-[420px] justify-start gap-2"
        >
          <Search className="h-4 w-4 text-muted-foreground" />
          <span className={cn("truncate", value ? "text-foreground" : "text-muted-foreground")}>
            {value ? value.display : "Buscar afiliado… (Ctrl+K)"}
          </span>
        </Button>
      </PopoverTrigger>

      <PopoverContent className="p-0 w-[420px]" align="end">
        <Command>
          <CommandInput
            placeholder="DNI, nombre o padrón…"
            value={q}
            onValueChange={setQ}
          />
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
            "h-10 w-full justify-start",
            value ? "text-foreground" : "text-muted-foreground"
          )}
        >
          <span className="truncate">
            {value ? value.razonSocial : "Seleccionar comercio…"}
          </span>
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
// Form premium (SIN preview)
// ============================
function OrdenForm({
  afiliado,
  padronId,
  padronLabel,
  onCreada,
}: {
  afiliado: AfiliadoSuggest | null;
  padronId: string;
  padronLabel: string;
  onCreada: (op: OrdenCreditoLite) => void;
}) {
  const [monto, setMonto] = useState<string>("");
  const [cuotas, setCuotas] = useState<number>(1);
  const [comercio, setComercio] = useState<Comercio | null>(null);
  const [loading, setLoading] = useState(false);

  const enCuotas = Number(cuotas) > 1;
  const canSubmit = Boolean(afiliado?.id && padronId && comercio?.id && Number(monto) > 0 && cuotas >= 1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !afiliado || !comercio) return;

    setLoading(true);
    try {
      await crearOrden({
        afiliadoId: afiliado.id,
        padronId,
        comercioId: comercio.id,
        monto: Number(monto),
        cuotas: Number(cuotas),
      });

      onCreada({
        id: crypto.randomUUID(),
        fecha: new Date().toISOString(),
        comercioRazon: comercio.razonSocial,
        monto: Number(monto),
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
    <Card className="p-5">
      <div className="mb-4">
        <div className="text-sm font-semibold">Nueva orden</div>
        <div className="text-xs text-muted-foreground">
          Completá los datos y confirmá para generar la orden
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-12">
        <div className="md:col-span-3">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Padrón</label>
          <Input readOnly className="h-10 bg-muted/40" value={padronId ? padronLabel || "—" : "—"} />
        </div>

        <div className="md:col-span-3">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Monto</label>
          <Input
            className="h-10"
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            placeholder="0,00"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
          />
        </div>

        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Cuotas</label>
          <Input
            className="h-10"
            type="number"
            min={1}
            step={1}
            value={cuotas}
            onChange={(e) => setCuotas(Math.max(1, Number(e.target.value) || 1))}
          />
          <div className="mt-1 text-xs text-muted-foreground">
            Modo:{" "}
            <span className="font-medium text-foreground">
              {enCuotas ? `En cuotas (${cuotas})` : "Un pago"}
            </span>
            {comercio?.cuoMax ? (
              <span className="text-muted-foreground"> · Máx {comercio.cuoMax}</span>
            ) : null}
          </div>
        </div>

        <div className="md:col-span-3">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Comercio <span className="text-destructive">*</span>
          </label>
          <ComercioCombobox value={comercio} onChange={setComercio} />
        </div>

        <div className="md:col-span-1 flex items-end">
          <Button type="submit" className="h-10 w-full" disabled={!canSubmit || loading}>
            {loading ? "Creando…" : "Crear"}
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
          <TableRow>
            <TableHead className="w-[160px]">Fecha</TableHead>
            <TableHead>Comercio</TableHead>
            <TableHead className="w-[140px] text-right">Monto</TableHead>
            <TableHead className="w-[110px] text-center">Cuotas</TableHead>
            <TableHead className="w-[140px]">Padrón</TableHead>
            <TableHead className="w-[140px]">Estado</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id} className="hover:bg-muted/40">
              <TableCell className="font-medium">{fmtFechaHora(r.fecha)}</TableCell>
              <TableCell className="max-w-[520px] truncate">{r.comercioRazon}</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {money(r.monto)}
              </TableCell>
              <TableCell className="text-center">{r.cuotas}</TableCell>
              <TableCell>{r.padron}</TableCell>
              <TableCell>
                <EstadoBadge estado={r.estado} />
              </TableCell>
            </TableRow>
          ))}

          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                Sin órdenes
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
