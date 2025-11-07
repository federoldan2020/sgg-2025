/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/servicios/api";
import {
  Search,
  Calendar,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";

/* ============================
 * Tipos (sin cambios)
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
  fecha: string; // ISO
  naturaleza: "debito" | "credito";
  origen: string; // 'orden_credito' | 'cuota' | 'pago_caja' | 'nomina' | 'ajuste' | 'anulacion'...
  concepto: string;
  importe: string | number; // siempre > 0
  padronId?: string | null;
  obligacionId?: string | null;
  ordenId?: string | null;
  cuotaId?: string | null;
  pagoId?: string | null;
  saldoPosterior?: string | number | null;
  asientoId?: string | null;
  moneda?: string | null; // por si lo activás más adelante
};

type CtaCteResp = {
  movimientos: Movimiento[];
  saldoFinal: number;
};

/* ============================
 * Fetchers (sin cambios)
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
  desde?: string;
  hasta?: string;
  take?: number;
}): Promise<CtaCteResp> => {
  const qs = new URLSearchParams();
  qs.set("afiliadoId", params.afiliadoId);
  if (params.padronId) qs.set("padronId", params.padronId);
  if (params.desde) qs.set("desde", params.desde);
  if (params.hasta) qs.set("hasta", params.hasta);
  if (params.take) qs.set("take", String(params.take));
  return api<CtaCteResp>(`/movimientos?${qs.toString()}`, { method: "GET" });
};

/* ============================
 * Helpers UI (sin cambios de lógica)
 * ============================ */
const money = (n: number | string) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(typeof n === "string" ? Number(n || 0) : n || 0);

const cx = (...cls: Array<string | false | null | undefined>) =>
  cls.filter(Boolean).join(" ");

function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const h = setTimeout(() => setV(value), ms);
    return () => clearTimeout(h);
  }, [value, ms]);
  return v;
}

function fmtFecha(iso: string) {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("es-AR", {
      dateStyle: "short",
    }).format(d);
  } catch {
    return iso;
  }
}

/* ============================
 * Página Movimientos (Cuenta Corriente)
 * ============================ */
