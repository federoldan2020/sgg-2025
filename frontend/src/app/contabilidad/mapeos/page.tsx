"use client";

import { useEffect, useMemo, useState } from "react";
import { api, getErrorMessage } from "@/servicios/api";
import AutocompleteCuenta from "@/components/AutocompleteCuenta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import {
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  Check,
  X,
  ToggleLeft,
  ToggleRight,
  Wand2,
  RefreshCw,
  Settings2,
  FileText,
} from "lucide-react";

type Mapeo = {
  id: string;
  origen: string;
  conceptoCodigo?: string | null;
  metodoPago?: string | null;
  debeCodigo: string;
  haberCodigo: string;
  descripcion?: string | null;
  activo: boolean;
};

type Paginado<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
};

const ORIGENES = [
  { value: "comprobante_tercero", label: "Comprobante Tercero" },
  { value: "orden_pago_tercero", label: "Orden de Pago" },
  { value: "pago_caja", label: "Pago en Caja" },
  { value: "cierre_caja", label: "Cierre de Caja" },
  { value: "nomina", label: "Nómina (Descuentos)" },
] as const;

const ROLES = ["(genérico)", "PROVEEDOR", "PRESTADOR", "AFILIADO", "OTRO"] as const;

const PRESETS: Record<string, string[]> = {
  comprobante_tercero: [
    "neto", "iva", "exento", "no_gravado", "percep_iva", "ret_iva",
    "ret_gan", "percep_iibb", "ret_iibb", "imp_municipal", "imp_interno",
    "gasto_admin", "otros", "cxp",
  ],
  orden_pago_tercero: ["cxp", "mp_efectivo", "mp_transferencia", "mp_cheque", "mp_otro"],
  pago_caja: ["ingreso", "egreso"],
  cierre_caja: ["sobrante", "faltante"],
  nomina: ["J17", "J22", "J38", "K16"],
};

function OrigenBadge({ origen }: { origen: string }) {
  const config: Record<string, { variant: "default" | "secondary" | "outline"; label: string }> = {
    comprobante_tercero: { variant: "secondary", label: "Comprobante" },
    orden_pago_tercero: { variant: "default", label: "Ord. Pago" },
    pago_caja: { variant: "outline", label: "Caja" },
    cierre_caja: { variant: "secondary", label: "Cierre" },
    nomina: { variant: "default", label: "Nómina" },
  };
  const c = config[origen] ?? { variant: "outline" as const, label: origen };
  return <Badge variant={c.variant}>{c.label}</Badge>;
}

