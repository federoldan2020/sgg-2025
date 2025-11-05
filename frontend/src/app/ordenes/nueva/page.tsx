/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { api } from "@/servicios/api";
import React, { useEffect, useMemo, useRef, useState } from "react";

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

// Lo que renderiza la tabla
type OrdenCreditoLite = {
  id: string;
  fecha: string; // ISO
  comercioRazon: string;
  monto: number;
  cuotas: number;
  padron: string;
  estado: "OK" | "PEND" | "ANULADA" | string;
};

// Preview puede variar; lo mostramos “best-effort”
type PreviewOrden = Record<string, unknown>;

// ============================
// API util (ya existe en tu proyecto)
// ============================

// ---------- Fetchers ----------
const buscarAfiliados = async (q: string) =>
  api<AfiliadoSuggest[]>(`/afiliados/suggest?q=${encodeURIComponent(q)}`, { method: "GET" });

const padronesActivos = async (afiliadoId: string) =>
  api<PadronLite[]>(`/padrones?afiliadoId=${encodeURIComponent(afiliadoId)}`, { method: "GET" });

const buscarComercios = async (q: string) =>
  api<Comercio[]>(`/comercios?q=${encodeURIComponent(q)}`, { method: "GET" });

const previewOrden = async (payload: {
  afiliadoId: string;
  padronId: string;
  comercioId: string;
  monto: number;
  cuotas: number;
}) => api<PreviewOrden>(`/ordenes/preview`, { method: "POST", body: JSON.stringify(payload) });

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
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 }).format(
    typeof n === "string" ? Number(n || 0) : n || 0
  );

const cx = (...cls: Array<string | false | null | undefined>) => cls.filter(Boolean).join(" ");

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
    return new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(d);
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

  const padronStr =
    o.padron?.padron ??
    o.padronLabel ??
    o.padron ??
    o.padronId ??
    "—";

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

// ============================
// Page principal: Gestión de Órdenes de Crédito
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
      setPadronId(ps[0]?.id ?? "");
      const mapped = Array.isArray(ordsRaw) ? ordsRaw.map(normalizeOrdenBackend) : [];
      setUltimas(mapped);
    })();
  }, [afiliado?.id]);

  const padronSel = useMemo(() => padrones.find((p) => p.id === padronId), [padrones, padronId]);

  return (
    <div className="min-h-dvh bg-neutral-50">
      <Header onSelectAfiliado={setAfiliado} afiliado={afiliado} />

      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        {/* Afiliado + Padrones */}
        <section className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-neutral-900">
                {afiliado ? afiliado.display : "Sin afiliado seleccionado"}
              </div>
              {afiliado && <div className="mt-0.5 text-xs text-neutral-500">DNI {afiliado.dni || "—"}</div>}
            </div>

            <div className="md:ml-auto flex items-center gap-2">
              <label className="text-xs text-neutral-600">Padrón</label>
              <select
                className="min-w-[200px] rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm disabled:opacity-50"
                value={padronId}
                onChange={(e) => setPadronId(e.target.value)}
                disabled={!afiliado || padrones.length === 0}
              >
                {padrones.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.padron}
                    {!p.activo ? " (inactivo)" : ""}
                  </option>
                ))}
              </select>

              {padronSel && (
                <div className="ml-2 hidden items-center gap-2 text-xs sm:flex">
                  <span
                    className={cx(
                      "rounded-full px-2 py-0.5",
                      padronSel.activo ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-600"
                    )}
                    title={padronSel.activo ? "Activo" : "Inactivo"}
                  >
                    {padronSel.activo ? "Activo" : "Inactivo"}
                  </span>
                  <span className="text-neutral-600">Saldo: {money(padronSel.saldo)}</span>
                  <span className="text-neutral-600">Cupo: {money(padronSel.cupo)}</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Form de Orden de Crédito */}
        <OrdenForm
          afiliado={afiliado}
          padronId={padronId}
          padronLabel={padronSel?.padron ?? ""}
          onCreada={(nueva) => setUltimas((prev) => [nueva, ...prev].slice(0, 50))}
        />

        {/* Últimas órdenes */}
        <section className="mt-6 rounded-xl border border-neutral-200 bg-white">
          <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
            <h3 className="text-sm font-medium text-neutral-800">Últimas órdenes del afiliado</h3>
            <div className="text-xs text-neutral-500">Doble click para ver detalle</div>
          </div>
          <TablaOrdenes rows={ultimas} />
        </section>
      </main>
    </div>
  );
}

