/* eslint-disable @next/next/no-html-link-for-pages */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api, getErrorMessage } from "@/servicios/api";
import { InputFecha } from "@/components/InputFecha";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  UserPlus,
  Eye,
  UserMinus,
  Pencil,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Trash2,
  AlertTriangle,
  Check,
  XCircle,
} from "lucide-react";

// ---------------- Types esperados del backend ----------------
type AfiliadoListItem = {
  id: string | number;
  dni: string | number | null;
  apellido: string | null;
  nombre: string | null;
  estado: "activo" | "baja";
  coseguro?: boolean;
  colaterales?: boolean;
  padronesActivos?: { id: string | number; padron: string }[];
  deudaActual?: string;
};

type AfiliadosPagedResp = {
  items: AfiliadoListItem[];
  total: number;
  page: number;
  limit: number;
};

// ---------------- Helpers UI ----------------
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

function mapItem(it: AfiliadoListItem) {
  const padrones = (it.padronesActivos ?? []).map((p) => ({
    id: p.id,
    nro: p.padron,
    vigente: "",
  }));
  return {
    id: it.id,
    apellidoNombre: displayNombre(it.apellido, it.nombre),
    dni: formatDni(it.dni),
    padrones, // ← mantenemos estilo, ahora con id
    coseguro: !!it.coseguro,
    colaterales: !!it.colaterales,
    deudaActual: it.deudaActual ?? "",
    estado: it.estado,
  };
}

