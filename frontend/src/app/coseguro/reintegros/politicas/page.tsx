"use client";

import { useEffect, useMemo, useState } from "react";
import { api, getErrorMessage } from "@/servicios/api";

import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Plus, Pencil, RefreshCcw, Power, X, Trash2 } from "lucide-react";

type Politica = {
  id: string;
  vigenteDesde: string;
  vigenteHasta?: string | null;
  activo: boolean;
  topeMensual?: string | null;
  topeAnual?: string | null;
  porcentajeMedicamento?: string | null;
  porcentajePractica?: string | null;
  maxOrdenesPorGrupo?: number | null;
  maxMedicamentosPorOrden?: number | null;
  topesPrestaciones?: Record<string, Record<string, number>> | null;
  requisitosAdjuntos?: { MEDICAMENTO: DocKey[]; PRACTICA: DocKey[] } | null;
  exclusiones?: string[] | { items: string[] } | string | null;
};

type TopeRow = {
  id: string;
  grupo: string;
  prestacion: string;
  max: string; // guardamos string para input
};

const DOCS = [
  { key: "FACTURA", label: "Factura" },
  { key: "RECETA", label: "Receta" },
  { key: "ORDEN", label: "Orden médica" },
  { key: "INFORME", label: "Informe" },
  { key: "DNI", label: "DNI" },
] as const;

type DocKey = (typeof DOCS)[number]["key"];

const DOC_KEYS = new Set(DOCS.map((d) => d.key));

const moneyARS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

function uid() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function isNowBetween(desde: string, hasta?: string | null) {
  const d = new Date(String(desde).slice(0, 10));
  const h = hasta ? new Date(String(hasta).slice(0, 10)) : null;
  const now = new Date();
  const nowD = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const end = h ? new Date(h.getFullYear(), h.getMonth(), h.getDate()) : null;
  if (nowD < start) return false;
  if (end && nowD > end) return false;
  return true;
}

