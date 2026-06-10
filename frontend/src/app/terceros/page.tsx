"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Eye,
  Loader2,
  Pencil,
  Plus,
  Search,
  Wallet,
  X,
} from "lucide-react";
import { api, getErrorMessage } from "@/servicios/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Rol = "PROVEEDOR" | "PRESTADOR" | "COMERCIO" | "AFILIADO" | "OTRO";

type Row = {
  id: string;
  nombre: string;
  fantasia?: string | null;
  cuit?: string | null;
  codigo?: string | null;
  tipoPersona?: "FISICA" | "JURIDICA" | "OTRO" | null;
  condIva?:
    | "INSCRIPTO"
    | "MONOTRIBUTO"
    | "EXENTO"
    | "CONSUMIDOR_FINAL"
    | "NO_RESPONSABLE"
    | null;
  activo: boolean;
  roles: { rol: Rol }[];
};

type PageResp = {
  items: Row[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
};

type CuentaLite = {
  id: string;
  rol: Rol;
  activo: boolean;
  saldoInicial?: number | null;
  saldoActual?: number | null;
};

const fmtARS = (n: number | null | undefined) =>
  Number(n ?? 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  });

// Color del saldo segun rol.
// PROVEEDOR / PRESTADOR / COMERCIO / OTRO: positivo = les debemos (rojo); negativo = saldo a favor nuestro (verde).
// AFILIADO: positivo = nos debe (verde); negativo = pagado de mas / a favor (rojo).
const saldoColor = (rol: Rol, saldo: number | null | undefined) => {
  const s = saldo ?? 0;
  if (s === 0) return "text-neutral-600";
  const positivoEsBueno = rol === "AFILIADO";
  const esBueno = positivoEsBueno ? s > 0 : s < 0;
  return esBueno ? "text-emerald-700" : "text-rose-700";
};

const ROL_BADGE: Record<Rol, string> = {
  PROVEEDOR: "bg-blue-100 text-blue-800 border-blue-200",
  PRESTADOR: "bg-violet-100 text-violet-800 border-violet-200",
  COMERCIO: "bg-amber-100 text-amber-800 border-amber-200",
  AFILIADO: "bg-emerald-100 text-emerald-800 border-emerald-200",
  OTRO: "bg-neutral-100 text-neutral-700 border-neutral-200",
};

const getRolIcon = (rol: Rol) => {
  switch (rol) {
    case "PROVEEDOR":
      return "🏢";
    case "PRESTADOR":
      return "🏥";
    case "COMERCIO":
      return "🏬";
    case "AFILIADO":
      return "👤";
    case "OTRO":
      return "📝";
    default:
      return "❓";
  }
};

