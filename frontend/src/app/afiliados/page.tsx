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
import { PageHeader } from "@/components/ui-kit";
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
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Listado de Afiliados"
        subtitle="Gestión y consulta de afiliados del sistema"
      >
        <Button asChild className="gap-2">
          <Link href="/padrones/nuevo">
            <UserPlus className="size-4" />
            Nuevo Afiliado
          </Link>
        </Button>
      </PageHeader>

      {msg && (
        <div
          className={`mb-6 flex items-center gap-3 rounded-lg border px-4 py-3 ${
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

      <Card className="mb-6 rounded-xl border-neutral-200">
        <CardHeader className="border-b border-neutral-100 pb-4">
          <CardTitle className="text-base">Filtros y búsqueda</CardTitle>
          <CardDescription>Refiná el listado por estado, coseguro o colaterales</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="relative min-w-[280px] flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
              <Input
                placeholder="Buscar por DNI, apellido, nombre o padrón (ej: 642574-1)..."
                aria-label="Buscar afiliados"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                className="pl-9 rounded-lg border-neutral-200"
              />
              {q && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 size-8"
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
            <div className="flex flex-wrap items-center gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-neutral-600">Estado</Label>
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
                  <option value="baja">Solo dados de baja</option>
                </select>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={soloCoseguro}
                  onChange={(e) => {
                    setSoloCoseguro(e.target.checked);
                    setPage(1);
                  }}
                  className="rounded border-neutral-300 text-medical-600 focus:ring-medical-500"
                />
                Con coseguro
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={soloColaterales}
                  onChange={(e) => {
                    setSoloColaterales(e.target.checked);
                    setPage(1);
                  }}
                  className="rounded border-neutral-300 text-medical-600 focus:ring-medical-500"
                />
                Con colaterales
              </label>
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearFilters}
                  title="Limpiar todos los filtros"
                  className="gap-1"
                >
                  <Trash2 className="size-4" />
                  Limpiar filtros
                </Button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-3">
            {loading ? (
              <span className="flex items-center gap-2 text-sm text-neutral-500">
                <span className="size-4 animate-spin rounded-full border-2 border-neutral-300 border-t-medical-500" />
                Cargando...
              </span>
            ) : (
              <span className="text-sm text-neutral-600">
                {total === 0
                  ? "0 resultados"
                  : `${(page - 1) * limit + 1}-${Math.min(page * limit, total)} de ${total}`}
              </span>
            )}
            <div className="flex items-center gap-2">
              <Label htmlFor="limit-afiliados" className="text-sm text-neutral-600">
                Filas por página
              </Label>
              <select
                id="limit-afiliados"
                aria-label="Filas por página"
                value={String(limit)}
                onChange={(e) => onChangeLimit(Number(e.target.value))}
                className="h-9 rounded-lg border border-neutral-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-medical-500"
              >
                {[10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n} por página
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6 overflow-hidden rounded-xl border-neutral-200">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <span className="size-8 animate-spin rounded-full border-2 border-neutral-300 border-t-medical-500" />
            <p className="mt-3 text-sm text-neutral-500">Cargando afiliados...</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 text-4xl">{hasActiveFilters ? "🔍" : "👥"}</div>
            <h3 className="text-lg font-semibold text-neutral-900">
              {hasActiveFilters ? "Sin resultados" : "No hay afiliados registrados"}
            </h3>
            <p className="mt-1 max-w-sm text-sm text-neutral-600">
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
          <>
            <Table>
              <TableHeader>
                <TableRow className="border-neutral-200 hover:bg-transparent">
                  <TableHead className="font-semibold text-neutral-700">Afiliado</TableHead>
                  <TableHead className="font-semibold text-neutral-700">DNI</TableHead>
                  <TableHead className="font-semibold text-neutral-700">Estado</TableHead>
                  <TableHead className="font-semibold text-neutral-700">Padrones</TableHead>
                  <TableHead className="text-center font-semibold text-neutral-700">Coseguro</TableHead>
                  <TableHead className="text-center font-semibold text-neutral-700">Colaterales</TableHead>
                  <TableHead className="text-right font-semibold text-neutral-700">Deuda</TableHead>
                  <TableHead className="text-right font-semibold text-neutral-700">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={String(r.id)} className="border-neutral-100">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600">
                          <Eye className="size-4" />
                        </div>
                        <span className="font-medium text-neutral-900">{r.apellidoNombre}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono">
                        {r.dni || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.estado === "activo" ? "default" : "outline"} className="gap-1">
                        {r.estado === "activo" ? <Check className="size-3" /> : <XCircle className="size-3" />}
                        {r.estado === "activo" ? "Activo" : "Baja"}
                      </Badge>
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
                          <span className="text-sm text-neutral-500">Sin padrones</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={r.coseguro ? "default" : "secondary"}>
                        {r.coseguro ? "Sí" : "No"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={r.colaterales ? "default" : "secondary"}>
                        {r.colaterales ? "Sí" : "No"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums text-neutral-700">
                      {r.deudaActual || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button asChild variant="outline" size="sm" className="gap-1">
                          <Link href={`/afiliados/${r.id}`}>
                            <Eye className="size-3.5" />
                            Ver
                          </Link>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          title="Dar de baja"
                          onClick={() => abrirBaja(r)}
                          disabled={r.padrones.length === 0}
                          className="gap-1"
                        >
                          <UserMinus className="size-3.5" />
                          Baja
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          title="Modificar padrón"
                          onClick={() => abrirEditar(r)}
                          disabled={r.padrones.length === 0}
                          className="gap-1"
                        >
                          <Pencil className="size-3.5" />
                          Modificar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </Card>

      {!loading && rows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-neutral-200 bg-white px-4 py-3">
          <span className="text-sm text-neutral-600">
            Página {page} de {totalPages} · {total} resultados
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-9"
              onClick={() => setPage(1)}
              disabled={!canPrev}
              title="Primera página"
            >
              <ChevronsLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-9"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={!canPrev}
              title="Anterior"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-[4rem] text-center text-sm font-medium text-neutral-700">
              {page}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="size-9"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={!canNext}
              title="Siguiente"
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-9"
              onClick={() => setPage(totalPages)}
              disabled={!canNext}
              title="Última página"
            >
              <ChevronsRight className="size-4" />
            </Button>
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
            className="w-full max-w-lg rounded-xl border-neutral-200 shadow-xl"
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
            <div className="alert alert-warning" style={{ marginBottom: 12 }}>
              <div className="alert-content">
                <div className="alert-icon">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <circle cx="12" cy="16" r="1" />
                  </svg>
                </div>
                <div className="alert-text">
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
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <div>
                <label
                  className="filter-label"
                  style={{ display: "block", fontSize: 12, color: "#666" }}
                >
                  Alcance
                </label>
                <div style={{ display: "flex", gap: 12 }}>
                  <label
                    className="checkbox-label"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
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
                    className="checkbox-label"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
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
                    className="filter-label"
                    style={{ display: "block", fontSize: 12, color: "#666" }}
                  >
                    Padrón
                  </label>
                  <select
                    className="filter-select"
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
                <div
                  className="padrones-container"
                  style={{ display: "flex", gap: 6, flexWrap: "wrap" }}
                >
                  {bajaOpen.row.padrones.map((p) => (
                    <span
                      key={String(p.id)}
                      className="padron-chip"
                      title="Se dará de baja"
                    >
                      {p.nro}
                    </span>
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
                    className="filter-label"
                    style={{ display: "block", fontSize: 12, color: "#666" }}
                  >
                    Fecha de baja
                  </label>
                  <InputFecha
                    value={bajaFecha}
                    onChange={(iso) => setBajaFecha(iso)}
                    placeholder="dd/mm/aaaa"
                    className="filter-select"
                  />
                </div>
                <div>
                  <label
                    className="filter-label"
                    style={{ display: "block", fontSize: 12, color: "#666" }}
                  >
                    Motivo
                  </label>
                  <select
                    value={bajaMotivo}
                    onChange={(e) => setBajaMotivo(e.target.value)}
                    className="filter-select"
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
            className="w-full max-w-lg rounded-xl border-neutral-200 shadow-xl"
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
            <div className="alert alert-warning" style={{ marginBottom: 12 }}>
              <div className="alert-content">
                <div className="alert-icon">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <circle cx="12" cy="16" r="1" />
                  </svg>
                </div>
                <div className="alert-text">
                  Modificar <b>sistema/centro/sector/clase</b> puede impactar en
                  la generación de novedades (canales J22/J38 por imputación).
                  Revisá el período en curso.
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <div>
                <label
                  className="filter-label"
                  style={{ display: "block", fontSize: 12, color: "#666" }}
                >
                  Padrón
                </label>
                <select
                  className="filter-select"
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
                    className="filter-label"
                    style={{ display: "block", fontSize: 12, color: "#666" }}
                  >
                    Situación
                  </label>
                  <input
                    className="filter-select"
                    placeholder="TITULAR / SUPLENTE / ..."
                    value={editData.situacion}
                    onChange={(e) =>
                      setEditData((d) => ({ ...d, situacion: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label
                    className="filter-label"
                    style={{ display: "block", fontSize: 12, color: "#666" }}
                  >
                    Sistema
                  </label>
                  <select
                    className="filter-select"
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
                    className="filter-label"
                    style={{ display: "block", fontSize: 12, color: "#666" }}
                  >
                    Centro
                  </label>
                  <input
                    className="filter-select"
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
                    className="filter-label"
                    style={{ display: "block", fontSize: 12, color: "#666" }}
                  >
                    Sector
                  </label>
                  <input
                    className="filter-select"
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
                    className="filter-label"
                    style={{ display: "block", fontSize: 12, color: "#666" }}
                  >
                    Clase
                  </label>
                  <input
                    className="filter-select"
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