function toNumberOrNull(raw: string) {
  const v = raw.trim();
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isDocKey(value: unknown): value is DocKey {
  return typeof value === "string" && DOC_KEYS.has(value as DocKey);
}

function objToTopeRows(obj: unknown): TopeRow[] {
  if (!isRecord(obj)) return [];
  const rows: TopeRow[] = [];
  for (const [grupo, inner] of Object.entries(obj)) {
    if (!isRecord(inner)) continue;
    for (const [prestacion, max] of Object.entries(inner)) {
      rows.push({
        id: uid(),
        grupo,
        prestacion,
        max: max == null ? "" : String(max),
      });
    }
  }
  return rows;
}

function rowsToTopesObj(rows: TopeRow[]) {
  const out: Record<string, Record<string, number>> = {};
  for (const r of rows) {
    const grupo = (r.grupo || "").trim();
    const prest = (r.prestacion || "").trim();
    const maxN = toNumberOrNull(r.max);
    if (!grupo || !prest || maxN == null || maxN <= 0) continue;

    if (!out[grupo]) out[grupo] = {};
    out[grupo][prest] = maxN;
  }
  return Object.keys(out).length ? out : null;
}

function normalizeReq(raw: unknown) {
  const def: { MEDICAMENTO: DocKey[]; PRACTICA: DocKey[] } = {
    MEDICAMENTO: ["FACTURA", "RECETA"],
    PRACTICA: ["FACTURA", "ORDEN"],
  };
  if (!isRecord(raw)) return { ...def };
  const medRaw = raw.MEDICAMENTO;
  const pracRaw = raw.PRACTICA;
  const med = Array.isArray(medRaw) ? medRaw.filter(isDocKey) : [...def.MEDICAMENTO];
  const prac = Array.isArray(pracRaw) ? pracRaw.filter(isDocKey) : [...def.PRACTICA];
  return { MEDICAMENTO: med, PRACTICA: prac };
}

function exclusionesToLines(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String).map((s) => s.trim()).filter(Boolean);
  // si viene como objeto { items: [...] } o similar
  if (isRecord(raw) && Array.isArray(raw.items)) {
    return raw.items.map(String).map((s) => s.trim()).filter(Boolean);
  }
  // fallback: string
  if (typeof raw === "string") {
    return raw
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

export default function ReintegrosPoliticasPage() {
  const [lista, setLista] = useState<Politica[]>([]);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [loadingList, setLoadingList] = useState(false);
  const [loadingSave, setLoadingSave] = useState(false);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // form fields
  const [vigenteDesde, setVigenteDesde] = useState("");
  const [vigenteHasta, setVigenteHasta] = useState("");

  const [topeMensual, setTopeMensual] = useState("");
  const [topeAnual, setTopeAnual] = useState("");

  const [porcMed, setPorcMed] = useState("0");
  const [porcPract, setPorcPract] = useState("0");

  const [maxOrdenes, setMaxOrdenes] = useState("4");
  const [maxMeds, setMaxMeds] = useState("2");

  // reemplazo de JSON por UI simple
  const [topesRows, setTopesRows] = useState<TopeRow[]>([
    { id: uid(), grupo: "optica", prestacion: "marcos", max: "1" },
    { id: uid(), grupo: "optica", prestacion: "cristales", max: "1" },
  ]);

  const [reqAdjuntos, setReqAdjuntos] = useState<{ MEDICAMENTO: DocKey[]; PRACTICA: DocKey[] }>(
    { MEDICAMENTO: ["FACTURA", "RECETA"], PRACTICA: ["FACTURA", "ORDEN"] },
  );

  const [exclusionesLines, setExclusionesLines] = useState<string[]>([]);
  const exclusionesText = useMemo(() => exclusionesLines.join("\n"), [exclusionesLines]);

  const cargar = async () => {
    try {
      setLoadingList(true);
      const data = await api<Politica[]>("/reintegros/politicas");
      setLista(data);
    } catch (e) {
      setMsg({ type: "error", text: getErrorMessage(e) });
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    void cargar();
  }, []);

  const resetForm = () => {
    setEditId(null);
    setVigenteDesde("");
    setVigenteHasta("");
    setTopeMensual("");
    setTopeAnual("");
    setPorcMed("0");
    setPorcPract("0");
    setMaxOrdenes("4");
    setMaxMeds("2");

    setTopesRows([
      { id: uid(), grupo: "optica", prestacion: "marcos", max: "1" },
      { id: uid(), grupo: "optica", prestacion: "cristales", max: "1" },
    ]);

    setReqAdjuntos({ MEDICAMENTO: ["FACTURA", "RECETA"], PRACTICA: ["FACTURA", "ORDEN"] });
    setExclusionesLines([]);
  };

  const openCreate = () => {
    resetForm();
    setSheetOpen(true);
  };

  const editar = (p: Politica) => {
    setEditId(p.id);

    setVigenteDesde(String(p.vigenteDesde).slice(0, 10));
    setVigenteHasta(p.vigenteHasta ? String(p.vigenteHasta).slice(0, 10) : "");

    setTopeMensual(p.topeMensual ?? "");
    setTopeAnual(p.topeAnual ?? "");

    setPorcMed(p.porcentajeMedicamento ?? "0");
    setPorcPract(p.porcentajePractica ?? "0");

    setMaxOrdenes(p.maxOrdenesPorGrupo != null ? String(p.maxOrdenesPorGrupo) : "4");
    setMaxMeds(p.maxMedicamentosPorOrden != null ? String(p.maxMedicamentosPorOrden) : "2");

    setTopesRows(() => {
      const fromApi = objToTopeRows(p.topesPrestaciones);
      return fromApi.length
        ? fromApi
        : [
            { id: uid(), grupo: "optica", prestacion: "marcos", max: "1" },
            { id: uid(), grupo: "optica", prestacion: "cristales", max: "1" },
          ];
    });

    setReqAdjuntos(() => normalizeReq(p.requisitosAdjuntos));
    setExclusionesLines(exclusionesToLines(p.exclusiones));

    setSheetOpen(true);
  };

  const toggleReq = (tipo: "MEDICAMENTO" | "PRACTICA", key: DocKey, checked: boolean) => {
    setReqAdjuntos((prev) => {
      const set = new Set(prev[tipo]);
      if (checked) set.add(key);
      else set.delete(key);
      return { ...prev, [tipo]: Array.from(set) };
    });
  };

  const addTopeRow = () => {
    setTopesRows((prev) => [...prev, { id: uid(), grupo: "", prestacion: "", max: "" }]);
  };

  const updateTopeRow = (id: string, next: Partial<TopeRow>) => {
    setTopesRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...next } : r)));
  };

  const removeTopeRow = (id: string) => {
    setTopesRows((prev) => prev.filter((r) => r.id !== id));
  };

  const buildPayload = () => {
    const payload = {
      vigenteDesde,
      vigenteHasta: vigenteHasta || null,

      topeMensual: toNumberOrNull(topeMensual),
      topeAnual: toNumberOrNull(topeAnual),

      porcentajeMedicamento: toNumberOrNull(porcMed),
      porcentajePractica: toNumberOrNull(porcPract),

      maxOrdenesPorGrupo: toNumberOrNull(maxOrdenes),
      maxMedicamentosPorOrden: toNumberOrNull(maxMeds),

      // UI simple -> JSON para backend
      topesPrestaciones: rowsToTopesObj(topesRows),
      requisitosAdjuntos: {
        MEDICAMENTO: reqAdjuntos.MEDICAMENTO,
        PRACTICA: reqAdjuntos.PRACTICA,
      },
      exclusiones: exclusionesLines.length ? exclusionesLines : null,
    };

    return payload;
  };

  const guardar = async () => {
    try {
      setLoadingSave(true);
      const payload = buildPayload();

      if (!vigenteDesde) {
        setMsg({ type: "error", text: "Vigente desde es obligatorio." });
        return;
      }

      if (editId) {
        await api(`/reintegros/politicas/${editId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setMsg({ type: "success", text: "Política actualizada" });
      } else {
        await api("/reintegros/politicas", { method: "POST", body: JSON.stringify(payload) });
        setMsg({ type: "success", text: "Política creada" });
      }

      setSheetOpen(false);
      resetForm();
      await cargar();
    } catch (e) {
      setMsg({ type: "error", text: getErrorMessage(e) });
    } finally {
      setLoadingSave(false);
    }
  };

  const toggleActivo = async (p: Politica) => {
    try {
      setLoadingList(true);
      await api(`/reintegros/politicas/${p.id}`, {
        method: "PATCH",
        body: JSON.stringify({ activo: !p.activo }),
      });
      await cargar();
    } catch (e) {
      setMsg({ type: "error", text: getErrorMessage(e) });
    } finally {
      setLoadingList(false);
    }
  };

  return (
    <main className="max-w-[1200px] mx-auto px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Políticas de reintegros</h1>
          <p className="text-sm text-muted-foreground">
            Configurá topes, porcentajes y requisitos de documentación sin JSON.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={cargar} disabled={loadingList}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Actualizar
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva política
          </Button>
        </div>
      </div>

      {/* Alert */}
      {msg && (
        <Alert
          className={cn(
            "rounded-xl",
            msg.type === "error"
              ? "border-destructive/30 bg-destructive/10"
              : "border-emerald-500/30 bg-emerald-500/10",
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <AlertTitle className="text-sm font-medium">
                {msg.type === "error" ? "Ocurrió un error" : "Listo"}
              </AlertTitle>
              <AlertDescription className="text-sm">{msg.text}</AlertDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setMsg(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </Alert>
      )}

      {/* List */}
      <Card className="rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold">Políticas</CardTitle>
          <CardDescription className="text-sm">
            Editá una política o activá/desactivá sin tocar configuraciones complejas.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-xl border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    ID
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Vigencia
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Porcentajes
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Topes
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Límites
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Estado
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground text-right">
                    Acciones
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loadingList ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell className="py-3">
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell className="py-3">
                        <Skeleton className="h-4 w-40" />
                      </TableCell>
                      <TableCell className="py-3">
                        <Skeleton className="h-4 w-32" />
                      </TableCell>
                      <TableCell className="py-3">
                        <Skeleton className="h-4 w-40" />
                      </TableCell>
                      <TableCell className="py-3">
                        <Skeleton className="h-4 w-32" />
                      </TableCell>
                      <TableCell className="py-3">
                        <Skeleton className="h-6 w-24" />
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <Skeleton className="ml-auto h-8 w-28" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : lista.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10">
                      <div className="flex flex-col items-center justify-center gap-2 text-center">
                        <div className="text-sm font-medium">Sin políticas</div>
                        <div className="text-xs text-muted-foreground">
                          Creá la primera política para habilitar validaciones y topes.
                        </div>
                        <Button className="mt-2" onClick={openCreate}>
                          <Plus className="mr-2 h-4 w-4" />
                          Nueva política
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  lista.map((p) => {
                    const vigente = isNowBetween(p.vigenteDesde, p.vigenteHasta);
                    return (
                      <TableRow key={p.id} className="hover:bg-muted/50">
                        <TableCell className="py-3 font-mono text-xs">{p.id}</TableCell>

                        <TableCell className="py-3 text-sm">
                          <div className="flex flex-col">
                            <span>
                              {String(p.vigenteDesde).slice(0, 10)}
                              {p.vigenteHasta ? ` → ${String(p.vigenteHasta).slice(0, 10)}` : ""}
                            </span>
                            <span className="mt-1">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "rounded-md text-xs",
                                  vigente ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700" : "",
                                )}
                              >
                                {vigente ? "Vigente" : "Fuera de vigencia"}
                              </Badge>
                            </span>
                          </div>
                        </TableCell>

                        <TableCell className="py-3 text-sm">
                          <span className="tabular-nums">
                            Med: {p.porcentajeMedicamento ?? "—"}% · Pract: {p.porcentajePractica ?? "—"}%
                          </span>
                        </TableCell>

                        <TableCell className="py-3 text-sm">
                          <div className="flex flex-col">
                            <span className="tabular-nums">
                              Mensual:{" "}
                              {p.topeMensual ? moneyARS.format(Number(p.topeMensual)) : "—"}
                            </span>
                            <span className="tabular-nums text-muted-foreground">
                              Anual: {p.topeAnual ? moneyARS.format(Number(p.topeAnual)) : "—"}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell className="py-3 text-sm">
                          <span className="tabular-nums">
                            Órdenes: {p.maxOrdenesPorGrupo ?? "—"} · Meds/orden:{" "}
                            {p.maxMedicamentosPorOrden ?? "—"}
                          </span>
                        </TableCell>

                        <TableCell className="py-3">
                          <Badge
                            variant="outline"
                            className={cn(
                              "rounded-md text-xs",
                              p.activo
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                                : "border-border/60 bg-muted text-foreground",
                            )}
                          >
                            {p.activo ? "Activa" : "Inactiva"}
                          </Badge>
                        </TableCell>

                        <TableCell className="py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => editar(p)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              className={cn(p.activo ? "text-destructive" : "text-foreground")}
                              onClick={() => toggleActivo(p)}
                            >
                              <Power className="mr-2 h-4 w-4" />
                              {p.activo ? "Desactivar" : "Activar"}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Sheet: form */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-3xl">
          <SheetHeader>
            <SheetTitle>{editId ? "Editar política" : "Nueva política"}</SheetTitle>
            <SheetDescription>
              Configuración entendible para el operador: porcentajes, topes, requisitos y exclusiones.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-5 space-y-5">
            {/* Básico */}
            <Card className="rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold">Vigencia y reglas base</CardTitle>
                <CardDescription className="text-sm">
                  “Vigente desde” es obligatorio. “Vigente hasta” puede quedar vacío.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-5 pt-0 space-y-4">
                <div className="grid grid-cols-12 gap-4">
                  <div className="col-span-12 md:col-span-4">
                    <Label className="text-xs text-muted-foreground">Vigente desde</Label>
                    <Input
                      className="h-10 mt-1"
                      type="date"
                      value={vigenteDesde}
                      onChange={(e) => setVigenteDesde(e.target.value)}
                    />
                  </div>

                  <div className="col-span-12 md:col-span-4">
                    <Label className="text-xs text-muted-foreground">Vigente hasta</Label>
                    <Input
                      className="h-10 mt-1"
                      type="date"
                      value={vigenteHasta}
                      onChange={(e) => setVigenteHasta(e.target.value)}
                    />
                  </div>

                  <div className="col-span-12 md:col-span-2">
                    <Label className="text-xs text-muted-foreground">% Medicamento</Label>
                    <Input
                      className="h-10 mt-1 tabular-nums"
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      value={porcMed}
                      onChange={(e) => setPorcMed(e.target.value)}
                    />
                  </div>

                  <div className="col-span-12 md:col-span-2">
                    <Label className="text-xs text-muted-foreground">% Práctica</Label>
                    <Input
                      className="h-10 mt-1 tabular-nums"
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      value={porcPract}
                      onChange={(e) => setPorcPract(e.target.value)}
                    />
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-12 gap-4">
                  <div className="col-span-12 md:col-span-3">
                    <Label className="text-xs text-muted-foreground">Tope mensual (ARS)</Label>
                    <Input
                      className="h-10 mt-1 tabular-nums"
                      type="number"
                      min={0}
                      step="1"
                      value={topeMensual}
                      onChange={(e) => setTopeMensual(e.target.value)}
                      placeholder="Ej: 30000"
                    />
                    <div className="mt-1 text-xs text-muted-foreground">
                      {topeMensual ? `Vista: ${moneyARS.format(Number(topeMensual))}` : "—"}
                    </div>
                  </div>

                  <div className="col-span-12 md:col-span-3">
                    <Label className="text-xs text-muted-foreground">Tope anual (ARS)</Label>
                    <Input
                      className="h-10 mt-1 tabular-nums"
                      type="number"
                      min={0}
                      step="1"
                      value={topeAnual}
                      onChange={(e) => setTopeAnual(e.target.value)}
                      placeholder="Ej: 250000"
                    />
                    <div className="mt-1 text-xs text-muted-foreground">
                      {topeAnual ? `Vista: ${moneyARS.format(Number(topeAnual))}` : "—"}
                    </div>
                  </div>

                  <div className="col-span-12 md:col-span-3">
                    <Label className="text-xs text-muted-foreground">Máx. órdenes por grupo</Label>
                    <Input
                      className="h-10 mt-1 tabular-nums"
                      type="number"
                      min={0}
                      step="1"
                      value={maxOrdenes}
                      onChange={(e) => setMaxOrdenes(e.target.value)}
                    />
                  </div>

                  <div className="col-span-12 md:col-span-3">
                    <Label className="text-xs text-muted-foreground">Máx. meds por orden</Label>
                    <Input
                      className="h-10 mt-1 tabular-nums"
                      type="number"
                      min={0}
                      step="1"
                      value={maxMeds}
                      onChange={(e) => setMaxMeds(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Topes prestaciones */}
            <Card className="rounded-xl">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg font-semibold">Topes por prestación</CardTitle>
                    <CardDescription className="text-sm">
                      Cargá topes puntuales (por ejemplo “óptica → cristales: 1”). Dejá vacío si no aplica.
                    </CardDescription>
                  </div>
                  <Button variant="outline" onClick={addTopeRow}>
                    <Plus className="mr-2 h-4 w-4" />
                    Agregar
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-5 pt-0 space-y-3">
                {topesRows.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Sin topes cargados.</div>
                ) : (
                  topesRows.map((r) => {
                    const ok =
                      r.grupo.trim().length > 0 &&
                      r.prestacion.trim().length > 0 &&
                      (toNumberOrNull(r.max) ?? 0) > 0;

                    return (
                      <div
                        key={r.id}
                        className={cn(
                          "rounded-xl border p-3",
                          !ok && "border-border/60 bg-muted/20",
                        )}
                      >
                        <div className="grid grid-cols-12 gap-3 items-end">
                          <div className="col-span-12 md:col-span-4">
                            <Label className="text-xs text-muted-foreground">Grupo</Label>
                            <Input
                              className="h-10 mt-1"
                              value={r.grupo}
                              placeholder="Ej: optica"
                              onChange={(e) => updateTopeRow(r.id, { grupo: e.target.value })}
                            />
                          </div>

                          <div className="col-span-12 md:col-span-5">
                            <Label className="text-xs text-muted-foreground">Prestación</Label>
                            <Input
                              className="h-10 mt-1"
                              value={r.prestacion}
                              placeholder="Ej: cristales"
                              onChange={(e) => updateTopeRow(r.id, { prestacion: e.target.value })}
                            />
                          </div>

                          <div className="col-span-10 md:col-span-2">
                            <Label className="text-xs text-muted-foreground">Tope (cantidad)</Label>
                            <Input
                              className="h-10 mt-1 tabular-nums"
                              type="number"
                              min={0}
                              step="1"
                              value={r.max}
                              placeholder="Ej: 1"
                              onChange={(e) => updateTopeRow(r.id, { max: e.target.value })}
                            />
                          </div>

                          <div className="col-span-2 md:col-span-1 flex justify-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => removeTopeRow(r.id)}
                              title="Quitar"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}

                <div className="text-xs text-muted-foreground">
                  Solo se guardan filas completas (grupo + prestación + tope &gt; 0).
                </div>
              </CardContent>
            </Card>

            {/* Requisitos adjuntos */}
            <Card className="rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold">Requisitos de documentación</CardTitle>
                <CardDescription className="text-sm">
                  Marcá qué adjuntos son obligatorios por tipo. (Ej: Medicamento requiere Factura + Receta)
                </CardDescription>
              </CardHeader>

              <CardContent className="p-5 pt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-xl border p-4">
                    <div className="text-sm font-medium">Medicamentos</div>
                    <div className="mt-3 space-y-2">
                      {DOCS.map((d) => (
                        <div key={d.key} className="flex items-center gap-2">
                          <Checkbox
                            checked={reqAdjuntos.MEDICAMENTO.includes(d.key)}
                            onCheckedChange={(v) => toggleReq("MEDICAMENTO", d.key, v === true)}
                          />
                          <span className="text-sm">{d.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border p-4">
                    <div className="text-sm font-medium">Prácticas</div>
                    <div className="mt-3 space-y-2">
                      {DOCS.map((d) => (
                        <div key={d.key} className="flex items-center gap-2">
                          <Checkbox
                            checked={reqAdjuntos.PRACTICA.includes(d.key)}
                            onCheckedChange={(v) => toggleReq("PRACTICA", d.key, v === true)}
                          />
                          <span className="text-sm">{d.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-xs text-muted-foreground">
                  Resumen: Med ({reqAdjuntos.MEDICAMENTO.join(", ") || "sin requisitos"}) · Pract (
                  {reqAdjuntos.PRACTICA.join(", ") || "sin requisitos"})
                </div>
              </CardContent>
            </Card>

            {/* Exclusiones */}
            <Card className="rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold">Exclusiones</CardTitle>
                <CardDescription className="text-sm">
                  Escribí una exclusión por línea (ej: “cosmética”, “odontología estética”). Opcional.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-5 pt-0 space-y-2">
                <Textarea
                  className="min-h-[120px]"
                  placeholder={"Ej:\ncosmética\nodontología estética"}
                  value={exclusionesText}
                  onChange={(e) => {
                    const lines = e.target.value
                      .split("\n")
                      .map((s) => s.trim())
                      .filter(Boolean);
                    setExclusionesLines(lines);
                  }}
                />
                {exclusionesLines.length ? (
                  <div className="flex flex-wrap gap-2">
                    {exclusionesLines.slice(0, 8).map((x) => (
                      <Badge key={x} variant="outline" className="rounded-md">
                        {x}
                      </Badge>
                    ))}
                    {exclusionesLines.length > 8 ? (
                      <Badge variant="outline" className="rounded-md">
                        +{exclusionesLines.length - 8}
                      </Badge>
                    ) : null}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">Sin exclusiones.</div>
                )}
              </CardContent>
            </Card>
          </div>

          <SheetFooter className="mt-2 flex flex-col gap-2 sm:flex-row sm:justify-between">
            <Button variant="outline" onClick={resetForm} disabled={loadingSave}>
              Reset
            </Button>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setSheetOpen(false);
                  resetForm();
                }}
                disabled={loadingSave}
              >
                Cancelar
              </Button>
              <Button onClick={guardar} disabled={loadingSave || !vigenteDesde}>
                {loadingSave ? "Guardando…" : editId ? "Guardar cambios" : "Crear política"}
              </Button>
            </div>
          </SheetFooter>

          <div className="mt-3 text-xs text-muted-foreground">
            Tip: la activación de una política se maneja desde el listado (Activar/Desactivar).
          </div>
        </SheetContent>
      </Sheet>
    </main>
  );
}
