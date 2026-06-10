"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  FileText,
  FilePlus,
  Loader2,
  Search,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { api, ORG, getErrorMessage } from "@/servicios/api";
import { mon, fmtFecha } from "@/utiles/formatos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type RolTercero = "PROVEEDOR" | "PRESTADOR" | "AFILIADO" | "OTRO";
type Tipo = "FACTURA" | "PRESTACION" | "NOTA_CREDITO" | "NOTA_DEBITO";
type Estado = "borrador" | "emitido" | "contabilizado" | "pagado" | "anulado";

type Item = {
  id: string;
  fecha: string;
  tipo: Tipo;
  clase?: "A" | "B" | "C" | "M" | "X" | null;
  puntoVenta?: number | null;
  numero?: number | null;
  total: number;
  estado: Estado;
  cuentaId?: string;
  rol: RolTercero;
  tercero?: { id: string; nombre: string; cuit?: string | null } | null;
};

type PageResp = {
  items: Item[];
  total: number;
  page: number;
  pages: number;
};

const ROL_BADGE: Record<RolTercero, string> = {
  PROVEEDOR: "bg-blue-100 text-blue-800 border-blue-200",
  PRESTADOR: "bg-violet-100 text-violet-800 border-violet-200",
  AFILIADO: "bg-emerald-100 text-emerald-800 border-emerald-200",
  OTRO: "bg-neutral-100 text-neutral-700 border-neutral-200",
};

const ESTADO_BADGE: Record<Estado, string> = {
  borrador: "bg-amber-100 text-amber-800 border-amber-200",
  emitido: "bg-medical-100 text-medical-800 border-medical-200",
  contabilizado: "bg-indigo-100 text-indigo-800 border-indigo-200",
  pagado: "bg-emerald-100 text-emerald-800 border-emerald-200",
  anulado: "bg-rose-100 text-rose-700 border-rose-200",
};

const TIPO_LABEL: Record<Tipo, string> = {
  FACTURA: "Factura",
  PRESTACION: "Prestación",
  NOTA_CREDITO: "N. Crédito",
  NOTA_DEBITO: "N. Débito",
};