// ============================
// Header con suggest de afiliados
// ============================
function Header({
  onSelectAfiliado,
  afiliado,
}: {
  onSelectAfiliado: (a: AfiliadoSuggest | null) => void;
  afiliado: AfiliadoSuggest | null;
}) {
  const [q, setQ] = useState("");
  const debounced = useDebounced(q, 250);
  const [results, setResults] = useState<AfiliadoSuggest[]>([]);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  useEffect(() => {
    (async () => {
      if (!debounced.trim()) {
        setResults([]);
        return;
      }
      const r = await buscarAfiliados(debounced.trim());
      setResults(r);
      setOpen(true);
    })();
  }, [debounced]);

  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3">
        <div className="text-base font-semibold tracking-tight">Órdenes de Crédito</div>

        <div className="relative ml-auto w-full max-w-xl">
          <input
            ref={inputRef}
            type="search"
            placeholder="Buscar afiliado por DNI o nombre… (Ctrl+K)"
            className="h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none ring-0 placeholder:text-neutral-400 focus:border-neutral-800"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => q && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
          />
          {open && results.length > 0 && (
            <div className="absolute z-40 mt-1 w-full overflow-hidden rounded-md border border-neutral-200 bg-white shadow-lg">
              <ul className="max-h-72 overflow-auto py-1 text-sm">
                {results.map((a) => (
                  <li
                    key={a.id}
                    className="cursor-pointer px-3 py-2 hover:bg-neutral-50"
                    onMouseDown={() => {
                      onSelectAfiliado(a);
                      setQ(`${a.display} (${a.dni || "s/d"})`);
                      setOpen(false);
                    }}
                  >
                    <div className="font-medium text-neutral-800">{a.display}</div>
                    <div className="text-xs text-neutral-500">DNI {a.dni || "—"}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <button
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50"
          onClick={() => {
            onSelectAfiliado(null);
            setQ("");
            setResults([]);
          }}
          disabled={!afiliado}
        >
          Limpiar
        </button>
      </div>
    </header>
  );
}

// ============================
// Picker de comercio (obligatorio) usando razonSocial
// ============================
function ComercioPicker({
  value,
  onChange,
}: {
  value?: Comercio | null;
  onChange: (c: Comercio | null) => void;
}) {
  const [q, setQ] = useState("");
  const debounced = useDebounced(q, 250);
  const [results, setResults] = useState<Comercio[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    (async () => {
      if (!debounced.trim()) {
        setResults([]);
        return;
      }
      const r = await buscarComercios(debounced.trim());
      setResults(r);
      setOpen(true);
    })();
  }, [debounced]);

  return (
    <div className="relative">
      <input
        type="search"
        placeholder="Buscar comercio…"
        className="w-full rounded-md border border-neutral-300 px-2 py-2 text-sm"
        value={value ? value.razonSocial : q}
        onChange={(e) => {
          onChange(null);
          setQ(e.target.value);
        }}
        onFocus={() => q && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
      />
      {open && results.length > 0 && (
        <div className="absolute z-40 mt-1 w-full overflow-hidden rounded-md border border-neutral-200 bg-white shadow-lg">
          <ul className="max-h-72 overflow-auto py-1 text-sm">
            {results.map((c) => (
              <li
                key={c.id}
                className="cursor-pointer px-3 py-2 hover:bg-neutral-50"
                onMouseDown={() => {
                  onChange(c);
                  setQ("");
                  setOpen(false);
                }}
              >
                <div className="font-medium text-neutral-800">{c.razonSocial}</div>
                <div className="text-xs text-neutral-500">
                  Código {c.codigo} {c.cuit ? `· CUIT ${c.cuit}` : ""}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ============================
// Form de Orden (preview en vivo + crear)
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

  // Preview
  const [prev, setPrev] = useState<PreviewOrden | null>(null);
  const [prevLoading, setPrevLoading] = useState(false);
  const dMonto = useDebounced(monto, 250);
  const dCuotas = useDebounced(cuotas, 250);
  const canPreview =
    Boolean(afiliado?.id && padronId && comercio?.id) && Number(dMonto) > 0 && Number.isFinite(Number(dCuotas));

  useEffect(() => {
    (async () => {
      if (!canPreview) {
        setPrev(null);
        return;
      }
      setPrevLoading(true);
      try {
        const p = await previewOrden({
          afiliadoId: afiliado!.id,
          padronId,
          comercioId: comercio!.id,
          monto: Number(dMonto),
          cuotas: Number(dCuotas),
        });
        setPrev(p || null);
      } finally {
        setPrevLoading(false);
      }
    })();
  }, [canPreview, afiliado?.id, padronId, comercio?.id, dMonto, dCuotas]);

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
        comercioId: comercio.id, // OBLIGATORIO
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
      setPrev(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mt-4 rounded-xl border border-neutral-200 bg-white p-4">
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-12">
        <div className="md:col-span-3">
          <label className="mb-1 block text-xs text-neutral-600">Padrón</label>
          <input
            readOnly
            className="w-full cursor-not-allowed rounded-md border border-neutral-200 bg-neutral-50 px-2 py-2 text-sm"
            value={padronId ? padronLabel || "—" : "—"}
          />
        </div>

        <div className="md:col-span-3">
          <label className="mb-1 block text-xs text-neutral-600">Monto</label>
          <input
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            placeholder="0,00"
            className="w-full rounded-md border border-neutral-300 px-2 py-2 text-sm"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
          />
        </div>

        <div className="md:col-span-2">
          <label className="mb-1 block text-xs text-neutral-600">Cuotas</label>
          <input
            type="number"
            min={1}
            step={1}
            className="w-full rounded-md border border-neutral-300 px-2 py-2 text-sm"
            value={cuotas}
            onChange={(e) => setCuotas(Math.max(1, Number(e.target.value) || 1))}
          />
          <div className="mt-1 text-xs text-neutral-500">
            Modo: <span className="font-medium text-neutral-700">{enCuotas ? "En cuotas" : "Un pago"}</span>
          </div>
        </div>

        <div className="md:col-span-3">
          <label className="mb-1 block text-xs text-neutral-600">Comercio (obligatorio)</label>
          <ComercioPicker value={comercio} onChange={setComercio} />
          {comercio?.cuoMax && (
            <div className="mt-1 text-xs text-neutral-500">Hasta {comercio.cuoMax} cuotas</div>
          )}
        </div>

        <div className="md:col-span-1 flex items-end">
          <button
            type="submit"
            disabled={!canSubmit || loading}
            className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-40"
            title={enCuotas ? "Generar en cuotas" : "Generar en un pago"}
          >
            {loading ? "Creando…" : enCuotas ? `Crear (${cuotas})` : `Crear (1)`}
          </button>
        </div>
      </form>

      {/* Preview compacto */}
      <div className="mt-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
        <div className="flex items-center gap-2 text-xs text-neutral-600">
          <span className="font-medium">Preview</span>
          {prevLoading && <span className="animate-pulse">calculando…</span>}
          {!prevLoading && !prev && <span>completa los datos para ver el cálculo</span>}
        </div>
        {!!prev && (
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {"cuota" in prev || "importeCuota" in prev ? (
              <>
                <KV label="Cuota estimada" value={money((prev as any).cuota ?? (prev as any).importeCuota)} />
                {"total" in prev || "importeTotal" in prev ? (
                  <KV label="Total" value={money((prev as any).total ?? (prev as any).importeTotal)} />
                ) : null}
                {"recargo" in prev ? <KV label="Recargo" value={money((prev as any).recargo)} /> : null}
              </>
            ) : (
              <pre className="col-span-full overflow-auto rounded bg-white p-2 text-xs text-neutral-700">
                {JSON.stringify(prev, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-2">
      <div className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="text-sm font-medium text-neutral-900">{value}</div>
    </div>
  );
}

// ============================
// Tabla densa de órdenes
// ============================
function TablaOrdenes({ rows }: { rows: OrdenCreditoLite[] }) {
  return (
    <div className="overflow-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-neutral-50 text-left text-xs text-neutral-600">
          <tr className="[&>th]:px-3 [&>th]:py-2">
            <th className="w-40">Fecha</th>
            <th className="min-w-[220px]">Comercio</th>
            <th className="w-28 text-right">Monto</th>
            <th className="w-20 text-center">Cuotas</th>
            <th className="w-32">Padrón</th>
            <th className="w-28">Estado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200">
          {rows.map((r) => (
            <tr key={r.id} className="cursor-default select-none hover:bg-neutral-50 [&>td]:px-3 [&>td]:py-2">
              <td className="text-neutral-700">{fmtFechaHora(r.fecha)}</td>
              <td className="truncate">{r.comercioRazon}</td>
              <td className="text-right tabular-nums">{money(r.monto)}</td>
              <td className="text-center">{r.cuotas}</td>
              <td>{r.padron}</td>
              <td>
                <span
                  className={cx(
                    "rounded-full px-2 py-0.5 text-xs",
                    r.estado === "OK" && "bg-emerald-100 text-emerald-700",
                    r.estado === "PEND" && "bg-amber-100 text-amber-700",
                    r.estado === "ANULADA" && "bg-rose-100 text-rose-700"
                  )}
                >
                  {r.estado}
                </span>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="px-3 py-6 text-center text-sm text-neutral-500">
                Sin órdenes
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
