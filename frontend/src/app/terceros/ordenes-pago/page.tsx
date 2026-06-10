"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Ban,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Loader2,
  Plus,
  Search,
  Wallet,
  X,
} from "lucide-react";
import { api, ORG, getErrorMessage } from "@/servicios/api";
import { formatearFechaArgentina } from "@/utiles/formatos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type RolTercero = "PROVEEDOR" | "PRESTADOR" | "COMERCIO" | "AFILIADO" | "OTRO";
type Estado = "borrador" | "confirmado" | "anulado";

type Item = {
  id: string;
  fecha: string;
  total: number;
  estado: Estado;
  rol: RolTercero;
  cuentaId?: string;
  numeroOP?: number;
  tercero?: { id: string; nombre: string; cuit?: string | null } | null;
};

type PageResp = {
  items: Item[];
  total: number;
  page: number;
  pages: number;
};

const fmtMoney = (n: number | null | undefined) =>
  Number(n ?? 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  });

const fmtDate = (s?: string | null) => (s ? formatearFechaArgentina(s) : "—");

const ROL_BADGE: Record<RolTercero, string> = {
  PROVEEDOR: "bg-blue-100 text-blue-800 border-blue-200",
  PRESTADOR: "bg-violet-100 text-violet-800 border-violet-200",
  COMERCIO: "bg-amber-100 text-amber-800 border-amber-200",
  AFILIADO: "bg-emerald-100 text-emerald-800 border-emerald-200",
  OTRO: "bg-neutral-100 text-neutral-700 border-neutral-200",
};

const ESTADO_BADGE: Record<Estado, string> = {
  borrador: "bg-amber-100 text-amber-800 border-amber-200",
  confirmado: "bg-emerald-100 text-emerald-800 border-emerald-200",
  anulado: "bg-rose-100 text-rose-700 border-rose-200",
};

const ESTADO_LABEL: Record<Estado, string> = {
  borrador: "Borrador",
  confirmado: "Confirmada",
  anulado: "Anulada",
};

