"use client";

import { useEffect, useMemo, useState } from "react";
import { api, getErrorMessage } from "@/servicios/api";
import { formatearFechaArgentina } from "@/utiles/formatos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  X,
  Pencil,
  UserMinus,
  UserCheck,
  Trash2,
  Check,
  XCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

type AfiliadoSuggest = {
  id: string;
  dni: string;
  display: string;
};

type Parentesco = { id: string | number; codigo?: number | null; nombre: string };

type AfiliadoLite = {
  id: string | number;
  dni: string | number | null;
  apellido: string | null;
  nombre: string | null;
  estado?: string;
};

type Colateral = {
  id: string | number;
  afiliadoId: string | number;
  parentescoId?: string | number | null;
  parentescoNombre?: string | null;
  parentesco?: {
    id?: string | number;
    codigo?: number | null;
    descripcion?: string | null;
  };
  afiliado?: AfiliadoLite;
  nombre: string;
  dni?: string | null;
  fechaNacimiento?: string | null;
  activo: boolean;
  esColateral?: boolean;
};

type PagedResp = {
  items: Colateral[];
  total: number;
  page: number;
  limit: number;
};

function useDebounced<T>(value: T, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const h = setTimeout(() => setV(value), ms);
    return () => clearTimeout(h);
  }, [value, ms]);
  return v;
}

const formatFecha = (v?: string | null) => {
  if (!v) return "—";
  return formatearFechaArgentina(v) || v;
};

const fechaParaInput = (v?: string | null | Date): string => {
  if (!v) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) {
      const [d, m, y] = v.split("/");
      return `${y}-${m}-${d}`;
    }
    try {
      const d = new Date(v);
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    } catch {
      /* ignore */
    }
  }
  return "";
};