export default function TercerosListadoPage() {
  const router = useRouter();

  const [q, setQ] = useState("");
  const [rol, setRol] = useState<Rol | "">("");
  const [activo, setActivo] = useState<"" | "true" | "false">("");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<PageResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // estado de panel y cache de cuentas por tercero
  const [openCuentasFor, setOpenCuentasFor] = useState<string | null>(null);
  const [cuentas, setCuentas] = useState<Record<string, CuentaLite[]>>({});
  const [loadingCuentas, setLoadingCuentas] = useState<Record<string, boolean>>(
    {}
  );

  const query = useMemo(() => {
    const u = new URLSearchParams();
    if (q.trim()) u.set("q", q.trim());
    if (rol) u.set("rol", rol);
    if (activo) u.set("activo", String(activo));
    u.set("page", String(page));
    u.set("pageSize", "20");
    return `/terceros?${u.toString()}`;
  }, [q, rol, activo, page]);

  const load = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await api<PageResp>(query);
      setData(res);
    } catch (e) {
      setMsg(getErrorMessage(e));
      setData({ items: [], total: 0, page: 1, pageSize: 20, pages: 1 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [query]);

  // carga (o usa cache) de cuentas de un tercero
  const ensureCuentas = async (terceroId: string): Promise<CuentaLite[]> => {
    if (cuentas[terceroId]) return cuentas[terceroId];
    setLoadingCuentas((m) => ({ ...m, [terceroId]: true }));
    try {
      const res = await api<{ cuentas: CuentaLite[] }>(
        `/cuentas-tercero/por-tercero?terceroId=${encodeURIComponent(
          terceroId
        )}`
      );
      const arr = res.cuentas || [];
      setCuentas((m) => ({ ...m, [terceroId]: arr }));
      return arr;
    } catch (e) {
      setMsg(`Error al cargar cuentas: ${getErrorMessage(e)}`);
      return [];
    } finally {
      setLoadingCuentas((m) => ({ ...m, [terceroId]: false }));
    }
  };

  // handler del botón "Ver cuenta"
  const verCuenta = async (terceroId: string) => {
    const arr = await ensureCuentas(terceroId);
    if (arr.length === 1) {
      router.push(`/finanzas/cuentas/${arr[0].id}`);
    } else {
      // abre panel para que elijan cuál
      setOpenCuentasFor((curr) => (curr === terceroId ? null : terceroId));
    }
  };

  const exportCSV = () => {
    if (!data?.items.length) return;
    const rows: string[][] = [
      [
        "Nombre",
        "Fantasía",
        "CUIT",
        "Código",
        "Tipo",
        "Condición IVA",
        "Roles",
        "Estado",
      ],
      ...data.items.map((item) => [
        item.nombre,
        item.fantasia ?? "",
        item.cuit ?? "",
        item.codigo ?? "",
        item.tipoPersona ?? "",
        item.condIva ?? "",
        (item.roles ?? []).map((r) => r.rol).join(", "),
        item.activo ? "Activo" : "Inactivo",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `terceros_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setQ("");
    setRol("");
    setActivo("");
    setPage(1);
  };

  const hasFilters = q.trim() || rol || activo;

  return (
    <div className="mx-auto max-w-7xl">
      {/* Toolbar */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Terceros</h1>
          <p className="text-sm text-neutral-500">
            Proveedores, prestadores y comercios
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportCSV}
            disabled={!data?.items.length}
            className="gap-1.5"
          >
            <Download className="size-4" />
            Exportar
          </Button>
          <Button size="sm" asChild className="gap-1.5">
            <Link href="/terceros/nuevo">
              <Plus className="size-4" />
              Nuevo tercero
            </Link>
          </Button>
        </div>
      </div>

      {msg && (
        <div
          className="mb-4 flex items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
          role="alert"
        >
          <AlertCircle className="size-5 shrink-0" />
          <span className="font-medium">{msg}</span>
          <button
            onClick={() => setMsg(null)}
            className="ml-auto rounded p-1 hover:bg-black/5"
            aria-label="Cerrar"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Filtros + stats */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[260px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
          <Input
            className="h-9 rounded-lg border-neutral-200 pl-9 pr-9"
            placeholder="Nombre, fantasía, CUIT o código…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
          {q && (
            <button
              onClick={() => {
                setQ("");
                setPage(1);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-neutral-400 hover:text-neutral-700"
              aria-label="Limpiar búsqueda"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <select
          aria-label="Rol"
          value={rol}
          onChange={(e) => {
            setRol(e.target.value as Rol | "");
            setPage(1);
          }}
          className="h-9 rounded-lg border border-neutral-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-medical-500"
        >
          <option value="">Todos los roles</option>
          <option value="PROVEEDOR">Proveedor</option>
          <option value="PRESTADOR">Prestador</option>
          <option value="COMERCIO">Comercio</option>
        </select>

        <select
          aria-label="Estado"
          value={activo}
          onChange={(e) => {
            setActivo(e.target.value as "" | "true" | "false");
            setPage(1);
          }}
          className="h-9 rounded-lg border border-neutral-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-medical-500"
        >
          <option value="">Todos los estados</option>
          <option value="true">Activos</option>
          <option value="false">Inactivos</option>
        </select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Limpiar
          </Button>
        )}

        {data && (
          <span className="ml-auto text-sm text-neutral-500">
            <span className="font-semibold text-neutral-800">{data.total}</span>{" "}
            terceros
          </span>
        )}
      </div>

      {/* Tabla */}
      <Card className="overflow-hidden rounded-xl border-neutral-200">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-neutral-500">
            <Loader2 className="size-4 animate-spin" />
            Cargando terceros…
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm font-medium text-neutral-700">Sin terceros</p>
            <p className="mt-1 text-sm text-neutral-500">
              {hasFilters
                ? "No se encontraron terceros con los filtros aplicados."
                : "Cargá el primer tercero para empezar."}
            </p>
            {hasFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                className="mt-3"
              >
                Limpiar filtros
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-500">
                <tr>
                  <th className="px-4 py-2.5">Tercero</th>
                  <th className="px-4 py-2.5">CUIT</th>
                  <th className="px-4 py-2.5">Roles</th>
                  <th className="px-4 py-2.5">Estado</th>
                  <th className="px-4 py-2.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {data.items.map((tercero) => {
                  const isOpen = openCuentasFor === tercero.id;
                  const cuentasRow = cuentas[tercero.id] || [];
                  const cargando = loadingCuentas[tercero.id];

                  return (
                    <Fragment key={tercero.id}>
                      <tr className="hover:bg-neutral-50/60">
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-neutral-900">
                            {tercero.nombre}
                            {tercero.fantasia && (
                              <span className="ml-1 font-normal text-neutral-400">
                                ({tercero.fantasia})
                              </span>
                            )}
                          </div>
                          {tercero.codigo && (
                            <div className="text-xs text-neutral-500">
                              Código {tercero.codigo}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs tabular-nums text-neutral-700">
                          {tercero.cuit || "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex flex-wrap gap-1">
                            {(tercero.roles ?? []).map((r, i) => (
                              <Badge
                                key={i}
                                variant="outline"
                                className={`gap-1 text-[10px] ${ROL_BADGE[r.rol]}`}
                              >
                                <span>{getRolIcon(r.rol)}</span>
                                {r.rol}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge
                            variant="outline"
                            className={
                              tercero.activo
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-neutral-200 bg-neutral-100 text-neutral-500"
                            }
                          >
                            {tercero.activo ? "Activo" : "Inactivo"}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              asChild
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1.5 px-2 text-neutral-600"
                            >
                              <Link href={`/terceros/${tercero.id}`}>
                                <Eye className="size-4" />
                                Ver
                              </Link>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1.5 px-2 text-neutral-600"
                              onClick={() => verCuenta(tercero.id)}
                              title="Cuentas corrientes"
                            >
                              <Wallet className="size-4" />
                              Cuentas
                            </Button>
                          </div>
                        </td>
                      </tr>

                      {isOpen && (
                        <tr>
                          <td colSpan={5} className="bg-neutral-50/70 px-4 py-3">
                            {cargando ? (
                              <div className="flex items-center gap-2 text-sm text-neutral-500">
                                <Loader2 className="size-4 animate-spin" />
                                Cargando cuentas…
                              </div>
                            ) : cuentasRow.length === 0 ? (
                              <p className="text-sm text-neutral-500">
                                Este tercero no tiene cuentas registradas.
                              </p>
                            ) : (
                              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                {cuentasRow.map((cuenta) => (
                                  <button
                                    key={cuenta.id}
                                    onClick={() =>
                                      router.push(
                                        `/finanzas/cuentas/${cuenta.id}`
                                      )
                                    }
                                    className="rounded-lg border border-neutral-200 bg-white p-3 text-left transition hover:border-medical-300 hover:shadow-sm"
                                    title={`Ver extracto de la cuenta ${cuenta.rol}`}
                                  >
                                    <div className="mb-2 flex items-center justify-between">
                                      <Badge
                                        variant="outline"
                                        className={`gap-1 text-[10px] ${ROL_BADGE[cuenta.rol]}`}
                                      >
                                        <span>{getRolIcon(cuenta.rol)}</span>
                                        {cuenta.rol}
                                      </Badge>
                                      <span
                                        className={`text-[10px] font-medium ${
                                          cuenta.activo
                                            ? "text-emerald-600"
                                            : "text-neutral-400"
                                        }`}
                                      >
                                        {cuenta.activo ? "Activa" : "Inactiva"}
                                      </span>
                                    </div>
                                    <div className="flex items-baseline justify-between">
                                      <span className="text-xs text-neutral-500">
                                        Saldo actual
                                      </span>
                                      <span
                                        className={`font-mono text-sm font-semibold tabular-nums ${
                                          saldoColor(cuenta.rol, cuenta.saldoActual)
                                        }`}
                                      >
                                        {fmtARS(cuenta.saldoActual)}
                                      </span>
                                    </div>
                                    <div className="flex items-baseline justify-between">
                                      <span className="text-xs text-neutral-500">
                                        Saldo inicial
                                      </span>
                                      <span className="font-mono text-xs tabular-nums text-neutral-600">
                                        {fmtARS(cuenta.saldoInicial)}
                                      </span>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Paginación */}
      {data && data.pages > 1 && (
        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="text-sm text-neutral-500">
            Página {data.page} de {data.pages} · {data.total} terceros
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={loading || data.page <= 1}
              onClick={() => setPage(1)}
              title="Primera página"
            >
              <ChevronsLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={loading || data.page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              title="Anterior"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={loading || data.page >= data.pages}
              onClick={() => setPage((p) => p + 1)}
              title="Siguiente"
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={loading || data.page >= data.pages}
              onClick={() => setPage(data.pages)}
              title="Última página"
            >
              <ChevronsRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