export default function OrdenesPagoListadoPage() {
  const [q, setQ] = useState("");
  const [rol, setRol] = useState<RolTercero | "">("");
  const [estado, setEstado] = useState<Estado | "">("");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<PageResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const query = useMemo(() => {
    const u = new URLSearchParams();
    if (rol) u.set("rol", rol);
    if (estado) u.set("estado", estado);
    if (q.trim()) u.set("q", q.trim());
    u.set("page", String(page));
    u.set("pageSize", "20");
    return `/terceros/ordenes-pago?${u.toString()}`;
  }, [q, rol, estado, page]);

  const load = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await api<PageResp>(query);
      setData(res);
    } catch (e) {
      setMsg(getErrorMessage(e));
      setData({ items: [], total: 0, page: 1, pages: 1 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const anular = async (id: string) => {
    if (!confirm("¿Anular la orden de pago? Esto revertirá aplicaciones."))
      return;
    try {
      setLoading(true);
      await api<{ ok?: boolean }>(`/terceros/ordenes-pago/${id}/anular`, {
        method: "POST",
        body: JSON.stringify({ organizacionId: ORG }),
      });
      await load();
    } catch (e) {
      alert(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    if (!data?.items.length) return;
    const rows: string[][] = [
      ["N°", "Fecha", "Tercero", "CUIT", "Rol", "Total", "Estado"],
      ...data.items.map((item) => [
        String(item.numeroOP ?? ""),
        fmtDate(item.fecha),
        item.tercero?.nombre ?? "",
        item.tercero?.cuit ?? "",
        item.rol,
        String(item.total),
        item.estado,
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ordenes-pago_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setQ("");
    setRol("");
    setEstado("");
    setPage(1);
  };

  const hasFilters = q.trim() || rol || estado;

  const montoTotalPagina = useMemo(
    () => (data?.items ?? []).reduce((s, it) => s + Number(it.total || 0), 0),
    [data]
  );

  return (
    <div className="mx-auto max-w-7xl">
      {/* Toolbar */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">
            Órdenes de pago
          </h1>
          <p className="text-sm text-neutral-500">
            Pagos a proveedores, prestadores y comercios
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
            <Link href="/terceros/ordenes-pago/nueva">
              <Plus className="size-4" />
              Nueva orden
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

      {/* Filtros */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[260px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
          <Input
            className="h-9 rounded-lg border-neutral-200 pl-9 pr-9"
            placeholder="Nombre o CUIT del tercero…"
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
          aria-label="Rol del tercero"
          value={rol}
          onChange={(e) => {
            setRol(e.target.value as RolTercero | "");
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
          aria-label="Estado de la orden"
          value={estado}
          onChange={(e) => {
            setEstado(e.target.value as Estado | "");
            setPage(1);
          }}
          className="h-9 rounded-lg border border-neutral-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-medical-500"
        >
          <option value="">Todos los estados</option>
          <option value="borrador">Borrador</option>
          <option value="confirmado">Confirmada</option>
          <option value="anulado">Anulada</option>
        </select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Limpiar
          </Button>
        )}

        {data && (
          <span className="ml-auto text-sm text-neutral-500">
            <span className="font-semibold text-neutral-800">{data.total}</span>{" "}
            órdenes · Página:{" "}
            <span className="font-mono tabular-nums text-neutral-700">
              {fmtMoney(montoTotalPagina)}
            </span>
          </span>
        )}
      </div>

      {/* Tabla */}
      <Card className="overflow-hidden rounded-xl border-neutral-200">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-neutral-500">
            <Loader2 className="size-4 animate-spin" />
            Cargando órdenes…
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm font-medium text-neutral-700">
              Sin órdenes de pago
            </p>
            <p className="mt-1 text-sm text-neutral-500">
              {hasFilters
                ? "No se encontraron órdenes con los filtros aplicados."
                : "Generá la primera orden para empezar."}
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
                  <th className="px-4 py-2.5">N°</th>
                  <th className="px-4 py-2.5">Fecha</th>
                  <th className="px-4 py-2.5">Tercero</th>
                  <th className="px-4 py-2.5">Rol</th>
                  <th className="px-4 py-2.5 text-right">Total</th>
                  <th className="px-4 py-2.5">Estado</th>
                  <th className="px-4 py-2.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {data.items.map((item) => (
                  <tr key={item.id} className="hover:bg-neutral-50/60">
                    <td className="px-4 py-2.5 font-mono text-xs tabular-nums text-neutral-700">
                      {item.numeroOP ? `#${item.numeroOP}` : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-neutral-600">
                      {fmtDate(item.fecha)}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-neutral-900">
                        {item.tercero?.nombre ?? "—"}
                      </div>
                      {item.tercero?.cuit && (
                        <div className="font-mono text-xs text-neutral-500">
                          {item.tercero.cuit}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${ROL_BADGE[item.rol] ?? ""}`}
                      >
                        {item.rol}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums text-neutral-800">
                      {fmtMoney(item.total)}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${ESTADO_BADGE[item.estado]}`}
                      >
                        {ESTADO_LABEL[item.estado] ?? item.estado}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        {item.cuentaId && (
                          <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1.5 px-2 text-neutral-600"
                          >
                            <Link href={`/finanzas/cuentas/${item.cuentaId}`}>
                              <Wallet className="size-4" />
                              Cuenta
                            </Link>
                          </Button>
                        )}
                        {item.tercero?.id && (
                          <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-neutral-500"
                          >
                            <Link href={`/terceros/${item.tercero.id}`}>
                              Tercero
                            </Link>
                          </Button>
                        )}
                        {item.estado !== "anulado" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1.5 px-2 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                            onClick={() => void anular(item.id)}
                            disabled={loading}
                            title="Anular orden de pago"
                          >
                            <Ban className="size-4" />
                            Anular
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Paginación */}
      {data && data.pages > 1 && (
        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="text-sm text-neutral-500">
            Página {data.page} de {data.pages} · {data.total} órdenes
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