export default function ComprobantesListadoPage() {
  const [q, setQ] = useState("");
  const [rol, setRol] = useState<RolTercero | "">("");
  const [estado, setEstado] = useState<Estado | "">("");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<PageResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [anulando, setAnulando] = useState<string | null>(null);

  const query = useMemo(() => {
    const u = new URLSearchParams();
    if (rol) u.set("rol", rol);
    if (estado) u.set("estado", estado);
    if (q.trim()) u.set("q", q.trim());
    u.set("page", String(page));
    u.set("pageSize", "20");
    return `/terceros/comprobantes?${u.toString()}`;
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
    if (!confirm("¿Anular el comprobante? Esta acción no se puede revertir.")) return;
    try {
      setAnulando(id);
      await api<{ ok?: boolean }>(`/terceros/comprobantes/${id}/anular`, {
        method: "POST",
        body: JSON.stringify({ organizacionId: ORG }),
      });
      await load();
    } catch (e) {
      setMsg(`Error al anular: ${getErrorMessage(e)}`);
    } finally {
      setAnulando(null);
    }
  };

  const handleClearFilters = () => {
    setQ("");
    setRol("");
    setEstado("");
    setPage(1);
  };

  const hasActiveFilters = Boolean(q.trim() || rol || estado);
  const rows = data?.items ?? [];

  return (
    <div className="mx-auto max-w-7xl">
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[260px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
          <Input
            placeholder="Buscar por tercero, CUIT o número..."
            aria-label="Buscar comprobantes"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded-lg border-neutral-200 pl-9 pr-8"
          />
          {q && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 size-7 -translate-y-1/2"
              onClick={() => {
                setQ("");
                setPage(1);
              }}
              title="Limpiar búsqueda"
            >
              <X className="size-4" />
            </Button>
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
          <option value="AFILIADO">Afiliado</option>
          <option value="OTRO">Otro</option>
        </select>
        <select
          aria-label="Estado del comprobante"
          value={estado}
          onChange={(e) => {
            setEstado(e.target.value as Estado | "");
            setPage(1);
          }}
          className="h-9 rounded-lg border border-neutral-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-medical-500"
        >
          <option value="">Todos los estados</option>
          <option value="borrador">Borrador</option>
          <option value="emitido">Emitido</option>
          <option value="contabilizado">Contabilizado</option>
          <option value="pagado">Pagado</option>
          <option value="anulado">Anulado</option>
        </select>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            title="Limpiar filtros"
            className="h-9 gap-1 text-neutral-600"
          >
            <Trash2 className="size-4" />
            Limpiar
          </Button>
        )}
        <div className="ml-auto">
          <Button asChild className="h-9 gap-2">
            <Link href="/terceros/comprobantes/nuevo">
              <FilePlus className="size-4" />
              Nuevo comprobante
            </Link>
          </Button>
        </div>
      </div>

      {/* Alert error */}
      {msg && (
        <div
          className="mb-4 flex items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
          role="alert"
        >
          <AlertCircle className="size-5 shrink-0" />
          <span className="font-medium">{msg}</span>
          <button
            onClick={() => setMsg(null)}
            className="ml-auto rounded p-1 hover:bg-rose-100"
            aria-label="Cerrar"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      <Card className="relative mb-4 overflow-hidden rounded-xl border-neutral-200">
        {/* Barra de progreso al refetchear con datos */}
        {loading && rows.length > 0 && (
          <div className="absolute inset-x-0 top-0 z-10 h-0.5 animate-pulse bg-medical-500" />
        )}

        {loading && rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center text-neutral-500">
            <Loader2 className="mb-3 size-6 animate-spin" />
            Cargando comprobantes…
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-neutral-100 text-neutral-400">
              <FileText className="size-6" />
            </div>
            <h3 className="text-lg font-semibold text-neutral-900">
              {hasActiveFilters ? "Sin resultados" : "No hay comprobantes"}
            </h3>
            <p className="mt-1 max-w-md text-sm text-neutral-600">
              {hasActiveFilters
                ? "Ajustá los filtros para ver resultados."
                : "Creá el primer comprobante para empezar."}
            </p>
            {hasActiveFilters ? (
              <Button variant="outline" className="mt-4" onClick={handleClearFilters}>
                Limpiar filtros
              </Button>
            ) : (
              <Button asChild className="mt-4 gap-2">
                <Link href="/terceros/comprobantes/nuevo">
                  <FilePlus className="size-4" />
                  Nuevo comprobante
                </Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-500">
                <tr>
                  <th className="px-4 py-3">Comprobante</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Tercero</th>
                  <th className="px-4 py-3">Rol</th>
                  <th className="px-4 py-3">Número</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {rows.map((r) => {
                  const nro = [r.puntoVenta ?? "", r.numero ?? ""].filter(Boolean).join("-");
                  return (
                    <tr key={r.id} className="hover:bg-neutral-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FileText className="size-4 text-neutral-400" />
                          <div>
                            <div className="font-medium text-neutral-900">
                              {TIPO_LABEL[r.tipo] ?? r.tipo}
                              {r.clase && (
                                <span className="ml-1 rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-700">
                                  {r.clase}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-neutral-500">ID {r.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-neutral-700">{fmtFecha(r.fecha)}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-neutral-900">
                          {r.tercero?.nombre ?? "Sin tercero"}
                        </div>
                        {r.tercero?.cuit && (
                          <div className="text-[11px] text-neutral-500">
                            CUIT {r.tercero.cuit}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={`${ROL_BADGE[r.rol]} text-[11px]`}
                        >
                          {r.rol}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-mono text-neutral-700">
                        {nro || "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">
                        {mon(r.total)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          variant="outline"
                          className={`${ESTADO_BADGE[r.estado]} text-[11px] capitalize`}
                        >
                          {r.estado}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {r.cuentaId && (
                            <Button
                              asChild
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1"
                              title="Ver cuenta asociada"
                            >
                              <Link href={`/finanzas/cuentas/${r.cuentaId}`}>
                                <Eye className="size-4" />
                              </Link>
                            </Button>
                          )}
                          {r.estado !== "anulado" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => anular(r.id)}
                              disabled={anulando === r.id}
                              className="h-8 gap-1 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                              title="Anular"
                            >
                              {anulando === r.id ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <XCircle className="size-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Paginación */}
      {!loading && data && data.items.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="text-xs text-neutral-500">
            Página {data.page} de {data.pages} · {data.total} resultados
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => setPage(1)}
              disabled={data.page <= 1}
              title="Primera"
            >
              <ChevronsLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={data.page <= 1}
              title="Anterior"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="px-2 text-sm font-medium tabular-nums text-neutral-700">
              {data.page}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => setPage((p) => p + 1)}
              disabled={data.page >= data.pages}
              title="Siguiente"
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => setPage(data.pages)}
              disabled={data.page >= data.pages}
              title="Última"
            >
              <ChevronsRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