// ---------------- Page ----------------
export default function AfiliadosListadoPage() {
  // Filtros y búsqueda
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 350);
  const [estado, setEstado] = useState<"todos" | "activos" | "baja">("todos");
  const [soloCoseguro, setSoloCoseguro] = useState(false);
  const [soloColaterales, setSoloColaterales] = useState(false);

  // Paginación
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  // Datos
  const [rows, setRows] = useState<ReturnType<typeof mapItem>[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Parámetros calculados
  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (debouncedQ.trim()) p.set("q", debouncedQ.trim());
    if (estado !== "todos")
      p.set("estado", estado === "activos" ? "activo" : "baja");
    if (soloCoseguro) p.set("conCoseguro", "true");
    if (soloColaterales) p.set("conColaterales", "true");
    p.set("page", String(page));
    p.set("limit", String(limit));
    return p.toString();
  }, [debouncedQ, estado, soloCoseguro, soloColaterales, page, limit]);

  // Fetch
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setMsg(null);
      try {
        const resp = await api<AfiliadosPagedResp>(
          `/afiliados/paged?${params}`,
          {
            method: "GET",
          }
        );
        if (cancelled) return;
        setTotal(resp.total ?? 0);
        setRows((resp.items ?? []).map(mapItem));
      } catch (e: unknown) {
        if (!cancelled) {
          setRows([]);
          setTotal(0);
          setMsg(getErrorMessage(e));
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

  const onChangeLimit = (val: number) => {
    setLimit(val);
    setPage(1);
  };

  const handleClearFilters = () => {
    setQ("");
    setEstado("todos");
    setSoloCoseguro(false);
    setSoloColaterales(false);
    setPage(1);
  };

  const hasActiveFilters =
    q.trim() || estado !== "todos" || soloCoseguro || soloColaterales;

  // ===== Modales & acciones (baja / editar) =====
  type RowUi = ReturnType<typeof mapItem>;

  const [bajaOpen, setBajaOpen] = useState<{ open: boolean; row?: RowUi }>({
    open: false,
  });
  const [editOpen, setEditOpen] = useState<{ open: boolean; row?: RowUi }>({
    open: false,
  });

  const [bajaScope, setBajaScope] = useState<"uno" | "todos">("uno");
  const [bajaPadronId, setBajaPadronId] = useState<string | number | undefined>(
    undefined
  );
  const [bajaFecha, setBajaFecha] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [bajaMotivo, setBajaMotivo] = useState<string>("renuncia");

  const [editPadronId, setEditPadronId] = useState<string | number | undefined>(
    undefined
  );
  const [editData, setEditData] = useState<{
    situacion: string;
    sistema: string;
    centro: string;
    sector: string;
    clase: string;
  }>({
    situacion: "",
    sistema: "",
    centro: "",
    sector: "",
    clase: "",
  });

  const [busy, setBusy] = useState(false);

  const abrirBaja = (row: RowUi) => {
    setBajaScope("uno");
    setBajaPadronId(row.padrones[0]?.id);
    setBajaFecha(new Date().toISOString().slice(0, 10));
    setBajaMotivo("renuncia");
    setBajaOpen({ open: true, row });
  };

  const abrirEditar = (row: RowUi) => {
    setEditPadronId(row.padrones[0]?.id);
    setEditData({
      situacion: "",
      sistema: "",
      centro: "",
      sector: "",
      clase: "",
    });
    setEditOpen({ open: true, row });
  };

  const recargarListado = async () => {
    const resp = await api<AfiliadosPagedResp>(`/afiliados/paged?${params}`, {
      method: "GET",
    });
    setTotal(resp.total ?? 0);
    setRows((resp.items ?? []).map(mapItem));
  };

  const confirmarBaja = async () => {
    if (!bajaOpen.row) return;
    const ids =
      bajaScope === "todos"
        ? bajaOpen.row.padrones.map((p) => p.id)
        : bajaPadronId != null
        ? [bajaPadronId]
        : [];

    if (!ids.length) {
      setMsg("No hay padrones activos para dar de baja.");
      setBajaOpen({ open: false });
      return;
    }

    try {
      setBusy(true);
      // 1) Soft delete → dispara novedad J17=0 en backend
      // 2) Patch motivo/fecha para registrar causa y fecha exacta
      for (const id of ids) {
        await api(`/padrones/${id}`, { method: "DELETE" }); // soft + novedad J17 baja
        await api(`/padrones/${id}`, {
          method: "PATCH",
          body: JSON.stringify({
            fechaBaja: bajaFecha,
            motivoBaja: bajaMotivo,
          }),
        });
      }
      setMsg("SUCCESS:Baja realizada correctamente");
      setBajaOpen({ open: false });
      await recargarListado();
    } catch (e) {
      setMsg(`ERROR:${getErrorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const confirmarEditar = async () => {
    if (!editPadronId) {
      setMsg("Seleccioná un padrón a modificar.");
      return;
    }
    const body: any = {};
    if (editData.situacion.trim()) body.situacion = editData.situacion.trim();
    if (editData.clase.trim()) body.clase = editData.clase.trim();
    if (editData.centro.trim())
      body.centro = Number(editData.centro) || undefined;
    if (editData.sector.trim())
      body.sector = Number(editData.sector) || undefined;
    if (editData.sistema.trim()) body.sistema = editData.sistema as any; // 'ESC' | 'SG' | 'SGR' | 'JUV'

    try {
      setBusy(true);
      await api(`/padrones/${editPadronId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setMsg("SUCCESS:Padrón actualizado");
      setEditOpen({ open: false });
      await recargarListado();
    } catch (e) {
      setMsg(`ERROR:${getErrorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl">
      {/* Toolbar compacta: filtros + acción primaria en una sola línea */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[260px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
          <Input
            placeholder="Buscar por DNI, apellido, nombre o padrón..."
            aria-label="Buscar afiliados"
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
          aria-label="Filtro de estado"
          value={estado}
          onChange={(e) => {
            setEstado(e.target.value as any);
            setPage(1);
          }}
          className="h-9 rounded-lg border border-neutral-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-medical-500"
        >
          <option value="todos">Todos los estados</option>
          <option value="activos">Solo activos</option>
          <option value="baja">Solo bajas</option>
        </select>
        <label className="flex cursor-pointer items-center gap-1.5 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={soloCoseguro}
            onChange={(e) => {
              setSoloCoseguro(e.target.checked);
              setPage(1);
            }}
            className="rounded border-neutral-300 text-medical-600 focus:ring-medical-500"
          />
          Coseguro
        </label>
        <label className="flex cursor-pointer items-center gap-1.5 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={soloColaterales}
            onChange={(e) => {
              setSoloColaterales(e.target.checked);
              setPage(1);
            }}
            className="rounded border-neutral-300 text-medical-600 focus:ring-medical-500"
          />
          Colaterales
        </label>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            title="Limpiar todos los filtros"
            className="h-9 gap-1 text-neutral-600"
          >
            <Trash2 className="size-4" />
            Limpiar
          </Button>
        )}
        <div className="ml-auto">
          <Button asChild className="h-9 gap-2">
            <Link href="/padrones/nuevo">
              <UserPlus className="size-4" />
              Nuevo afiliado
            </Link>
          </Button>
        </div>
      </div>

      {msg && (
        <div
          className={`mb-4 flex items-center gap-3 rounded-lg border px-4 py-3 ${
            msg.startsWith("SUCCESS:")
              ? "border-medical-200 bg-medical-50 text-medical-800"
              : msg.startsWith("ERROR:")
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
          role="alert"
        >
          {msg.startsWith("SUCCESS:") ? (
            <Check className="size-5 shrink-0" />
          ) : msg.startsWith("ERROR:") ? (
            <XCircle className="size-5 shrink-0" />
          ) : (
            <AlertTriangle className="size-5 shrink-0" />
          )}
          <span className="text-sm font-medium">
            {msg.replace(/^(SUCCESS:|ERROR:)/, "")}
          </span>
        </div>
      )}

      <Card className="relative mb-4 overflow-hidden rounded-xl border-neutral-200">
        {/* Barra de progreso superior durante refetch (no bloquea la tabla) */}
        {loading && rows.length > 0 && (
          <div className="absolute inset-x-0 top-0 z-10 h-0.5 animate-pulse bg-medical-500" />
        )}
        {!loading && rows.length === 0 ? (
          <div className="flex w-full flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-4 text-4xl">{hasActiveFilters ? "🔍" : "👥"}</div>
            <h3 className="text-lg font-semibold text-neutral-900">
              {hasActiveFilters ? "Sin resultados" : "No hay afiliados registrados"}
            </h3>
            <p className="mt-1 w-full max-w-md text-sm text-neutral-600">
              {hasActiveFilters
                ? "No se encontraron afiliados que coincidan con los filtros aplicados"
                : "Comienza agregando el primer afiliado al sistema"}
            </p>
            {hasActiveFilters ? (
              <Button variant="outline" className="mt-4" onClick={handleClearFilters}>
                Limpiar filtros
              </Button>
            ) : (
              <Button asChild className="mt-4 gap-2">
                <Link href="/padrones/nuevo">
                  <UserPlus className="size-4" />
                  Agregar primer afiliado
                </Link>
              </Button>
            )}
          </div>
        ) : (
          <div
            className={`transition-opacity duration-200 ${
              loading && rows.length > 0 ? "opacity-60" : "opacity-100"
            }`}
            aria-busy={loading}
          >
            <Table>
              <TableHeader>
                <TableRow className="border-neutral-200 hover:bg-transparent">
                  <TableHead className="font-semibold text-neutral-700">Afiliado</TableHead>
                  <TableHead className="font-semibold text-neutral-700">DNI</TableHead>
                  <TableHead className="font-semibold text-neutral-700">Padrones</TableHead>
                  <TableHead className="font-semibold text-neutral-700">Estado</TableHead>
                  <TableHead className="text-center font-semibold text-neutral-700" title="Coseguro">Cos.</TableHead>
                  <TableHead className="text-center font-semibold text-neutral-700" title="Colaterales">Col.</TableHead>
                  <TableHead className="text-right font-semibold text-neutral-700">Deuda</TableHead>
                  <TableHead className="text-right font-semibold text-neutral-700">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && rows.length === 0 &&
                  Array.from({ length: Math.min(limit, 8) }).map((_, i) => (
                    <TableRow key={`sk-${i}`} className="border-neutral-100">
                      <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell className="text-center"><Skeleton className="mx-auto h-4 w-4" /></TableCell>
                      <TableCell className="text-center"><Skeleton className="mx-auto h-4 w-4" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-12" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="ml-auto h-7 w-24" /></TableCell>
                    </TableRow>
                  ))}
                {rows.map((r) => (
                  <TableRow key={String(r.id)} className="border-neutral-100">
                    <TableCell className="font-medium text-neutral-900">
                      {r.apellidoNombre}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-neutral-700">
                      {r.dni || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {r.padrones.length > 0 ? (
                          r.padrones.map((p) => (
                            <Badge key={String(p.id)} variant="outline" className="font-mono text-xs" title={p.vigente || ""}>
                              {p.nro}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-neutral-400">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.estado === "activo" ? "default" : "outline"} className="gap-1">
                        {r.estado === "activo" ? <Check className="size-3" /> : <XCircle className="size-3" />}
                        {r.estado === "activo" ? "Activo" : "Baja"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {r.coseguro ? (
                        <Check className="mx-auto size-4 text-medical-600" aria-label="Sí" />
                      ) : (
                        <span className="text-neutral-300">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {r.colaterales ? (
                        <Check className="mx-auto size-4 text-medical-600" aria-label="Sí" />
                      ) : (
                        <span className="text-neutral-300">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums text-neutral-700">
                      {r.deudaActual || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-0.5">
                        <Button asChild variant="ghost" size="icon" className="size-8" title="Ver detalle">
                          <Link href={`/afiliados/${r.id}`}>
                            <Eye className="size-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          title="Dar de baja"
                          onClick={() => abrirBaja(r)}
                          disabled={r.padrones.length === 0}
                        >
                          <UserMinus className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          title="Modificar padrón"
                          onClick={() => abrirEditar(r)}
                          disabled={r.padrones.length === 0}
                        >
                          <Pencil className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {rows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-2">
          <span className="text-sm text-neutral-600">
            {(page - 1) * limit + 1}-{Math.min(page * limit, total)} de {total}
          </span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Label htmlFor="limit-afiliados" className="text-sm text-neutral-600">
                Filas
              </Label>
              <select
                id="limit-afiliados"
                aria-label="Filas por página"
                value={String(limit)}
                onChange={(e) => onChangeLimit(Number(e.target.value))}
                className="h-8 rounded-lg border border-neutral-200 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-medical-500"
              >
                {[10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                onClick={() => setPage(1)}
                disabled={!canPrev}
                title="Primera página"
              >
                <ChevronsLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={!canPrev}
                title="Anterior"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="min-w-[3.5rem] text-center text-sm font-medium text-neutral-700">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={!canNext}
                title="Siguiente"
              >
                <ChevronRight className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                onClick={() => setPage(totalPages)}
                disabled={!canNext}
                title="Última página"
              >
                <ChevronsRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Modal Baja ===== */}
      {bajaOpen.open && bajaOpen.row && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => !busy && setBajaOpen({ open: false })}
        >
          <Card
            className="rounded-xl border-neutral-200 shadow-xl"
            style={{ width: "min(calc(100vw - 2rem), 32rem)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader className="flex flex-row items-start justify-between border-b border-neutral-100 pb-4">
              <div>
                <CardTitle className="text-lg">Dar de baja</CardTitle>
                <CardDescription className="mt-1">
                  {bajaOpen.row.apellidoNombre} — DNI {bajaOpen.row.dni || "—"}
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                onClick={() => !busy && setBajaOpen({ open: false })}
                aria-label="Cerrar"
              >
                <X className="size-4" />
              </Button>
            </CardHeader>
            <CardContent className="pt-4">

            {/* Warning moderno */}
            <div className="mb-3 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <div className="flex-1">
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    <li>
                      La baja de padrón genera novedad J17 = 0 (para el período
                      correspondiente).
                    </li>
                    {bajaOpen.row.coseguro && (
                      <li>
                        El afiliado tiene <b>coseguro</b>. Si el padrón elegido
                        es el de imputación, recordá tramitar la baja de
                        coseguro/colaterales.
                      </li>
                    )}
                    {bajaOpen.row.colaterales && (
                      <li>
                        El afiliado tiene <b>colaterales</b> asociados al
                        coseguro.
                      </li>
                    )}
                    {bajaScope === "todos" && (
                      <li>
                        Al dar de baja <b>todos los padrones</b> el afiliado
                        quedará en estado <b>“baja”</b>.
                      </li>
                    )}
                </ul>
              </div>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <div>
                <label
                  className="mb-1 block text-xs font-medium text-muted-foreground"
                >
                  Alcance
                </label>
                <div style={{ display: "flex", gap: 12 }}>
                  <label
                    className="inline-flex cursor-pointer items-center gap-1.5 text-sm"
                  >
                    <input
                      type="radio"
                      name="alcance-baja"
                      checked={bajaScope === "uno"}
                      onChange={() => setBajaScope("uno")}
                    />
                    <span>Solo un padrón</span>
                  </label>
                  <label
                    className="inline-flex cursor-pointer items-center gap-1.5 text-sm"
                  >
                    <input
                      type="radio"
                      name="alcance-baja"
                      checked={bajaScope === "todos"}
                      onChange={() => setBajaScope("todos")}
                    />
                    <span>
                      Todos los padrones activos ({bajaOpen.row.padrones.length}
                      )
                    </span>
                  </label>
                </div>
              </div>

              {bajaScope === "uno" && (
                <div>
                  <label
                    className="mb-1 block text-xs font-medium text-muted-foreground"
                  >
                    Padrón
                  </label>
                  <select
                    className="h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-medical-500"
                    value={String(bajaPadronId ?? "")}
                    onChange={(e) => setBajaPadronId(e.target.value)}
                  >
                    {bajaOpen.row.padrones.map((p) => (
                      <option key={String(p.id)} value={String(p.id)}>
                        {p.nro}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {bajaScope === "todos" && (
                <div className="flex flex-wrap gap-1.5">
                  {bajaOpen.row.padrones.map((p) => (
                    <Badge
                      key={String(p.id)}
                      variant="outline"
                      className="border-medical-200 bg-medical-50 px-1.5 py-0 text-[11px] font-medium text-medical-700"
                      title="Se dará de baja"
                    >
                      {p.nro}
                    </Badge>
                  ))}
                </div>
              )}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                <div>
                  <label
                    className="mb-1 block text-xs font-medium text-muted-foreground"
                  >
                    Fecha de baja
                  </label>
                  <InputFecha
                    value={bajaFecha}
                    onChange={(iso) => setBajaFecha(iso)}
                    placeholder="dd/mm/aaaa"
                    className="h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-medical-500"
                  />
                </div>
                <div>
                  <label
                    className="mb-1 block text-xs font-medium text-muted-foreground"
                  >
                    Motivo
                  </label>
                  <select
                    value={bajaMotivo}
                    onChange={(e) => setBajaMotivo(e.target.value)}
                    className="h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-medical-500"
                  >
                    <option value="renuncia">Renuncia</option>
                    <option value="jubilacion">Jubilación</option>
                    <option value="fallecimiento">Fallecimiento</option>
                    <option value="cambio_padron">Cambio de padrón</option>
                    <option value="otros">Otros</option>
                  </select>
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 16,
              }}
            >
              <div style={{ fontSize: 12, color: "#777" }}>
                Se registrará J17=0 y se guardará motivo/fecha en cada padrón
                afectado.
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setBajaOpen({ open: false })} disabled={busy}>
                  Cancelar
                </Button>
                <Button onClick={() => void confirmarBaja()} disabled={busy}>
                  {busy ? "Procesando..." : "Confirmar baja"}
                </Button>
              </div>
            </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal Editar Padrón */}
      {editOpen.open && editOpen.row && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => !busy && setEditOpen({ open: false })}
        >
          <Card
            className="rounded-xl border-neutral-200 shadow-xl"
            style={{ width: "min(calc(100vw - 2rem), 32rem)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader className="flex flex-row items-start justify-between border-b border-neutral-100 pb-4">
              <div>
                <CardTitle className="text-lg">Modificar padrón</CardTitle>
                <CardDescription className="mt-1">
                  {editOpen.row.apellidoNombre} — DNI {editOpen.row.dni || "—"}
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                onClick={() => !busy && setEditOpen({ open: false })}
                aria-label="Cerrar"
              >
                <X className="size-4" />
              </Button>
            </CardHeader>
            <CardContent className="pt-4">

            {/* Warning moderno */}
            <div className="mb-3 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <div className="flex-1">
                Modificar <b>sistema/centro/sector/clase</b> puede impactar en
                la generación de novedades (canales J22/J38 por imputación).
                Revisá el período en curso.
              </div>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <div>
                <label
                  className="mb-1 block text-xs font-medium text-muted-foreground"
                >
                  Padrón
                </label>
                <select
                  className="h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-medical-500"
                  value={String(editPadronId ?? "")}
                  onChange={(e) => setEditPadronId(e.target.value)}
                >
                  {editOpen.row.padrones.map((p) => (
                    <option key={String(p.id)} value={String(p.id)}>
                      {p.nro}
                    </option>
                  ))}
                </select>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                <div>
                  <label
                    className="mb-1 block text-xs font-medium text-muted-foreground"
                  >
                    Situación
                  </label>
                  <input
                    className="h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-medical-500"
                    placeholder="TITULAR / SUPLENTE / ..."
                    value={editData.situacion}
                    onChange={(e) =>
                      setEditData((d) => ({ ...d, situacion: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label
                    className="mb-1 block text-xs font-medium text-muted-foreground"
                  >
                    Sistema
                  </label>
                  <select
                    className="h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-medical-500"
                    value={editData.sistema}
                    onChange={(e) =>
                      setEditData((d) => ({ ...d, sistema: e.target.value }))
                    }
                  >
                    <option value="">—</option>
                    <option value="ESC">ESC</option>
                    <option value="SG">SG</option>
                    <option value="SGR">SGR</option>
                    <option value="JUV">JUV</option>
                  </select>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 12,
                }}
              >
                <div>
                  <label
                    className="mb-1 block text-xs font-medium text-muted-foreground"
                  >
                    Centro
                  </label>
                  <input
                    className="h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-medical-500"
                    inputMode="numeric"
                    placeholder="número"
                    value={editData.centro}
                    onChange={(e) =>
                      setEditData((d) => ({ ...d, centro: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label
                    className="mb-1 block text-xs font-medium text-muted-foreground"
                  >
                    Sector
                  </label>
                  <input
                    className="h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-medical-500"
                    inputMode="numeric"
                    placeholder="número"
                    value={editData.sector}
                    onChange={(e) =>
                      setEditData((d) => ({ ...d, sector: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label
                    className="mb-1 block text-xs font-medium text-muted-foreground"
                  >
                    Clase
                  </label>
                  <input
                    className="h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-medical-500"
                    placeholder="texto"
                    value={editData.clase}
                    onChange={(e) =>
                      setEditData((d) => ({ ...d, clase: e.target.value }))
                    }
                  />
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 16,
              }}
            >
              <div style={{ fontSize: 12, color: "#777" }}>
                Guardá los cambios para impactar en el padrón seleccionado.
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditOpen({ open: false })} disabled={busy}>
                  Cancelar
                </Button>
                <Button onClick={() => void confirmarEditar()} disabled={busy}>
                  {busy ? "Guardando..." : "Guardar cambios"}
                </Button>
              </div>
            </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