const formatDni = (dni: string | number | null | undefined) => {
  if (dni == null) return "";
  const s = String(dni).replace(/\D+/g, "");
  if (!s) return "";
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

const titularLabel = (a?: AfiliadoLite | null) => {
  if (!a) return "—";
  const ap = (a.apellido ?? "").trim();
  const no = (a.nombre ?? "").trim();
  if (ap && no) return `${ap}, ${no}`;
  return ap || no || "(sin nombre)";
};

export default function AfiliadosFamiliaresPage() {
  // Filtros
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 350);
  const [estado, setEstado] = useState<"todos" | "activos" | "baja">("todos");
  const [j38, setJ38] = useState<"todos" | "true" | "false">("todos");

  // Paginación
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  // Datos
  const [rows, setRows] = useState<Colateral[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [parentescos, setParentescos] = useState<Parentesco[]>([]);

  // Modal edit
  const [editColat, setEditColat] = useState<{
    open: boolean;
    row?: Partial<Colateral>;
    isNew?: boolean;
    afiliado?: AfiliadoSuggest | AfiliadoLite | null;
  }>({ open: false });

  // Modal "agregar" requiere primero elegir afiliado
  const [addStep, setAddStep] = useState<"pickAfiliado" | "form">("pickAfiliado");
  const [pickQ, setPickQ] = useState("");
  const pickDq = useDebounced(pickQ, 250);
  const [pickResults, setPickResults] = useState<AfiliadoSuggest[]>([]);
  const [pickBuscando, setPickBuscando] = useState(false);

  // Cargar parentescos
  useEffect(() => {
    let active = true;
    api<Parentesco[]>(`/colaterales/parentescos`, { method: "GET" })
      .then((r) => active && setParentescos(r ?? []))
      .catch(() => {
        /* ignore */
      });
    return () => {
      active = false;
    };
  }, []);

  // Fetch paginado
  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (dq.trim()) p.set("q", dq.trim());
    if (estado !== "todos") p.set("estado", estado);
    if (j38 !== "todos") p.set("esColateral", j38);
    p.set("page", String(page));
    p.set("limit", String(limit));
    return p.toString();
  }, [dq, estado, j38, page, limit]);

  const recargar = async () => {
    try {
      setLoading(true);
      const resp = await api<PagedResp>(`/colaterales/paged?${params}`, {
        method: "GET",
      });
      setRows(resp.items ?? []);
      setTotal(resp.total ?? 0);
    } catch (e) {
      setRows([]);
      setTotal(0);
      setMsg(`ERROR:${getErrorMessage(e)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const resp = await api<PagedResp>(`/colaterales/paged?${params}`, {
          method: "GET",
        });
        if (cancelled) return;
        setRows(resp.items ?? []);
        setTotal(resp.total ?? 0);
      } catch (e) {
        if (!cancelled) {
          setRows([]);
          setTotal(0);
          setMsg(`ERROR:${getErrorMessage(e)}`);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params]);

  // Picker afiliado
  useEffect(() => {
    if (pickDq.trim().length < 2) {
      setPickResults([]);
      return;
    }
    setPickBuscando(true);
    api<AfiliadoSuggest[]>(
      `/afiliados/suggest?q=${encodeURIComponent(pickDq)}`,
      { method: "GET" },
    )
      .then((r) => setPickResults(r ?? []))
      .finally(() => setPickBuscando(false));
  }, [pickDq]);

  const parentescoNombre = (c: Colateral) => {
    if (c.parentescoNombre) return c.parentescoNombre;
    if (c.parentesco?.descripcion) return c.parentesco.descripcion;
    const cat = parentescos.find(
      (p) => String(p.id) === String(c.parentescoId ?? c.parentesco?.id),
    );
    return cat?.nombre ?? c.parentesco?.codigo ?? c.parentescoId ?? "—";
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const canPrev = page > 1 && !loading;
  const canNext = page < totalPages && !loading;

  const onChangeLimit = (val: number) => {
    setLimit(val);
    setPage(1);
  };

  const hasActiveFilters =
    q.trim() !== "" || estado !== "todos" || j38 !== "todos";

  const handleClearFilters = () => {
    setQ("");
    setEstado("todos");
    setJ38("todos");
    setPage(1);
  };

  // === Acciones ===
  const abrirAgregar = () => {
    setAddStep("pickAfiliado");
    setPickQ("");
    setPickResults([]);
    setEditColat({
      open: true,
      isNew: true,
      afiliado: null,
      row: {
        parentescoId: parentescos[0]?.id ?? "",
        nombre: "",
        dni: "",
        fechaNacimiento: "",
        activo: true,
        esColateral: true,
      },
    });
  };

  const abrirEditar = (row: Colateral) => {
    setEditColat({
      open: true,
      isNew: false,
      afiliado: row.afiliado ?? null,
      row: {
        ...row,
        parentescoId: row.parentescoId ?? row.parentesco?.id ?? "",
        fechaNacimiento: fechaParaInput(row.fechaNacimiento),
      },
    });
  };

  const cerrarModal = () => setEditColat({ open: false });

  const guardar = async () => {
    const r = editColat.row ?? {};
    const af = editColat.afiliado;
    if (!af?.id) {
      setMsg("ERROR:Seleccioná un titular.");
      return;
    }
    if (!r.nombre?.toString().trim()) {
      setMsg("ERROR:El nombre es obligatorio.");
      return;
    }
    if (!r.parentescoId) {
      setMsg("ERROR:Seleccioná un parentesco.");
      return;
    }

    try {
      setBusy(true);
      const payload = {
        parentescoId: Number(r.parentescoId),
        nombre: r.nombre.toString().trim(),
        dni: (r.dni ?? "").toString().trim(),
        fechaNacimiento: r.fechaNacimiento || undefined,
        activo: r.activo ?? true,
        esColateral: r.esColateral ?? true,
      };

      if (editColat.isNew) {
        await api(`/colaterales/afiliados/${af.id}/colaterales`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setMsg("SUCCESS:Familiar agregado");
      } else if (r.id != null) {
        await api(`/colaterales/afiliados/${af.id}/colaterales/${r.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setMsg("SUCCESS:Familiar actualizado");
      }

      cerrarModal();
      await recargar();
    } catch (e) {
      setMsg(`ERROR:${getErrorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const darDeBaja = async (row: Colateral) => {
    if (!confirm(`¿Dar de baja a ${row.nombre} del grupo familiar?`)) return;
    try {
      setBusy(true);
      await api(`/colaterales/afiliados/${row.afiliadoId}/colaterales/${row.id}`, {
        method: "PATCH",
        body: JSON.stringify({ activo: false }),
      });
      setMsg("SUCCESS:Familiar dado de baja");
      await recargar();
    } catch (e) {
      setMsg(`ERROR:${getErrorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const reactivar = async (row: Colateral) => {
    if (!confirm(`¿Reactivar a ${row.nombre} en el grupo familiar?`)) return;
    try {
      setBusy(true);
      await api(`/colaterales/afiliados/${row.afiliadoId}/colaterales/${row.id}`, {
        method: "PATCH",
        body: JSON.stringify({ activo: true }),
      });
      setMsg("SUCCESS:Familiar reactivado");
      await recargar();
    } catch (e) {
      setMsg(`ERROR:${getErrorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const eliminar = async (row: Colateral) => {
    if (
      !confirm(
        "¿Eliminar permanentemente este familiar? Esta acción no se puede deshacer.",
      )
    )
      return;
    try {
      setBusy(true);
      await api(`/colaterales/afiliados/${row.afiliadoId}/colaterales/${row.id}`, {
        method: "DELETE",
      });
      setMsg("SUCCESS:Familiar eliminado");
      await recargar();
    } catch (e) {
      setMsg(`ERROR:${getErrorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl">
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

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[280px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
          <Input
            placeholder="Buscar por familiar o titular (DNI, nombre, padrón)..."
            aria-label="Buscar familiares"
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
            setEstado(e.target.value as "todos" | "activos" | "baja");
            setPage(1);
          }}
          className="h-9 rounded-lg border border-neutral-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-medical-500"
        >
          <option value="todos">Todos los estados</option>
          <option value="activos">Solo activos</option>
          <option value="baja">Solo bajas</option>
        </select>
        <select
          aria-label="Filtro J38"
          value={j38}
          onChange={(e) => {
            setJ38(e.target.value as "todos" | "true" | "false");
            setPage(1);
          }}
          className="h-9 rounded-lg border border-neutral-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-medical-500"
          title="Participa en J38"
        >
          <option value="todos">J38: todos</option>
          <option value="true">J38: sí</option>
          <option value="false">J38: no</option>
        </select>
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
          <Button className="h-9 gap-2" onClick={abrirAgregar} disabled={busy}>
            <UserPlus className="size-4" />
            Agregar familiar
          </Button>
        </div>
      </div>

      {/* Tabla */}
      <Card className="relative mb-4 overflow-hidden rounded-xl border-neutral-200">
        {loading && rows.length > 0 && (
          <div className="absolute inset-x-0 top-0 z-10 h-0.5 animate-pulse bg-medical-500" />
        )}
        {!loading && rows.length === 0 ? (
          <div className="flex w-full flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-4 text-4xl">{hasActiveFilters ? "🔍" : "👪"}</div>
            <h3 className="text-lg font-semibold text-neutral-900">
              {hasActiveFilters ? "Sin resultados" : "No hay familiares cargados"}
            </h3>
            <p className="mt-1 w-full max-w-md text-sm text-neutral-600">
              {hasActiveFilters
                ? "No se encontraron familiares que coincidan con los filtros aplicados"
                : "Empezá agregando el primer familiar al sistema"}
            </p>
            {hasActiveFilters ? (
              <Button variant="outline" className="mt-4" onClick={handleClearFilters}>
                Limpiar filtros
              </Button>
            ) : (
              <Button className="mt-4 gap-2" onClick={abrirAgregar} disabled={busy}>
                <UserPlus className="size-4" />
                Agregar primer familiar
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
                  <TableHead className="font-semibold text-neutral-700">Titular</TableHead>
                  <TableHead className="font-semibold text-neutral-700">Parentesco</TableHead>
                  <TableHead className="font-semibold text-neutral-700">Familiar</TableHead>
                  <TableHead className="font-semibold text-neutral-700">DNI</TableHead>
                  <TableHead className="font-semibold text-neutral-700">Fecha nac.</TableHead>
                  <TableHead className="text-center font-semibold text-neutral-700" title="Participa en J38">J38</TableHead>
                  <TableHead className="text-center font-semibold text-neutral-700">Estado</TableHead>
                  <TableHead className="text-right font-semibold text-neutral-700">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && rows.length === 0 &&
                  Array.from({ length: Math.min(limit, 8) }).map((_, i) => (
                    <TableRow key={`sk-${i}`} className="border-neutral-100">
                      <TableCell><Skeleton className="h-4 w-44" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell className="text-center"><Skeleton className="mx-auto h-4 w-4" /></TableCell>
                      <TableCell className="text-center"><Skeleton className="mx-auto h-5 w-14" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="ml-auto h-7 w-24" /></TableCell>
                    </TableRow>
                  ))}
                {rows.map((c) => {
                  const participaJ38 = c.esColateral ?? true;
                  return (
                    <TableRow key={String(c.id)} className="border-neutral-100">
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-neutral-900">
                            {titularLabel(c.afiliado)}
                          </span>
                          <span className="font-mono text-xs text-neutral-500">
                            DNI {formatDni(c.afiliado?.dni) || "—"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-neutral-700">{parentescoNombre(c)}</TableCell>
                      <TableCell className="font-medium text-neutral-900">{c.nombre}</TableCell>
                      <TableCell className="font-mono text-sm text-neutral-700">
                        {(c.dni ?? "").toString() || "—"}
                      </TableCell>
                      <TableCell className="text-neutral-700">{formatFecha(c.fechaNacimiento)}</TableCell>
                      <TableCell className="text-center">
                        {participaJ38 ? (
                          <Check className="mx-auto size-4 text-medical-600" aria-label="Sí" />
                        ) : (
                          <span className="text-neutral-300">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={c.activo ? "default" : "outline"} className="gap-1">
                          {c.activo ? <Check className="size-3" /> : <XCircle className="size-3" />}
                          {c.activo ? "Activo" : "Baja"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            title="Editar"
                            onClick={() => abrirEditar(c)}
                            disabled={busy}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          {c.activo ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              title="Dar de baja"
                              onClick={() => void darDeBaja(c)}
                              disabled={busy}
                            >
                              <UserMinus className="size-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              title="Reactivar"
                              onClick={() => void reactivar(c)}
                              disabled={busy}
                            >
                              <UserCheck className="size-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-red-600 hover:bg-red-50 hover:text-red-700"
                            title="Eliminar"
                            onClick={() => void eliminar(c)}
                            disabled={busy}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Paginación */}
      {rows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-2">
          <span className="text-sm text-neutral-600">
            {(page - 1) * limit + 1}-{Math.min(page * limit, total)} de {total}
          </span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Label htmlFor="limit-fam" className="text-sm text-neutral-600">
                Filas
              </Label>
              <select
                id="limit-fam"
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

      {/* Modal edit / agregar */}
      <Dialog
        open={editColat.open}
        onOpenChange={(open) => {
          if (!open && !busy) cerrarModal();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editColat.isNew ? "Agregar familiar" : "Editar familiar"}
            </DialogTitle>
            {editColat.afiliado && (
              <DialogDescription>
                Titular: {titularLabel(editColat.afiliado)} · DNI{" "}
                {formatDni(editColat.afiliado.dni) || "—"}
              </DialogDescription>
            )}
          </DialogHeader>
          <div>
              {/* Paso 1: elegir afiliado (solo cuando es nuevo y no hay afiliado) */}
              {editColat.isNew && addStep === "pickAfiliado" && !editColat.afiliado ? (
                <div className="space-y-3">
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    Seleccioná primero al titular del grupo familiar.
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                    <Input
                      autoFocus
                      placeholder="Buscar afiliado por DNI, nombre o padrón..."
                      value={pickQ}
                      onChange={(e) => setPickQ(e.target.value)}
                      className="h-9 rounded-lg border-neutral-200 pl-9"
                    />
                  </div>
                  <div className="max-h-64 overflow-y-auto rounded-lg border border-neutral-200">
                    {pickBuscando ? (
                      <div className="space-y-2 p-3">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <div key={i} className="flex items-center gap-3">
                            <Skeleton className="h-4 w-48" />
                            <Skeleton className="h-4 w-24" />
                          </div>
                        ))}
                      </div>
                    ) : pickResults.length === 0 ? (
                      <div className="p-4 text-center text-sm text-neutral-500">
                        {pickDq.trim().length < 2
                          ? "Escribí al menos 2 caracteres"
                          : "Sin resultados"}
                      </div>
                    ) : (
                      <ul className="divide-y divide-neutral-100">
                        {pickResults.map((s) => (
                          <li key={s.id}>
                            <button
                              type="button"
                              className="flex w-full items-center justify-between gap-4 px-3 py-2 text-left text-sm transition-colors hover:bg-neutral-50"
                              onClick={() => {
                                setEditColat((st) => ({ ...st, afiliado: s }));
                                setAddStep("form");
                              }}
                            >
                              <span className="font-medium text-neutral-900">{s.display}</span>
                              <span className="font-mono text-xs text-neutral-500">DNI {s.dni}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="flex justify-end">
                    <Button variant="outline" onClick={cerrarModal} disabled={busy}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    <span>
                      Marcá <b>Participa en J38</b> si este integrante es colateral
                      del coseguro. Podés desmarcarlo para mantenerlo en el grupo
                      familiar sin impactar el J38.
                    </span>
                  </div>

                  <div className="grid gap-3">
                    <div>
                      <Label className="text-xs font-medium text-neutral-600">Parentesco</Label>
                      <select
                        className="mt-1 h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-medical-500"
                        value={String(editColat.row?.parentescoId ?? "")}
                        onChange={(e) =>
                          setEditColat((s) => ({
                            ...s,
                            row: { ...s.row, parentescoId: e.target.value },
                          }))
                        }
                      >
                        {parentescos.map((p) => (
                          <option key={String(p.id)} value={String(p.id)}>
                            {p.nombre}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <Label className="text-xs font-medium text-neutral-600">Nombre</Label>
                      <Input
                        className="mt-1"
                        placeholder="Nombre completo"
                        value={String(editColat.row?.nombre ?? "")}
                        onChange={(e) =>
                          setEditColat((s) => ({
                            ...s,
                            row: { ...s.row, nombre: e.target.value },
                          }))
                        }
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs font-medium text-neutral-600">DNI</Label>
                        <Input
                          className="mt-1"
                          placeholder="DNI (opcional)"
                          value={String(editColat.row?.dni ?? "")}
                          onChange={(e) =>
                            setEditColat((s) => ({
                              ...s,
                              row: { ...s.row, dni: e.target.value },
                            }))
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-medium text-neutral-600">Fecha nac.</Label>
                        <Input
                          className="mt-1"
                          type="date"
                          value={String(editColat.row?.fechaNacimiento ?? "")}
                          onChange={(e) =>
                            setEditColat((s) => ({
                              ...s,
                              row: { ...s.row, fechaNacimiento: e.target.value },
                            }))
                          }
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-4 pt-1">
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={Boolean(editColat.row?.esColateral ?? true)}
                          onChange={(e) =>
                            setEditColat((s) => ({
                              ...s,
                              row: { ...s.row, esColateral: e.target.checked },
                            }))
                          }
                          className="rounded border-neutral-300 text-medical-600 focus:ring-medical-500"
                        />
                        Participa en J38
                      </label>
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={Boolean(editColat.row?.activo ?? true)}
                          onChange={(e) =>
                            setEditColat((s) => ({
                              ...s,
                              row: { ...s.row, activo: e.target.checked },
                            }))
                          }
                          className="rounded border-neutral-300 text-medical-600 focus:ring-medical-500"
                        />
                        Activo
                      </label>
                    </div>
                  </div>

                  <div className="mt-5 flex justify-end gap-2">
                    {editColat.isNew && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setAddStep("pickAfiliado");
                          setEditColat((s) => ({ ...s, afiliado: null }));
                          setPickQ("");
                          setPickResults([]);
                        }}
                        disabled={busy}
                      >
                        Cambiar titular
                      </Button>
                    )}
                    <Button variant="outline" onClick={cerrarModal} disabled={busy}>
                      Cancelar
                    </Button>
                    <Button onClick={() => void guardar()} disabled={busy}>
                      {busy ? "Guardando..." : "Guardar"}
                    </Button>
                  </div>
                </>
              )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
