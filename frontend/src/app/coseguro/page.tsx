"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, getErrorMessage } from "@/servicios/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader } from "@/components/ui-kit/PageHeader";

type AfiliadoListItem = {
  id: string | number;
  dni: string | number | null;
  apellido: string | null;
  nombre: string | null;
  estado: "activo" | "baja";
  coseguro?: boolean;
  colaterales?: boolean;
  padronesActivos?: { id: string | number; padron: string }[];
};

type AfiliadosPagedResp = {
  items: AfiliadoListItem[];
  total: number;
  page: number;
  limit: number;
};

function useDebouncedValue<T>(value: T, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function formatDni(dni: string | number | null | undefined) {
  if (dni == null) return "";
  const s = String(dni).replace(/\D+/g, "");
  if (!s) return "";
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function displayNombre(apellido: string | null, nombre: string | null) {
  const a = (apellido ?? "").trim();
  const n = (nombre ?? "").trim();
  if (a && n) return `${a}, ${n}`;
  if (a || n) return (a || n)!;
  return "(sin nombre)";
}

export default function CosegurosListadoPage() {
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 350);
  const [estadoAf, setEstadoAf] = useState<"todos" | "activos" | "baja">("todos");
  const [soloCoseguro, setSoloCoseguro] = useState(true);
  const [soloColaterales, setSoloColaterales] = useState(false);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const [items, setItems] = useState<AfiliadoListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (debouncedQ.trim()) p.set("q", debouncedQ.trim());
    if (estadoAf !== "todos")
      p.set("estado", estadoAf === "activos" ? "activo" : "baja");
    if (soloCoseguro) p.set("conCoseguro", "true");
    if (soloColaterales) p.set("conColaterales", "true");
    p.set("page", String(page));
    p.set("limit", String(limit));
    return p.toString();
  }, [debouncedQ, estadoAf, soloCoseguro, soloColaterales, page, limit]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const resp = await api<AfiliadosPagedResp>(`/afiliados/paged?${params}`);
        if (cancelled) return;
        setTotal(resp.total ?? 0);
        setItems(resp.items ?? []);
      } catch (e) {
        if (!cancelled) {
          setItems([]);
          setTotal(0);
          setError(getErrorMessage(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const canPrev = page > 1 && !loading;
  const canNext = page < totalPages && !loading;

  const hasActiveFilters =
    q.trim().length > 0 ||
    estadoAf !== "todos" ||
    !soloCoseguro || // por defecto está en true; cualquier cambio cuenta
    soloColaterales;

  const limpiarFiltros = () => {
    setQ("");
    setEstadoAf("todos");
    setSoloCoseguro(true);
    setSoloColaterales(false);
    setPage(1);
  };

  const kpiConCoseguro = items.filter((i) => i.coseguro).length;
  const kpiConColaterales = items.filter((i) => i.colaterales).length;

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Coseguros"
        subtitle="Listado de afiliados con cobertura J22/J38 — alta, baja y configuración desde el detalle."
      >
        <Link href="/padrones/nuevo">
          <Button variant="outline">+ Nuevo afiliado</Button>
        </Link>
      </PageHeader>

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Resultados" value={total.toLocaleString("es-AR")} loading={loading} />
        <KpiCard
          label="Página actual"
          value={`${items.length}`}
          hint={`${page} de ${totalPages}`}
          loading={loading}
        />
        <KpiCard
          label="Con coseguro (página)"
          value={kpiConCoseguro.toLocaleString("es-AR")}
          loading={loading}
        />
        <KpiCard
          label="Con colaterales (página)"
          value={kpiConColaterales.toLocaleString("es-AR")}
          loading={loading}
        />
      </div>

      {/* Filtros */}
      <Card className="mb-4 py-4">
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-0 flex-1 space-y-1.5">
              <label className="text-xs font-medium text-neutral-600">
                Buscar (apellido / DNI / padrón)
              </label>
              <Input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                placeholder="Empezar a escribir…"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-600">
                Estado afiliado
              </label>
              <select
                className="h-10 rounded-lg border border-neutral-300 bg-white px-3 text-sm hover:border-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-medical-500"
                value={estadoAf}
                onChange={(e) => {
                  setEstadoAf(e.target.value as typeof estadoAf);
                  setPage(1);
                }}
              >
                <option value="todos">Todos</option>
                <option value="activos">Solo activos</option>
                <option value="baja">Solo baja</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="inline-flex items-center gap-2 text-sm">
                <Checkbox
                  checked={soloCoseguro}
                  onCheckedChange={(v) => {
                    setSoloCoseguro(!!v);
                    setPage(1);
                  }}
                />
                <span>Con coseguro</span>
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <Checkbox
                  checked={soloColaterales}
                  onCheckedChange={(v) => {
                    setSoloColaterales(!!v);
                    setPage(1);
                  }}
                />
                <span>Con colaterales</span>
              </label>
            </div>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={limpiarFiltros}>
                Limpiar filtros
              </Button>
            )}

            <div className="ml-auto space-y-1.5">
              <label className="text-xs font-medium text-neutral-600">
                Por página
              </label>
              <select
                className="h-10 rounded-lg border border-neutral-300 bg-white px-3 text-sm"
                value={String(limit)}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
              >
                {[10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Tabla */}
      <Card className="py-0">
        <CardContent className="px-0 py-0">
          {loading && items.length === 0 ? (
            <div className="space-y-3 p-6">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-12 text-center">
              <div className="text-base font-semibold text-neutral-700">
                {hasActiveFilters ? "Sin resultados" : "No hay afiliados con coseguro"}
              </div>
              <div className="mt-1 text-sm text-neutral-500">
                {hasActiveFilters
                  ? "Probá limpiar filtros o cambiar la búsqueda."
                  : "Activá un coseguro desde el detalle de un afiliado."}
              </div>
              {hasActiveFilters && (
                <Button variant="outline" className="mt-4" onClick={limpiarFiltros}>
                  Limpiar filtros
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase text-neutral-600">
                  <tr>
                    <th className="px-4 py-3 text-left">Afiliado</th>
                    <th className="px-4 py-3 text-left">DNI</th>
                    <th className="px-4 py-3 text-left">Padrones activos</th>
                    <th className="px-4 py-3 text-center">Estado</th>
                    <th className="px-4 py-3 text-center">Coseguro</th>
                    <th className="px-4 py-3 text-center">Colaterales</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {items.map((it) => {
                    const nombre = displayNombre(it.apellido, it.nombre);
                    const dni = formatDni(it.dni);
                    return (
                      <tr key={String(it.id)} className="hover:bg-neutral-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex size-9 items-center justify-center rounded-full bg-medical-100 text-medical-700">
                              <svg
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden
                              >
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                              </svg>
                            </div>
                            <div className="font-semibold text-neutral-900">{nombre}</div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-neutral-600 tabular-nums">{dni || "—"}</td>
                        <td className="px-4 py-3">
                          {it.padronesActivos && it.padronesActivos.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {it.padronesActivos.map((p) => (
                                <Badge key={String(p.id)} variant="outline">
                                  {p.padron}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-neutral-400">Sin padrones</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={it.estado === "activo" ? "success" : "secondary"}>
                            {it.estado === "activo" ? "Activo" : "Baja"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {it.coseguro ? (
                            <Badge variant="medical">Sí</Badge>
                          ) : (
                            <span className="text-neutral-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {it.colaterales ? (
                            <Badge variant="medical">Sí</Badge>
                          ) : (
                            <span className="text-neutral-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Link href={`/afiliados/${it.id}`}>
                              <Button variant="ghost" size="sm">
                                Ficha
                              </Button>
                            </Link>
                            <Link href={`/coseguro/${it.id}`}>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={!it.padronesActivos || it.padronesActivos.length === 0}
                                title={
                                  !it.padronesActivos || it.padronesActivos.length === 0
                                    ? "Necesita un padrón activo"
                                    : undefined
                                }
                              >
                                Gestionar →
                              </Button>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Paginación */}
      {!loading && items.length > 0 && (
        <div className="mt-4 flex items-center justify-between">
          <div className="text-xs text-neutral-500">
            Mostrando {(page - 1) * limit + 1}-
            {Math.min(page * limit, total)} de {total.toLocaleString("es-AR")}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!canPrev}
              onClick={() => setPage(1)}
            >
              «
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!canPrev}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ‹
            </Button>
            <span className="px-2 text-sm tabular-nums">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={!canNext}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              ›
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!canNext}
              onClick={() => setPage(totalPages)}
            >
              »
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  loading,
}: {
  label: string;
  value: string;
  hint?: string;
  loading?: boolean;
}) {
  return (
    <Card className="py-4">
      <CardContent>
        <div className="text-xs text-neutral-500">{label}</div>
        {loading ? (
          <Skeleton className="mt-1 h-7 w-20" />
        ) : (
          <div className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900">
            {value}
          </div>
        )}
        {hint && <div className="mt-1 text-xs text-neutral-500">{hint}</div>}
      </CardContent>
    </Card>
  );
}