export default function MapeosPage() {
  // Filtros/paginado
  const [q, setQ] = useState("");
  const [origenFilter, setOrigenFilter] = useState("");
  const [activoFilter, setActivoFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Listado
  const [lista, setLista] = useState<Paginado<Mapeo>>({
    items: [], total: 0, page: 1, pageSize: 20, pages: 1,
  });
  const [loadingList, setLoadingList] = useState(false);

  // Alta rápida
  const [origen, setOrigen] = useState("comprobante_tercero");
  const [presetConcepto, setPresetConcepto] = useState("");
  const [rolSuffix, setRolSuffix] = useState("(genérico)");
  const [conceptoManual, setConceptoManual] = useState("");
  const [metodo, setMetodo] = useState("");
  const [debe, setDebe] = useState("");
  const [haber, setHaber] = useState("");
  const [desc, setDesc] = useState("");

  // Edición inline
  const [editId, setEditId] = useState<string | null>(null);
  const [editDebe, setEditDebe] = useState("");
  const [editHaber, setEditHaber] = useState("");
  const [editDesc, setEditDesc] = useState("");

  // Asistente presets
  const [asistOpen, setAsistOpen] = useState(false);
  const [nuevoOpen, setNuevoOpen] = useState(false);
  const [asistRol, setAsistRol] = useState("(genérico)");
  const [cuentaPuente, setCuentaPuente] = useState("19999.000");
  const [cuentaCxP, setCuentaCxP] = useState("21101.000");
  const [ctaGasto, setCtaGasto] = useState("51101.000");
  const [ctaIVACred, setCtaIVACred] = useState("11109.000");
  const [ctaExento, setCtaExento] = useState("51101.000");
  const [ctaNoGrav, setCtaNoGrav] = useState("51101.000");
  const [ctaOtros, setCtaOtros] = useState("51900.000");
  const [ctaGastoAdm, setCtaGastoAdm] = useState("51910.000");
  const [ctaImpInt, setCtaImpInt] = useState("51920.000");
  const [ctaImpMun, setCtaImpMun] = useState("51930.000");
  const [ctaPercepIVA, setCtaPercepIVA] = useState("11110.000");
  const [ctaRetIVA, setCtaRetIVA] = useState("21110.000");
  const [ctaRetGan, setCtaRetGan] = useState("21111.000");
  const [ctaPercepIIBB, setCtaPercepIIBB] = useState("11111.000");
  const [ctaRetIIBB, setCtaRetIIBB] = useState("21112.000");
  const [ctaEfvo, setCtaEfvo] = useState("10101.001");
  const [ctaTransf, setCtaTransf] = useState("11201.000");
  const [ctaCheque, setCtaCheque] = useState("11301.000");
  const [ctaOtroMP, setCtaOtroMP] = useState("11999.000");

  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const conceptoConstruido = useMemo(() => {
    const base = (presetConcepto || conceptoManual).trim();
    if (!base) return null;
    const r = rolSuffix !== "(genérico)" ? rolSuffix : "";
    return r ? `${base}_${r}` : base;
  }, [presetConcepto, conceptoManual, rolSuffix]);

  const cargar = async () => {
    try {
      setLoadingList(true);
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (origenFilter) params.set("origen", origenFilter);
      if (activoFilter) params.set("activo", activoFilter);
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      const data = await api<Paginado<Mapeo>>(`/contabilidad/mapeos?${params.toString()}`);
      setLista(data);
    } catch (e) {
      setMsg({ type: "error", text: getErrorMessage(e) });
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    void cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, origenFilter, activoFilter, page, pageSize]);

  const crear = async () => {
    try {
      if (!debe.trim() || !haber.trim()) throw new Error("Debe y Haber son obligatorios.");
      await api("/contabilidad/mapeos/create", {
        method: "POST",
        body: JSON.stringify({
          origen,
          conceptoCodigo: conceptoConstruido,
          metodoPago: metodo.trim() || null,
          debeCodigo: debe.trim(),
          haberCodigo: haber.trim(),
          descripcion: desc.trim() || null,
        }),
      });
      setPresetConcepto("");
      setRolSuffix("(genérico)");
      setConceptoManual("");
      setMetodo("");
      setDebe("");
      setHaber("");
      setDesc("");
      setPage(1);
      await cargar();
      setMsg({ type: "success", text: "Mapeo creado correctamente" });
    } catch (e) {
      setMsg({ type: "error", text: getErrorMessage(e) });
    }
  };

  const toggle = async (id: string, activo: boolean) => {
    try {
      await api(`/contabilidad/mapeos/${id}/toggle`, {
        method: "PATCH",
        body: JSON.stringify({ activo: !activo }),
      });
      await cargar();
    } catch (e) {
      setMsg({ type: "error", text: getErrorMessage(e) });
    }
  };

  const eliminar = async (id: string) => {
    if (!confirm("¿Eliminar este mapeo?")) return;
    try {
      await api(`/contabilidad/mapeos/${id}`, { method: "DELETE" });
      await cargar();
      setMsg({ type: "success", text: "Mapeo eliminado" });
    } catch (e) {
      setMsg({ type: "error", text: getErrorMessage(e) });
    }
  };

  const comenzarEditar = (m: Mapeo) => {
    setEditId(m.id);
    setEditDebe(m.debeCodigo);
    setEditHaber(m.haberCodigo);
    setEditDesc(m.descripcion ?? "");
  };

  const guardarEdicion = async () => {
    if (!editId) return;
    try {
      await api(`/contabilidad/mapeos/${editId}`, {
        method: "PUT",
        body: JSON.stringify({
          debeCodigo: editDebe.trim(),
          haberCodigo: editHaber.trim(),
          descripcion: editDesc.trim() || null,
        }),
      });
      setEditId(null);
      await cargar();
      setMsg({ type: "success", text: "Mapeo actualizado" });
    } catch (e) {
      setMsg({ type: "error", text: getErrorMessage(e) });
    }
  };

  const crearPresetsTerceros = async () => {
    try {
      const rol = asistRol !== "(genérico)" ? asistRol : null;
      await api("/contabilidad/mapeos/seed-terceros", {
        method: "POST",
        body: JSON.stringify({
          rol,
          cuentas: {
            puente: cuentaPuente, cxp: cuentaCxP, gasto: ctaGasto, ivaCredito: ctaIVACred,
            exento: ctaExento, noGravado: ctaNoGrav, otros: ctaOtros, gastoAdmin: ctaGastoAdm,
            impInterno: ctaImpInt, impMunicipal: ctaImpMun, percepIVA: ctaPercepIVA,
            retIVA: ctaRetIVA, retGan: ctaRetGan, percepIIBB: ctaPercepIIBB, retIIBB: ctaRetIIBB,
            mp_efectivo: ctaEfvo, mp_transferencia: ctaTransf, mp_cheque: ctaCheque, mp_otro: ctaOtroMP,
          },
        }),
      });
      await cargar();
      setMsg({ type: "success", text: "Presets de terceros creados" });
    } catch (e) {
      setMsg({ type: "error", text: getErrorMessage(e) });
    }
  };

  const crearSeedCierre = async () => {
    try {
      await api("/contabilidad/mapeos/seed-cierre", { method: "POST" });
      await cargar();
      setMsg({ type: "success", text: "Mapeos de cierre creados" });
    } catch (e) {
      setMsg({ type: "error", text: getErrorMessage(e) });
    }
  };

  return (
    <main className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mapeos Contables</h1>
          <p className="text-muted-foreground">
            Configuración de asignaciones automáticas de cuentas
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setAsistOpen(!asistOpen)} className="gap-2">
            <Wand2 className="h-4 w-4" />
            Asistente
          </Button>
          <Button size="sm" onClick={() => setNuevoOpen(!nuevoOpen)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nuevo Mapeo
          </Button>
        </div>
      </div>

      {/* Mensaje */}
      {msg && (
        <div className={`rounded-lg border p-4 text-sm ${
          msg.type === "error" 
            ? "border-destructive/50 bg-destructive/10 text-destructive" 
            : "border-green-500/50 bg-green-500/10 text-green-700"
        }`}>
          {msg.text}
          <button className="ml-4 text-xs underline" onClick={() => setMsg(null)}>Cerrar</button>
        </div>
      )}

      {/* Asistente Terceros (colapsable) */}
      <Collapsible open={asistOpen} onOpenChange={setAsistOpen}>
        <CollapsibleContent>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Wand2 className="h-5 w-5 text-primary" />
                <CardTitle>Asistente de Configuración</CardTitle>
              </div>
              <CardDescription>
                Genera automáticamente los mapeos para comprobantes de terceros y órdenes de pago.
                Cada componente (neto, IVA, etc.) se asigna a su cuenta correspondiente.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Rol (sufijo)</label>
                  <Select value={asistRol} onValueChange={setAsistRol}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Cuenta Puente</label>
                  <Input value={cuentaPuente} onChange={(e) => setCuentaPuente(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">CxP</label>
                  <Input value={cuentaCxP} onChange={(e) => setCuentaCxP(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Gasto/Neto</label>
                  <Input value={ctaGasto} onChange={(e) => setCtaGasto(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">IVA Crédito</label>
                  <Input value={ctaIVACred} onChange={(e) => setCtaIVACred(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Exento</label>
                  <Input value={ctaExento} onChange={(e) => setCtaExento(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">No Gravado</label>
                  <Input value={ctaNoGrav} onChange={(e) => setCtaNoGrav(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Otros Imp.</label>
                  <Input value={ctaOtros} onChange={(e) => setCtaOtros(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Gasto Admin</label>
                  <Input value={ctaGastoAdm} onChange={(e) => setCtaGastoAdm(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Imp. Interno</label>
                  <Input value={ctaImpInt} onChange={(e) => setCtaImpInt(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Imp. Municipal</label>
                  <Input value={ctaImpMun} onChange={(e) => setCtaImpMun(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Percep. IVA</label>
                  <Input value={ctaPercepIVA} onChange={(e) => setCtaPercepIVA(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Ret. IVA</label>
                  <Input value={ctaRetIVA} onChange={(e) => setCtaRetIVA(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Ret. Ganancias</label>
                  <Input value={ctaRetGan} onChange={(e) => setCtaRetGan(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Percep. IIBB</label>
                  <Input value={ctaPercepIIBB} onChange={(e) => setCtaPercepIIBB(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Ret. IIBB</label>
                  <Input value={ctaRetIIBB} onChange={(e) => setCtaRetIIBB(e.target.value)} />
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground mb-3">Medios de Pago (para Órdenes de Pago)</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Efectivo</label>
                    <Input value={ctaEfvo} onChange={(e) => setCtaEfvo(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Transferencia</label>
                    <Input value={ctaTransf} onChange={(e) => setCtaTransf(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Cheque</label>
                    <Input value={ctaCheque} onChange={(e) => setCtaCheque(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Otro</label>
                    <Input value={ctaOtroMP} onChange={(e) => setCtaOtroMP(e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button onClick={crearPresetsTerceros} className="gap-2">
                  <Wand2 className="h-4 w-4" />
                  Crear Mapeos Terceros/OP
                </Button>
                <Button variant="outline" onClick={crearSeedCierre} className="gap-2">
                  <Settings2 className="h-4 w-4" />
                  Crear Mapeos Cierre Caja
                </Button>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Nuevo Mapeo Manual (colapsable) */}
      <Collapsible open={nuevoOpen} onOpenChange={setNuevoOpen}>
        <CollapsibleContent>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-primary" />
                <CardTitle>Nuevo Mapeo Manual</CardTitle>
              </div>
              <CardDescription>
                Crea un mapeo específico para un origen, concepto y/o método de pago
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Origen</label>
                  <Select value={origen} onValueChange={(v) => { setOrigen(v); setPresetConcepto(""); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ORIGENES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Concepto</label>
                  <div className="flex gap-2">
                    <Select value={presetConcepto} onValueChange={(v) => { setPresetConcepto(v); setConceptoManual(""); }}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Preset..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">(manual)</SelectItem>
                        {(PRESETS[origen] || []).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {!presetConcepto && (
                    <Input
                      placeholder="Escribí el concepto manualmente"
                      value={conceptoManual}
                      onChange={(e) => setConceptoManual(e.target.value)}
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Rol (sufijo)</label>
                  <Select value={rolSuffix} onValueChange={setRolSuffix}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <AutocompleteCuenta label="Cuenta Debe" value={debe} onChange={setDebe} />
                <AutocompleteCuenta label="Cuenta Haber" value={haber} onChange={setHaber} />
                <div className="space-y-2">
                  <label className="text-sm font-medium">Método (opcional)</label>
                  <Input
                    value={metodo}
                    onChange={(e) => setMetodo(e.target.value)}
                    placeholder="efectivo / transferencia / cheque"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Descripción (opcional)</label>
                  <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Descripción del mapeo" />
                </div>
                <div className="flex items-end gap-4">
                  <div className="text-sm text-muted-foreground">
                    Concepto final: <code className="bg-muted px-2 py-1 rounded">{conceptoConstruido ?? "—"}</code>
                  </div>
                  <Button onClick={crear} disabled={!debe.trim() || !haber.trim()} className="gap-2">
                    <Check className="h-4 w-4" />
                    Guardar Mapeo
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar cuentas, descripción, método..."
                value={q}
                onChange={(e) => { setPage(1); setQ(e.target.value); }}
                className="pl-9"
              />
            </div>

            <Select value={origenFilter} onValueChange={(v) => { setPage(1); setOrigenFilter(v === "all" ? "" : v); }}>
              <SelectTrigger><SelectValue placeholder="Todos los orígenes" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los orígenes</SelectItem>
                {ORIGENES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={activoFilter} onValueChange={(v) => { setPage(1); setActivoFilter(v === "all" ? "" : v); }}>
              <SelectTrigger><SelectValue placeholder="Todos los estados" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="true">Activos</SelectItem>
                <SelectItem value="false">Inactivos</SelectItem>
              </SelectContent>
            </Select>

            <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[10, 20, 50, 100].map((n) => <SelectItem key={n} value={String(n)}>{n} por página</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[110px]">Origen</TableHead>
                <TableHead className="w-[140px]">Concepto</TableHead>
                <TableHead className="w-[100px]">Método</TableHead>
                <TableHead className="w-[120px]">Debe</TableHead>
                <TableHead className="w-[120px]">Haber</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="w-[80px]">Estado</TableHead>
                <TableHead className="w-[140px] text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingList ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : lista.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <FileText className="h-8 w-8" />
                      <span>No hay mapeos configurados</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                lista.items.map((m) => (
                  <TableRow key={m.id} className="group">
                    <TableCell><OrigenBadge origen={m.origen} /></TableCell>
                    <TableCell className="font-mono text-xs">{m.conceptoCodigo ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{m.metodoPago ?? "—"}</TableCell>
                    <TableCell>
                      {editId === m.id ? (
                        <Input value={editDebe} onChange={(e) => setEditDebe(e.target.value)} className="h-8 text-xs" />
                      ) : (
                        <code className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">{m.debeCodigo}</code>
                      )}
                    </TableCell>
                    <TableCell>
                      {editId === m.id ? (
                        <Input value={editHaber} onChange={(e) => setEditHaber(e.target.value)} className="h-8 text-xs" />
                      ) : (
                        <code className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded">{m.haberCodigo}</code>
                      )}
                    </TableCell>
                    <TableCell>
                      {editId === m.id ? (
                        <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="h-8" />
                      ) : (
                        <span className="text-sm text-muted-foreground line-clamp-1">{m.descripcion ?? "—"}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={m.activo ? "default" : "secondary"}>
                        {m.activo ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {editId === m.id ? (
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={guardarEdicion} title="Guardar">
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setEditId(null)} title="Cancelar">
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="icon" variant="ghost" onClick={() => comenzarEditar(m)} title="Editar">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => toggle(m.id, m.activo)} title={m.activo ? "Desactivar" : "Activar"}>
                            {m.activo ? <ToggleRight className="h-4 w-4 text-green-600" /> : <ToggleLeft className="h-4 w-4 text-gray-400" />}
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => eliminar(m.id)} title="Eliminar">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>

        {/* Paginación */}
        {lista.pages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">
              {lista.total} mapeo{lista.total !== 1 && "s"} encontrado{lista.total !== 1 && "s"}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || loadingList}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </Button>
              <span className="text-sm font-medium px-2">
                {page} / {lista.pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= lista.pages || loadingList}
                onClick={() => setPage((p) => Math.min(lista.pages, p + 1))}
                className="gap-1"
              >
                Siguiente
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </main>
  );
}