export default function MovimientosPage() {
  const [afiliado, setAfiliado] = useState<AfiliadoSuggest | null>(null);
  const [padrones, setPadrones] = useState<PadronLite[]>([]);
  const [padronId, setPadronId] = useState<string>("");

  // filtro de mes/año
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const dSelectedDate = useDebounced(selectedDate, 300);

  const [data, setData] = useState<CtaCteResp | null>(null);
  const [loading, setLoading] = useState(false);

  // Cargar padrones al seleccionar afiliado
  useEffect(() => {
    (async () => {
      if (!afiliado?.id) {
        setPadrones([]);
        setPadronId("");
        setData(null);
        return;
      }
      const ps = await padronesActivos(afiliado.id);
      setPadrones(ps);
      setPadronId(ps[0]?.id ?? "");
    })();
  }, [afiliado?.id]);

  // Cargar movimientos cuando cambie afiliado/padrón/fecha
  useEffect(() => {
    (async () => {
      if (!afiliado?.id) {
        setData(null);
        return;
      }
      setLoading(true);
      try {
        // Calcular primer y último día del mes seleccionado
        const year = dSelectedDate.getFullYear();
        const month = dSelectedDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        const resp = await listarMovimientos({
          afiliadoId: afiliado.id,
          padronId: padronId || undefined,
          desde: firstDay.toISOString().split("T")[0],
          hasta: lastDay.toISOString().split("T")[0],
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

  const totalDeb =
    data?.movimientos
      .filter((m) => m.naturaleza === "debito")
      .reduce((a, b) => a + Number(b.importe || 0), 0) ?? 0;

  const totalCre =
    data?.movimientos
      .filter((m) => m.naturaleza === "credito")
      .reduce((a, b) => a + Number(b.importe || 0), 0) ?? 0;

  return (
    <div className="min-h-dvh bg-gradient-to-b from-slate-50 via-slate-50 to-white">
      <Header afiliado={afiliado} onSelectAfiliado={setAfiliado} />

      <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        {!afiliado ? (
          <EmptyState />
        ) : (
          <>
            {/* Tarjeta Afiliado + Filtros */}
            <section className="mb-8">
              {/* Banner de padrón inactivo */}
              {padronSel && !padronSel.activo && (
                <div
                  role="status"
                  aria-live="polite"
                  className="mb-5 overflow-hidden rounded-2xl border border-orange-200/50 bg-gradient-to-r from-orange-50 via-orange-50/80 to-amber-50/50 shadow-lg shadow-orange-100/20"
                >
                  <div className="flex items-start gap-4 p-5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-400 to-amber-500 shadow-lg shadow-orange-300/30">
                      <svg
                        className="h-5 w-5 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2.5}
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                        />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-base font-bold text-orange-900">
                        Padrón inactivo
                      </h4>
                      <p className="mt-1.5 text-sm leading-relaxed text-orange-800/90">
                        El padrón{" "}
                        <span className="rounded-md bg-orange-200/50 px-1.5 py-0.5 font-semibold text-orange-900">
                          {padronSel.padron}
                        </span>{" "}
                        está dado de baja. Los movimientos mostrados son
                        históricos.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="overflow-hidden rounded-3xl bg-white shadow-xl shadow-slate-200/50 ring-1 ring-slate-100">
                {/* Header del afiliado */}
                <div className="bg-gradient-to-r from-slate-50 to-blue-50/30 px-6 py-6 sm:px-8">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <h2 className="line-clamp-1 text-2xl font-bold tracking-tight text-slate-900">
                        {afiliado.display}
                      </h2>
                      <p className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                        <span className="inline-flex items-center rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                          DNI {afiliado.dni || "—"}
                        </span>
                      </p>
                    </div>

                    {/* Selector de padrón */}
                    <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
                      <label
                        htmlFor="padronSelect"
                        className="shrink-0 text-sm font-semibold text-slate-600"
                      >
                        Padrón
                      </label>
                      <div className="flex items-center gap-2">
                        <select
                          id="padronSelect"
                          className="min-w-[220px] rounded-xl border-2 border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition-all hover:border-slate-300 hover:shadow-md focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/20 disabled:opacity-50"
                          value={padronId}
                          onChange={(e) => setPadronId(e.target.value)}
                          disabled={!afiliado || padrones.length === 0}
                          aria-label="Seleccionar padrón"
                        >
                          {padrones.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.padron} {!p.activo ? "(inactivo)" : ""}
                            </option>
                          ))}
                        </select>

                        {/* Chips de acceso rápido (solo UI) */}
                        <div className="hidden items-center gap-2 lg:flex">
                          {padrones.slice(0, 3).map((p) => (
                            <button
                              key={`chip-${p.id}`}
                              type="button"
                              onClick={() => setPadronId(p.id)}
                              className={cx(
                                "rounded-full px-3 py-1.5 text-xs font-bold ring-1 transition-all",
                                padronId === p.id
                                  ? "bg-blue-600 text-white ring-blue-600"
                                  : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
                              )}
                              title={`Ver padrón ${p.padron}`}
                            >
                              {p.padron}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Info del padrón */}
                  {padronSel && (
                    <div className="mt-5 flex flex-wrap items-center gap-3">
                      <span
                        className={cx(
                          "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-bold shadow-sm ring-1",
                          padronSel.activo
                            ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white ring-emerald-600"
                            : "bg-gradient-to-r from-slate-400 to-slate-500 text-white ring-slate-500"
                        )}
                      >
                        <span
                          className={cx(
                            "h-2 w-2 rounded-full",
                            padronSel.activo ? "bg-white animate-pulse" : "bg-slate-300"
                          )}
                        />
                        {padronSel.activo ? "Activo" : "Inactivo"}
                      </span>
                      <div className="h-5 w-px bg-slate-300" />
                      <div className="rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-2 ring-1 ring-blue-200/50">
                        <span className="text-sm font-medium text-slate-600">
                          Saldo:{" "}
                          <span className="text-base font-bold text-slate-900">
                            {money(padronSel.saldo)}
                          </span>
                        </span>
                      </div>
                      <div className="rounded-xl bg-gradient-to-r from-purple-50 to-pink-50 px-4 py-2 ring-1 ring-purple-200/50">
                        <span className="text-sm font-medium text-slate-600">
                          Cupo:{" "}
                          <span className="text-base font-bold text-slate-900">
                            {money(padronSel.cupo)}
                          </span>
                        </span>
                      </div>
                      {padronSel.sistema && (
                        <>
                          <div className="h-5 w-px bg-slate-300" />
                          <span className="rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-2 text-sm font-medium text-slate-600 ring-1 ring-amber-200/50">
                            Sistema:{" "}
                            <span className="font-bold text-slate-900">
                              {padronSel.sistema}
                            </span>
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Filtros de fecha */}
                <div className="border-t border-slate-100 bg-white px-6 py-5 sm:px-8">
                  <MonthYearSelector
                    selectedDate={selectedDate}
                    onDateChange={setSelectedDate}
                    disabled={!afiliado}
                  />
                </div>

                {/* Mini barra pegajosa con saldo (mejora de visibilidad) */}
                <div className="sticky bottom-0 z-10 hidden bg-gradient-to-r from-white via-white to-blue-50/30 px-6 py-3 ring-1 ring-inset ring-slate-100 backdrop-blur-sm sm:px-8 md:flex md:items-center md:justify-end">
                  <div className="inline-flex items-center gap-3 rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm">
                    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">
                      Saldo final
                    </span>
                    <span
                      className={cx(
                        "tabular-nums text-base font-black",
                        (saldoFinal ?? 0) >= 0
                          ? "text-emerald-700"
                          : "text-rose-700"
                      )}
                    >
                      {money(saldoFinal)}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* KPIs */}
            <section className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <KPI
                label="Saldo final"
                value={money(saldoFinal)}
                icon={saldoFinal >= 0 ? TrendingUp : TrendingDown}
                accent={saldoFinal >= 0 ? "emerald" : "rose"}
                primary
              />
              <KPI
                label="Total créditos"
                value={money(totalCre)}
                icon={TrendingUp}
                accent="emerald"
                subtitle={`${
                  data?.movimientos.filter((m) => m.naturaleza === "credito")
                    .length || 0
                } mov.`}
              />
              <KPI
                label="Total débitos"
                value={money(totalDeb)}
                icon={TrendingDown}
                accent="rose"
                subtitle={`${
                  data?.movimientos.filter((m) => m.naturaleza === "debito")
                    .length || 0
                } mov.`}
              />
              <KPI
                label="Movimientos totales"
                value={data?.movimientos?.length ?? 0}
                subtitle={padronSel?.padron}
              />
            </section>

            {/* Tabla / Lista responsive */}
            <section className="overflow-hidden rounded-3xl bg-white shadow-xl shadow-slate-200/50 ring-1 ring-slate-100">
              <div className="flex items-center justify-between bg-gradient-to-r from-slate-50 to-blue-50/30 px-6 py-5 sm:px-8">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Cuenta Corriente
                  </h3>
                  {padronSel && (
                    <p className="mt-1 text-sm font-medium text-slate-600">
                      Padrón {padronSel.padron}
                    </p>
                  )}
                </div>
                {loading && (
                  <span
                    role="status"
                    aria-live="polite"
                    className="flex items-center gap-2.5 rounded-full bg-blue-100 px-4 py-2 text-sm font-medium text-blue-700"
                  >
                    <span className="h-2 w-2 animate-pulse rounded-full bg-blue-600" />
                    Cargando
                  </span>
                )}
              </div>

              <TablaMovimientos rows={data?.movimientos ?? []} loading={loading} />
            </section>
          </>
        )}
      </main>
    </div>
  );
}

/* ============================
 * Header con suggest de afiliados
 * ============================ */
function Header({
  afiliado,
  onSelectAfiliado,
}: {
  afiliado: AfiliadoSuggest | null;
  onSelectAfiliado: (a: AfiliadoSuggest | null) => void;
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
    <header className="sticky top-0 z-30 border-b border-slate-200/50 bg-white/80 backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25">
              <svg
                className="h-5 w-5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-slate-900">
                Movimientos
              </h1>
              {afiliado && (
                <span className="text-xs font-medium text-slate-500">
                  {afiliado.display}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex-1 sm:w-96">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                ref={inputRef}
                type="search"
                placeholder="Buscar afiliado (Ctrl+K)"
                className="h-12 w-full rounded-2xl border-2 border-slate-200 bg-white pl-11 pr-5 text-sm font-medium shadow-sm transition-all placeholder:text-slate-400 hover:border-slate-300 hover:shadow-md focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/20"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onFocus={() => q && setOpen(true)}
                onBlur={() => setTimeout(() => setOpen(false), 120)}
                aria-label="Buscar afiliado"
                role="combobox"
                aria-expanded={open}
                aria-controls="afiliado-suggest"
              />
              {open && results.length > 0 && (
                <div
                  id="afiliado-suggest"
                  className="absolute z-40 mt-3 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-300/30"
                >
                  <ul className="max-h-80 overflow-auto py-2">
                    {results.map((a) => (
                      <li
                        key={a.id}
                        className="cursor-pointer px-5 py-3.5 transition-colors hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50"
                        onMouseDown={() => {
                          onSelectAfiliado(a);
                          setQ(`${a.display} (${a.dni || "s/d"})`);
                          setOpen(false);
                        }}
                        title={`Seleccionar ${a.display}`}
                      >
                        <div className="font-semibold text-slate-900">
                          {a.display}
                        </div>
                        <div className="mt-0.5 text-xs font-medium text-slate-500">
                          DNI {a.dni || "—"}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {afiliado && (
              <button
                className="flex h-12 shrink-0 items-center gap-2.5 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-600 px-5 text-sm font-semibold text-white shadow-lg shadow-rose-500/25 transition-all hover:scale-105 hover:shadow-xl hover:shadow-rose-500/30"
                onClick={() => {
                  onSelectAfiliado(null);
                  setQ("");
                  setResults([]);
                }}
                aria-label="Limpiar afiliado seleccionado"
              >
                <X className="h-4 w-4" />
                <span className="hidden sm:inline">Limpiar</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

/* ============================
 * Selector de Mes/Año (con mejoras de a11y y pegajosidad)
 * ============================ */
function MonthYearSelector({
  selectedDate,
  onDateChange,
  disabled,
}: {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  disabled: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  const monthYear = useMemo(() => {
    return new Intl.DateTimeFormat("es-AR", {
      month: "long",
      year: "numeric",
    }).format(selectedDate);
  }, [selectedDate]);

  const goToPrevMonth = () => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() - 1);
    onDateChange(newDate);
  };

  const goToNextMonth = () => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() + 1);
    onDateChange(newDate);
  };

  const goToToday = () => {
    onDateChange(new Date());
  };

  const isCurrentMonth = useMemo(() => {
    const today = new Date();
    return (
      selectedDate.getMonth() === today.getMonth() &&
      selectedDate.getFullYear() === today.getFullYear()
    );
  }, [selectedDate]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!containerRef.current || disabled) return;

      const activeElement = document.activeElement as HTMLElement | null;
      if (
        activeElement &&
        ["INPUT", "TEXTAREA", "SELECT"].includes(activeElement.tagName)
      ) {
        return;
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goToPrevMonth();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goToNextMonth();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedDate, disabled]);

  return (
    <div
      ref={containerRef}
      className="flex flex-wrap items-center gap-4"
      aria-label="Selector de período"
    >
      <div className="flex items-center gap-2 text-sm font-medium text-neutral-700">
        <Calendar className="h-4 w-4" aria-hidden="true" />
        Período
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={goToPrevMonth}
          disabled={disabled}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-300 bg-white text-neutral-600 shadow-sm transition-colors hover:bg-neutral-50 hover:text-neutral-900 disabled:opacity-40 disabled:hover:bg-white"
          aria-label="Mes anterior"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 19.5L8.25 12l7.5-7.5"
            />
          </svg>
        </button>

        <div
          className="flex min-w-[200px] items-center justify-center rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold capitalize text-neutral-900 shadow-sm"
          role="status"
          aria-live="polite"
        >
          {monthYear}
        </div>

        <button
          onClick={goToNextMonth}
          disabled={disabled}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-300 bg-white text-neutral-600 shadow-sm transition-colors hover:bg-neutral-50 hover:text-neutral-900 disabled:opacity-40 disabled:hover:bg-white"
          aria-label="Mes siguiente"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.25 4.5l7.5 7.5-7.5 7.5"
            />
          </svg>
        </button>

        {!isCurrentMonth && (
          <button
            onClick={goToToday}
            disabled={disabled}
            className="ml-2 inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 shadow-sm transition-colors hover:bg-neutral-50 hover:text-neutral-900 disabled:opacity-40"
          >
            Hoy
          </button>
        )}
      </div>

      <div className="ml-auto text-xs text-neutral-500">Usa ← → para navegar</div>
    </div>
  );
}

/* ============================
 * Empty State (con micro-detalle)
 * ============================ */
function EmptyState() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 shadow-inner">
          <Search className="h-10 w-10 text-slate-400" aria-hidden="true" />
        </div>
        <h3 className="mt-5 text-xl font-bold text-slate-900">
          Sin afiliado seleccionado
        </h3>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-600">
          Busca un afiliado usando el campo de búsqueda en la parte superior para
          ver sus movimientos y cuenta corriente.
        </p>
        <p className="mt-3 text-xs text-slate-500">
          Tip: Usa{" "}
          <kbd className="rounded-lg bg-slate-100 px-2 py-1 font-mono text-xs font-semibold shadow-sm">
            Ctrl+K
          </kbd>{" "}
          para acceder rápidamente
        </p>
      </div>
    </div>
  );
}

/* ============================
 * KPIs (sin cambios de lógica, mejor contraste/estados)
 * ============================ */
function KPI({
  label,
  value,
  subtitle,
  icon: Icon,
  accent,
  primary,
}: {
  label: string;
  value: React.ReactNode;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  accent?: "emerald" | "rose" | "neutral";
  primary?: boolean;
}) {
  const accentColors = {
    emerald: "from-emerald-400 to-green-600 shadow-emerald-500/30",
    rose: "from-rose-400 to-pink-600 shadow-rose-500/30",
    neutral: "from-slate-400 to-slate-600 shadow-slate-500/30",
  };

  const iconBg = {
    emerald: "from-emerald-50 to-green-50 text-emerald-600",
    rose: "from-rose-50 to-pink-50 text-rose-600",
    neutral: "from-slate-50 to-slate-100 text-slate-600",
  };

  return (
    <div
      className={cx(
        "relative overflow-hidden rounded-2xl border bg-white p-6 shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl",
        primary && accent ? "border-transparent ring-2 ring-offset-2" : "border-slate-100",
        primary && accent === "emerald" && "ring-emerald-500/50",
        primary && accent === "rose" && "ring-rose-500/50"
      )}
      role="status"
      aria-live="polite"
    >
      {primary && accent && (
        <div
          className={cx("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", accentColors[accent])}
        />
      )}

      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
            {label}
          </p>
          <p
            className={cx(
              "mt-3 text-3xl font-black tabular-nums tracking-tight",
              primary && accent === "emerald"
                ? "text-emerald-700"
                : primary && accent === "rose"
                ? "text-rose-700"
                : "text-slate-900"
            )}
          >
            {value}
          </p>
          {subtitle && (
            <p className="mt-2 text-xs font-medium text-slate-500">{subtitle}</p>
          )}
        </div>
        {Icon && (
          <div className={cx("rounded-xl bg-gradient-to-br p-2.5", accent ? iconBg[accent] : iconBg.neutral)}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================
 * Tabla de movimientos mejorada
 * - Header sticky
 * - Zebra + realce por tipo
 * - Vista tarjetas en mobile (sm:hidden)
 * - Accesibilidad + pequeños details
 * ============================ */
function TablaMovimientos({ rows, loading }: { rows: Movimiento[]; loading: boolean }) {
  const totalDeb = rows
    .filter((m) => m.naturaleza === "debito")
    .reduce((a, b) => a + Number(b.importe || 0), 0);
  const totalCre = rows
    .filter((m) => m.naturaleza === "credito")
    .reduce((a, b) => a + Number(b.importe || 0), 0);

  if (loading && rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
          <p className="mt-4 text-sm font-medium text-slate-600">
            Cargando movimientos...
          </p>
        </div>
      </div>
    );
  }

  /* ---------- Vista Tarjetas (mobile) ---------- */
  return (
    <div className="w-full">
      <div className="block sm:hidden">
        <ul className="divide-y divide-slate-100/70">
          {rows.map((m) => {
            const ref = m.ordenId
              ? `ORD-${m.ordenId.slice(0, 8)}`
              : m.cuotaId
              ? `CUO-${m.cuotaId.slice(0, 8)}`
              : m.obligacionId
              ? `OBL-${m.obligacionId.slice(0, 8)}`
              : m.pagoId
              ? `PAG-${m.pagoId.slice(0, 8)}`
              : m.asientoId
              ? `AST-${m.asientoId.slice(0, 8)}`
              : "—";

            const isDeb = m.naturaleza === "debito";

            return (
              <li
                key={m.id}
                className={cx(
                  "px-4 py-4 transition-colors",
                  "bg-white",
                  "hover:bg-slate-50"
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={cx(
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1",
                          isDeb
                            ? "bg-rose-50 text-rose-700 ring-rose-200"
                            : "bg-emerald-50 text-emerald-700 ring-emerald-200"
                        )}
                      >
                        {isDeb ? (
                          <TrendingDown className="h-3.5 w-3.5" />
                        ) : (
                          <TrendingUp className="h-3.5 w-3.5" />
                        )}
                        {isDeb ? "Débito" : "Crédito"}
                      </span>
                      <span className="text-xs font-medium text-slate-500">
                        {fmtFecha(m.fecha)}
                      </span>
                    </div>
                    <div className="mt-2 line-clamp-2 text-sm font-semibold text-slate-900">
                      {m.concepto}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="inline-flex rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase text-slate-600">
                        {m.origen.replace(/_/g, " ")}
                      </span>
                      <button
                        type="button"
                        title="Copiar referencia"
                        onClick={() =>
                          ref !== "—" && navigator.clipboard?.writeText(ref)
                        }
                        className="inline-flex rounded-lg bg-white px-2 py-0.5 text-[11px] font-mono font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                      >
                        {ref}
                      </button>
                    </div>
                  </div>

                  <div className="text-right">
                    <div
                      className={cx(
                        "whitespace-nowrap text-sm font-black tabular-nums",
                        isDeb ? "text-rose-600" : "text-emerald-600"
                      )}
                    >
                      {isDeb ? "-" : "+"}
                      {money(m.importe)}
                    </div>
                    <div className="mt-1 text-[11px] font-semibold text-slate-500">
                      Saldo:{" "}
                      <span className="font-bold text-slate-900">
                        {money(m.saldoPosterior ?? 0)}
                      </span>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
          {rows.length === 0 && !loading && (
            <li className="px-4 py-10">
              <div className="flex flex-col items-center justify-center">
                <div className="rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 p-4 shadow-inner">
                  <Search className="h-8 w-8 text-slate-400" />
                </div>
                <p className="mt-4 text-base font-bold text-slate-900">
                  Sin movimientos
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  No hay movimientos para los filtros seleccionados
                </p>
              </div>
            </li>
          )}
        </ul>
      </div>

      {/* ---------- Vista Tabla (desktop) ---------- */}
      <div className="hidden sm:block">
        <div className="max-h-[60vh] overflow-auto">
          <table
            className="min-w-full"
            aria-label="Tabla de movimientos"
            aria-busy={loading}
          >
            <thead className="sticky top-0 z-10 border-b border-slate-100 bg-white/85 backdrop-blur-sm">
              <tr className="text-left text-xs font-bold uppercase tracking-wider text-slate-600">
                <th className="px-7 py-4">Fecha</th>
                <th className="px-7 py-4">Tipo</th>
                <th className="px-7 py-4">Concepto</th>
                <th className="px-7 py-4">Origen</th>
                <th className="px-7 py-4 text-right">Importe</th>
                <th className="px-7 py-4 text-right">Saldo</th>
                <th className="px-7 py-4">Ref.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/50">
              {rows.map((m, idx) => {
                const ref = m.ordenId
                  ? `ORD-${m.ordenId.slice(0, 8)}`
                  : m.cuotaId
                  ? `CUO-${m.cuotaId.slice(0, 8)}`
                  : m.obligacionId
                  ? `OBL-${m.obligacionId.slice(0, 8)}`
                  : m.pagoId
                  ? `PAG-${m.pagoId.slice(0, 8)}`
                  : m.asientoId
                  ? `AST-${m.asientoId.slice(0, 8)}`
                  : "—";

                const isDeb = m.naturaleza === "debito";

                return (
                  <tr
                    key={m.id}
                    className={cx(
                      "transition-all hover:bg-slate-50/50",
                      idx % 2 === 0 && "bg-white",
                      idx % 2 !== 0 && "bg-slate-50/30"
                    )}
                  >
                    <td className="whitespace-nowrap px-7 py-4 text-sm font-semibold text-slate-700">
                      {fmtFecha(m.fecha)}
                    </td>
                    <td className="px-7 py-4">
                      <span
                        className={cx(
                          "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold shadow-sm ring-1",
                          isDeb
                            ? "bg-rose-50 text-rose-700 ring-rose-200"
                            : "bg-emerald-50 text-emerald-700 ring-emerald-200"
                        )}
                      >
                        {isDeb ? (
                          <TrendingDown className="h-3.5 w-3.5" />
                        ) : (
                          <TrendingUp className="h-3.5 w-3.5" />
                        )}
                        {isDeb ? "Débito" : "Crédito"}
                      </span>
                    </td>
                    <td className="max-w-xs px-7 py-4">
                      <span
                        className="line-clamp-2 text-sm font-semibold text-slate-900"
                        title={m.concepto}
                      >
                        {m.concepto}
                      </span>
                    </td>
                    <td className="px-7 py-4">
                      <span className="inline-flex rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase text-slate-600">
                        {m.origen.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td
                      className={cx(
                        "whitespace-nowrap px-7 py-4 text-right text-sm font-black tabular-nums",
                        isDeb ? "text-rose-600" : "text-emerald-600"
                      )}
                    >
                      {isDeb ? "-" : "+"}
                      {money(m.importe)}
                    </td>
                    <td className="whitespace-nowrap px-7 py-4 text-right text-sm font-bold tabular-nums text-slate-900">
                      {money(m.saldoPosterior ?? 0)}
                    </td>
                    <td className="px-7 py-4">
                      <button
                        type="button"
                        onClick={() =>
                          ref !== "—" && navigator.clipboard?.writeText(ref)
                        }
                        className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-xs font-semibold text-slate-600 ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
                        title="Copiar referencia"
                      >
                        {ref}
                      </button>
                    </td>
                  </tr>
                );
              })}

              {rows.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="px-7 py-20 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 p-4 shadow-inner">
                        <Search className="h-8 w-8 text-slate-400" />
                      </div>
                      <p className="mt-4 text-base font-bold text-slate-900">
                        Sin movimientos
                      </p>
                      <p className="mt-2 text-sm text-slate-600">
                        No hay movimientos para los filtros seleccionados
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>

            {/* Footer: totales */}
            {rows.length > 0 && (
              <tfoot className="sticky bottom-0 border-t-2 border-slate-200 bg-gradient-to-r from-white to-blue-50/30 backdrop-blur-sm">
                <tr>
                  <td
                    colSpan={4}
                    className="px-7 py-5 text-right text-sm font-bold text-slate-900"
                  >
                    Totales del período
                  </td>
                  <td className="px-7 py-5 text-right font-mono text-sm">
                    <div className="space-y-2">
                      <div className="flex items-center justify-end gap-3 text-emerald-700">
                        <span className="text-xs font-semibold">Créditos:</span>
                        <span className="text-base font-black">
                          +{money(totalCre)}
                        </span>
                      </div>
                      <div className="flex items-center justify-end gap-3 text-rose-700">
                        <span className="text-xs font-semibold">Débitos:</span>
                        <span className="text-base font-black">
                          -{money(totalDeb)}
                        </span>
                      </div>
                      <div className="flex items-center justify-end gap-3 rounded-lg bg-white/80 px-3 py-2 font-black text-slate-900 shadow-sm ring-1 ring-slate-200">
                        <span className="text-xs">Neto:</span>
                        <span className="text-lg">
                          {money(totalCre - totalDeb)}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
