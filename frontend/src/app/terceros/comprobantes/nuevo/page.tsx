"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  Calculator,
  Check,
  CheckCircle2,
  FileText,
  Info,
  ListChecks,
  Loader2,
  Plus,
  Receipt,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { api, getErrorMessage, ORG } from "@/servicios/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/* ===== Tipos ===== */
type RolTercero = "PROVEEDOR" | "PRESTADOR" | "COMERCIO" | "AFILIADO" | "OTRO";
type TipoComprobante =
  | "FACTURA"
  | "PRESTACION"
  | "NOTA_CREDITO"
  | "NOTA_DEBITO";
type ClaseAFIP = "A" | "B" | "C" | "M" | "X" | "";

type Linea = {
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  alicuotaIVA?: number | null;
};

type ImpAdicTipo =
  | "PERCEPCION_IIBB"
  | "RETENCION_IIBB"
  | "PERCEPCION_IVA"
  | "RETENCION_IVA"
  | "IMP_MUNICIPAL"
  | "IMP_INTERNO"
  | "GASTO_ADMINISTRATIVO"
  | "OTRO";

type ImpAdic = {
  tipo: ImpAdicTipo;
  detalle?: string;
  alicuota?: number | null;
  importe: number;
};

type TerceroSearchItem = {
  id: string;
  nombre: string;
  fantasia?: string | null;
  cuit?: string | null;
  codigo?: string | null;
  activo: boolean;
  roles: RolTercero[];
};

/* ===== Helpers ===== */
const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);

const TIPO_LABEL: Record<TipoComprobante, string> = {
  FACTURA: "Factura",
  PRESTACION: "Prestación",
  NOTA_CREDITO: "Nota de Crédito",
  NOTA_DEBITO: "Nota de Débito",
};

function useDebounced<T>(value: T, delay = 300) {
  const [deb, setDeb] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDeb(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return deb;
}

/* ===== Page ===== */
export default function NuevoComprobantePage() {
  // organizacionId fijo desde el contexto; no se edita en la UI.
  const [organizacionId] = useState(ORG);
  const [rol, setRol] = useState<RolTercero>("PROVEEDOR");
  const [terceroSel, setTerceroSel] = useState<TerceroSearchItem | null>(null);

  const [tipo, setTipo] = useState<TipoComprobante>("FACTURA");
  const [clase, setClase] = useState<ClaseAFIP>("");
  const [puntoVenta, setPV] = useState<number | "">("");
  const [numero, setNumero] = useState<number | "">("");
  const [fecha, setFecha] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [vencimiento, setVenc] = useState<string>("");
  const [moneda, setMoneda] = useState("ARS");
  const [cuitEmisor, setCuitEmisor] = useState<string>("");
  const [observaciones, setObs] = useState<string>("");

  const [lineas, setLineas] = useState<Linea[]>([
    {
      descripcion: "Item 1",
      cantidad: 1,
      precioUnitario: 10000,
      alicuotaIVA: 21,
    },
  ]);
  const [impuestos, setImpuestos] = useState<ImpAdic[]>([]);

  const [posting, setPosting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  // Marca para mostrar errores inline después del primer intento
  const [touched, setTouched] = useState(false);

  /* ===== Autocomplete Terceros ===== */
  const [q, setQ] = useState("");
  const debQ = useDebounced(q, 300);
  const [items, setItems] = useState<TerceroSearchItem[]>([]);
  const [open, setOpen] = useState(false);
  const acWrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const fetchIt = async () => {
      const term = debQ.trim();
      if (!term) {
        setItems([]);
        return;
      }
      try {
        const url = `/terceros/buscar?q=${encodeURIComponent(term)}${
          rol ? `&rol=${encodeURIComponent(rol)}` : ""
        }&limit=20`;
        const rows = await api<TerceroSearchItem[]>(url);
        setItems(rows);
      } catch {
        // Silencioso para no molestar al usuario
      }
    };
    void fetchIt();
  }, [debQ, rol]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!acWrapRef.current) return;
      if (!acWrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const onAutoKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") setOpen(false);
  };

  const pick = (t: TerceroSearchItem) => {
    setTerceroSel(t);
    setQ(`${t.nombre}${t.cuit ? " · " + t.cuit : ""}`);
    setOpen(false);

    if (!t.roles.includes(rol)) {
      const nuevo = t.roles[0] ?? "OTRO";
      setRol(nuevo);
      setMsg(`El tercero no tiene rol ${rol}. Se usará el rol ${nuevo}.`);
    } else {
      setMsg(null);
    }
  };

  const limpiarTercero = () => {
    setTerceroSel(null);
    setQ("");
  };

  /* ===== Líneas / Impuestos ===== */
  const addLinea = () =>
    setLineas((x) => [
      ...x,
      { descripcion: "", cantidad: 1, precioUnitario: 0, alicuotaIVA: 21 },
    ]);
  const delLinea = (i: number) =>
    setLineas((x) => x.filter((_, idx) => idx !== i));
  const updLinea = (i: number, patch: Partial<Linea>) =>
    setLineas((x) =>
      x.map((row, idx) => (idx === i ? { ...row, ...patch } : row))
    );

  const addImp = () =>
    setImpuestos((x) => [...x, { tipo: "GASTO_ADMINISTRATIVO", importe: 0 }]);
  const delImp = (i: number) =>
    setImpuestos((x) => x.filter((_, idx) => idx !== i));
  const updImp = (i: number, patch: Partial<ImpAdic>) =>
    setImpuestos((x) =>
      x.map((row, idx) => (idx === i ? { ...row, ...patch } : row))
    );

  /* ===== Totales ===== */
  const totales = useMemo(() => {
    let netoGrav21 = 0,
      netoGrav105 = 0,
      netoGrav27 = 0,
      netoNoGrav = 0,
      netoExento = 0,
      iva21 = 0,
      iva105 = 0,
      iva27 = 0;

    for (const l of lineas) {
      const cant = Number(l.cantidad || 0);
      const pu = Number(l.precioUnitario || 0);
      const base = cant * pu;
      const ali = l.alicuotaIVA ?? null;

      if (ali == null) {
        netoNoGrav += base;
      } else if (ali === 0) {
        netoExento += base;
      } else if (ali === 21) {
        netoGrav21 += base;
        iva21 += base * 0.21;
      } else if (ali === 10.5) {
        netoGrav105 += base;
        iva105 += base * 0.105;
      } else if (ali === 27) {
        netoGrav27 += base;
        iva27 += base * 0.27;
      } else {
        netoNoGrav += base;
      }
    }

    const subtotal =
      netoGrav21 + netoGrav105 + netoGrav27 + netoNoGrav + netoExento;
    const ivaTotal = iva21 + iva105 + iva27;
    const otros = impuestos.reduce(
      (acc, it) => acc + Number(it.importe || 0),
      0
    );
    const total = subtotal + ivaTotal + otros;

    return {
      netoGrav21,
      netoGrav105,
      netoGrav27,
      netoNoGrav,
      netoExento,
      iva21,
      iva105,
      iva27,
      subtotal,
      ivaTotal,
      otros,
      total,
    };
  }, [lineas, impuestos]);

  /* ===== Validación ===== */
  // El backend exige PV y Número para FACTURA / PRESTACION / NOTA_CREDITO / NOTA_DEBITO.
  // Como hoy son los únicos tipos soportados, los marcamos siempre como obligatorios.
  const errores = useMemo(() => {
    const e: { field: string; label: string; message: string }[] = [];
    if (!terceroSel) e.push({ field: "tercero", label: "Tercero", message: "Seleccioná un tercero." });
    if (puntoVenta === "" || puntoVenta == null)
      e.push({ field: "puntoVenta", label: "Punto de venta", message: "Indicá el punto de venta (1 a 9999)." });
    else if (Number(puntoVenta) < 1 || Number(puntoVenta) > 9999)
      e.push({ field: "puntoVenta", label: "Punto de venta", message: "El punto de venta debe estar entre 1 y 9999." });
    if (numero === "" || numero == null)
      e.push({ field: "numero", label: "Número", message: "Indicá el número de comprobante." });
    else if (Number(numero) < 1 || Number(numero) > 99999999)
      e.push({ field: "numero", label: "Número", message: "El número debe estar entre 1 y 99.999.999." });
    if (!fecha) e.push({ field: "fecha", label: "Fecha", message: "Indicá la fecha del comprobante." });
    if (lineas.length === 0)
      e.push({ field: "lineas", label: "Líneas", message: "Agregá al menos una línea." });
    else if (!lineas.every((l) => l.descripcion.trim().length > 0))
      e.push({ field: "lineas", label: "Líneas", message: "Completá la descripción de todas las líneas." });
    return e;
  }, [terceroSel, puntoVenta, numero, fecha, lineas]);

  const hasError = (field: string) =>
    touched && errores.some((e) => e.field === field);

  const canSubmit = !!organizacionId && errores.length === 0;

  /* ===== Submit ===== */
  const submit = async () => {
    setTouched(true);
    if (!canSubmit) {
      setMsg(`Revisá los campos marcados antes de continuar.`);
      return;
    }
    try {
      setPosting(true);
      setMsg(null);

      const payload = {
        organizacionId,
        terceroId: BigInt(terceroSel!.id).toString(),
        rol,
        tipo,
        clase: clase || null,
        puntoVenta: puntoVenta === "" ? null : Number(puntoVenta),
        numero: numero === "" ? null : Number(numero),
        fecha,
        vencimiento: vencimiento || null,
        moneda,
        cuitEmisor: cuitEmisor || null,
        observaciones: observaciones || null,
        lineas: lineas.map((l) => ({
          descripcion: l.descripcion,
          cantidad: Number(l.cantidad || 0),
          precioUnitario: Number(l.precioUnitario || 0),
          alicuotaIVA: l.alicuotaIVA == null ? null : Number(l.alicuotaIVA),
        })),
        impuestos: impuestos.map((it) => ({
          tipo: it.tipo,
          detalle: it.detalle || null,
          alicuota: it.alicuota == null ? null : Number(it.alicuota),
          importe: Number(it.importe || 0),
        })),
      };

      const r = await api<{ id: string; total?: number }>("/terceros/comprobantes", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setMsg(
        `Comprobante creado exitosamente (ID: ${r.id}). Total: $${fmt(
          Number(r.total ?? 0)
        )}`
      );
    } catch (e) {
      setMsg(`Error: ${getErrorMessage(e)}`);
    } finally {
      setPosting(false);
    }
  };

  /* ===== Render ===== */
  const isError = msg ? msg.toLowerCase().includes("error") : false;
  return (
    <div className="mx-auto max-w-7xl pb-12">
      {/* Toolbar */}
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-neutral-500">
            <Receipt className="size-3.5" />
            Comprobantes de terceros
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
            Nuevo comprobante
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Registrá una factura, prestación o nota emitida por un tercero.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/terceros/comprobantes" className="gap-1.5">
            <ArrowLeft className="size-4" />
            Volver al listado
          </Link>
        </Button>
      </div>

      {msg && (
        <div
          className={`mb-4 flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${
            isError
              ? "border-rose-200 bg-rose-50 text-rose-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
          role="alert"
        >
          {isError ? (
            <AlertCircle className="mt-0.5 size-5 shrink-0" />
          ) : (
            <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
          )}
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

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Columna principal */}
        <div className="space-y-5 lg:col-span-2">
          {/* TERCERO + ROL */}
          <Card className="rounded-xl border-neutral-200 p-5">
            <SectionHeader
              icon={<Building2 className="size-4" />}
              title="Tercero"
              hint="Buscá por nombre o CUIT y elegí el rol con el que se imputa."
            />

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2" ref={acWrapRef}>
                <label className={labelCls}>
                  Tercero <Req />
                  {terceroSel && (
                    <span className="ml-1 font-normal text-neutral-400">
                      · {terceroSel.roles.join(", ")}
                    </span>
                  )}
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                  <Input
                    ref={inputRef}
                    className={`pl-9 pr-9 ${inputCls}`}
                    value={q}
                    aria-invalid={hasError("tercero") || undefined}
                    onChange={(e) => {
                      setQ(e.target.value);
                      setOpen(Boolean(e.target.value.trim()));
                      if (!e.target.value) setTerceroSel(null);
                    }}
                    onFocus={() => setOpen(Boolean(q.trim()))}
                    onKeyDown={onAutoKeyDown}
                    placeholder="Buscar por CUIT o nombre…"
                    aria-autocomplete="list"
                    aria-expanded={open}
                  />
                  {terceroSel && (
                    <button
                      type="button"
                      onClick={limpiarTercero}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-neutral-400 hover:text-neutral-700"
                      title="Limpiar selección"
                    >
                      <X className="size-4" />
                    </button>
                  )}

                  {open && (items.length > 0 || q.trim()) && (
                    <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-neutral-200 bg-white shadow-lg">
                      {items.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          className="flex w-full items-start justify-between gap-2 border-b border-neutral-100 px-3 py-2 text-left last:border-0 hover:bg-neutral-50"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => pick(t)}
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-neutral-900">
                              {t.nombre}
                              {t.fantasia && (
                                <span className="ml-1 font-normal text-neutral-400">
                                  ({t.fantasia})
                                </span>
                              )}
                            </div>
                            {t.cuit && (
                              <div className="text-xs text-neutral-500">
                                CUIT {t.cuit}
                              </div>
                            )}
                          </div>
                          <div className="flex shrink-0 flex-wrap justify-end gap-1">
                            {t.roles.map((r) => (
                              <Badge
                                key={r}
                                variant="outline"
                                className="text-[10px]"
                              >
                                {r}
                              </Badge>
                            ))}
                          </div>
                        </button>
                      ))}
                      {!items.length && q.trim() && (
                        <div className="px-3 py-4 text-center text-sm text-neutral-500">
                          Sin resultados para &quot;{q}&quot;
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <FieldError show={hasError("tercero")}>
                  Seleccioná un tercero del listado.
                </FieldError>
              </div>

              <div>
                <label className={labelCls}>Rol</label>
                <select
                  className={selectCls}
                  value={rol}
                  onChange={(e) => {
                    const next = e.target.value as RolTercero;
                    setRol(next);
                    if (terceroSel && !terceroSel.roles.includes(next)) {
                      setMsg(
                        `El tercero seleccionado no tiene rol ${next}. Roles disponibles: ${terceroSel.roles.join(
                          ", "
                        )}.`
                      );
                    } else {
                      setMsg(null);
                    }
                  }}
                >
                  <option value="PROVEEDOR">Proveedor</option>
                  <option value="PRESTADOR">Prestador</option>
                  <option value="COMERCIO">Comercio</option>
                </select>
              </div>
            </div>

            {terceroSel && (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-medical-100 bg-medical-50/60 px-3 py-2 text-xs text-medical-900">
                <CheckCircle2 className="size-4 text-medical-600" />
                <span className="font-medium">{terceroSel.nombre}</span>
                {terceroSel.cuit && (
                  <span className="text-medical-700/80">· CUIT {terceroSel.cuit}</span>
                )}
                <span className="ml-auto flex flex-wrap gap-1">
                  {terceroSel.roles.map((r) => (
                    <Badge key={r} variant="outline" className="border-medical-200 bg-white text-[10px] text-medical-700">
                      {r}
                    </Badge>
                  ))}
                </span>
              </div>
            )}
          </Card>

          {/* DATOS FISCALES */}
          <Card className="rounded-xl border-neutral-200 p-5">
            <SectionHeader
              icon={<FileText className="size-4" />}
              title="Datos del comprobante"
              hint="Punto de venta y número son obligatorios para todos los tipos."
            />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className={labelCls}>Tipo de comprobante <Req /></label>
                <select
                  className={selectCls}
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as TipoComprobante)}
                >
                  {(Object.keys(TIPO_LABEL) as TipoComprobante[]).map((k) => (
                    <option key={k} value={k}>
                      {TIPO_LABEL[k]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelCls}>Clase AFIP</label>
                <select
                  className={selectCls}
                  value={clase}
                  onChange={(e) => setClase(e.target.value as ClaseAFIP)}
                >
                  <option value="">(Ninguna)</option>
                  <option value="A">Clase A</option>
                  <option value="B">Clase B</option>
                  <option value="C">Clase C</option>
                  <option value="M">Clase M</option>
                  <option value="X">Clase X</option>
                </select>
              </div>

              <div>
                <label className={labelCls}>CUIT emisor</label>
                <Input
                  className={inputCls}
                  value={cuitEmisor}
                  onChange={(e) => setCuitEmisor(e.target.value)}
                  placeholder="20-12345678-9"
                />
              </div>

              <div>
                <label className={labelCls}>Punto de venta <Req /></label>
                <Input
                  className={inputCls}
                  type="number"
                  min={1}
                  max={9999}
                  value={puntoVenta}
                  aria-invalid={hasError("puntoVenta") || undefined}
                  onChange={(e) =>
                    setPV(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  placeholder="Ej: 1"
                />
                <FieldError show={hasError("puntoVenta")}>
                  Indicá el punto de venta (1 a 9999).
                </FieldError>
              </div>

              <div>
                <label className={labelCls}>Número <Req /></label>
                <Input
                  className={inputCls}
                  type="number"
                  min={1}
                  max={99999999}
                  value={numero}
                  aria-invalid={hasError("numero") || undefined}
                  onChange={(e) =>
                    setNumero(
                      e.target.value === "" ? "" : Number(e.target.value)
                    )
                  }
                  placeholder="Ej: 1234"
                />
                <FieldError show={hasError("numero")}>
                  Indicá el número del comprobante.
                </FieldError>
              </div>

              <div>
                <label className={labelCls}>Moneda</label>
                <Input
                  className={inputCls}
                  value={moneda}
                  onChange={(e) => setMoneda(e.target.value)}
                  placeholder="ARS"
                />
              </div>

              <div>
                <label className={labelCls}>Fecha <Req /></label>
                <Input
                  className={inputCls}
                  type="date"
                  value={fecha}
                  aria-invalid={hasError("fecha") || undefined}
                  onChange={(e) => setFecha(e.target.value)}
                />
              </div>

              <div>
                <label className={labelCls}>Vencimiento</label>
                <Input
                  className={inputCls}
                  type="date"
                  value={vencimiento}
                  onChange={(e) => setVenc(e.target.value)}
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-3">
                <label className={labelCls}>Observaciones</label>
                <Input
                  className={inputCls}
                  value={observaciones}
                  onChange={(e) => setObs(e.target.value)}
                  placeholder="Notas adicionales…"
                />
              </div>
            </div>
          </Card>

          {/* LÍNEAS */}
          <Card className="rounded-xl border-neutral-200 p-5">
            <SectionHeader
              icon={<ListChecks className="size-4" />}
              title="Líneas"
              hint="Detalle de items con IVA discriminado."
              action={
                <Button size="sm" onClick={addLinea} type="button" className="gap-1.5">
                  <Plus className="size-4" />
                  Agregar línea
                </Button>
              }
            />

            {lineas.length === 0 ? (
              <button
                type="button"
                onClick={addLinea}
                className="flex w-full flex-col items-center justify-center rounded-lg border border-dashed border-neutral-300 py-8 text-sm text-neutral-500 transition-colors hover:border-medical-300 hover:bg-medical-50/40 hover:text-medical-700"
              >
                <Plus className="mb-1 size-5" />
                Agregar la primera línea
              </button>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wider text-neutral-500">
                    <tr>
                      <th className="px-2 py-2">Descripción</th>
                      <th className="w-24 px-2 py-2 text-right">Cant.</th>
                      <th className="w-32 px-2 py-2 text-right">P. unitario</th>
                      <th className="w-32 px-2 py-2">IVA</th>
                      <th className="w-32 px-2 py-2 text-right">Subtotal</th>
                      <th className="w-12 px-2 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineas.map((l, i) => {
                      const descEmpty = touched && !l.descripcion.trim();
                      return (
                        <tr key={i} className="border-t border-neutral-100">
                          <td className="px-2 py-2 align-top">
                            <Input
                              className={inputCls}
                              value={l.descripcion}
                              aria-invalid={descEmpty || undefined}
                              onChange={(e) =>
                                updLinea(i, { descripcion: e.target.value })
                              }
                              placeholder="Descripción del item…"
                            />
                            {descEmpty && (
                              <p className="mt-1 text-[11px] text-rose-600">
                                La descripción es obligatoria.
                              </p>
                            )}
                          </td>
                          <td className="px-2 py-2 align-top">
                            <Input
                              className={`text-right ${inputCls}`}
                              type="number"
                              step="0.01"
                              min={0}
                              value={l.cantidad}
                              onChange={(e) =>
                                updLinea(i, { cantidad: Number(e.target.value) })
                              }
                            />
                          </td>
                          <td className="px-2 py-2 align-top">
                            <Input
                              className={`text-right ${inputCls}`}
                              type="number"
                              step="0.01"
                              min={0}
                              value={l.precioUnitario}
                              onChange={(e) =>
                                updLinea(i, {
                                  precioUnitario: Number(e.target.value),
                                })
                              }
                            />
                          </td>
                          <td className="px-2 py-2 align-top">
                            <select
                              className={selectCls}
                              value={String(l.alicuotaIVA ?? "")}
                              onChange={(e) =>
                                updLinea(i, {
                                  alicuotaIVA:
                                    e.target.value === ""
                                      ? null
                                      : Number(e.target.value),
                                })
                              }
                            >
                              <option value="">No gravado</option>
                              <option value="0">0% Exento</option>
                              <option value="10.5">10.5%</option>
                              <option value="21">21%</option>
                              <option value="27">27%</option>
                            </select>
                          </td>
                          <td className="px-2 py-2 text-right align-top font-mono tabular-nums text-neutral-700">
                            ${fmt(Number(l.cantidad || 0) * Number(l.precioUnitario || 0))}
                          </td>
                          <td className="px-2 py-2 text-center align-top">
                            <button
                              type="button"
                              onClick={() => delLinea(i)}
                              className="rounded p-1.5 text-neutral-400 hover:bg-rose-50 hover:text-rose-600"
                              title="Eliminar línea"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* IMPUESTOS */}
          <Card className="rounded-xl border-neutral-200 p-5">
            <SectionHeader
              icon={<Calculator className="size-4" />}
              title="Impuestos y percepciones"
              hint="Opcional. Sumá percepciones, retenciones o gastos administrativos."
              action={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={addImp}
                  type="button"
                  className="gap-1.5"
                >
                  <Plus className="size-4" />
                  Agregar concepto
                </Button>
              }
            />

            {impuestos.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wider text-neutral-500">
                    <tr>
                      <th className="px-2 py-2">Tipo</th>
                      <th className="px-2 py-2">Detalle</th>
                      <th className="w-28 px-2 py-2 text-right">Alíc. %</th>
                      <th className="w-32 px-2 py-2 text-right">Importe</th>
                      <th className="w-12 px-2 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {impuestos.map((it, i) => (
                      <tr key={i} className="border-t border-neutral-100">
                        <td className="px-2 py-2">
                          <select
                            className={selectCls}
                            value={it.tipo}
                            onChange={(e) =>
                              updImp(i, { tipo: e.target.value as ImpAdicTipo })
                            }
                          >
                            <option value="PERCEPCION_IIBB">Percepción IIBB</option>
                            <option value="RETENCION_IIBB">Retención IIBB</option>
                            <option value="PERCEPCION_IVA">Percepción IVA</option>
                            <option value="RETENCION_IVA">Retención IVA</option>
                            <option value="IMP_MUNICIPAL">Imp. Municipal</option>
                            <option value="IMP_INTERNO">Imp. Interno</option>
                            <option value="GASTO_ADMINISTRATIVO">Gasto Adm.</option>
                            <option value="OTRO">Otro</option>
                          </select>
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            className={inputCls}
                            value={it.detalle || ""}
                            onChange={(e) =>
                              updImp(i, { detalle: e.target.value })
                            }
                            placeholder="Descripción…"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            className={`text-right ${inputCls}`}
                            type="number"
                            step="0.01"
                            value={it.alicuota ?? ""}
                            onChange={(e) =>
                              updImp(i, {
                                alicuota:
                                  e.target.value === ""
                                    ? null
                                    : Number(e.target.value),
                              })
                            }
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            className={`text-right ${inputCls}`}
                            type="number"
                            step="0.01"
                            min={0}
                            value={it.importe}
                            onChange={(e) =>
                              updImp(i, { importe: Number(e.target.value) })
                            }
                          />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => delImp(i)}
                            className="rounded p-1.5 text-neutral-400 hover:bg-rose-50 hover:text-rose-600"
                            title="Eliminar concepto"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-neutral-500">
                Sin conceptos adicionales.
              </p>
            )}
          </Card>
        </div>

        {/* Columna lateral: totales sticky */}
        <div className="lg:col-span-1">
          <Card className="sticky top-4 overflow-hidden rounded-xl border-neutral-200 p-0">
            {/* Encabezado del resumen */}
            <div className="border-b border-neutral-200 bg-neutral-50/60 px-5 py-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-600">
                Resumen
              </h2>
            </div>

            <div className="space-y-3 px-5 py-4">
              <div className="space-y-1.5 text-sm">
                {totales.netoGrav21 > 0 && (
                  <Row label="Neto gravado 21%" value={totales.netoGrav21} />
                )}
                {totales.netoGrav105 > 0 && (
                  <Row label="Neto gravado 10.5%" value={totales.netoGrav105} />
                )}
                {totales.netoGrav27 > 0 && (
                  <Row label="Neto gravado 27%" value={totales.netoGrav27} />
                )}
                {totales.netoNoGrav > 0 && (
                  <Row label="No gravado" value={totales.netoNoGrav} />
                )}
                {totales.netoExento > 0 && (
                  <Row label="Exento" value={totales.netoExento} />
                )}
                <Row strong label="Subtotal" value={totales.subtotal} />
              </div>

              {(totales.iva21 > 0 || totales.iva105 > 0 || totales.iva27 > 0) && (
                <div className="space-y-1.5 border-t border-neutral-100 pt-3 text-sm">
                  {totales.iva21 > 0 && <Row label="IVA 21%" value={totales.iva21} />}
                  {totales.iva105 > 0 && <Row label="IVA 10.5%" value={totales.iva105} />}
                  {totales.iva27 > 0 && <Row label="IVA 27%" value={totales.iva27} />}
                </div>
              )}

              {totales.otros > 0 && (
                <div className="space-y-1.5 border-t border-neutral-100 pt-3 text-sm">
                  <Row label="Otros conceptos" value={totales.otros} />
                </div>
              )}
            </div>

            <div className="border-t border-neutral-200 bg-gradient-to-br from-medical-50 to-white px-5 py-4">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-medical-700">
                  Total
                </span>
                <span className="text-3xl font-bold tabular-nums text-medical-900">
                  ${fmt(totales.total)}
                </span>
              </div>
            </div>

            <div className="space-y-3 px-5 py-4">
              {touched && errores.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  <div className="mb-1.5 flex items-center gap-1.5 font-semibold">
                    <Info className="size-3.5" />
                    Faltan datos
                  </div>
                  <ul className="ml-1 list-inside list-disc space-y-0.5">
                    {errores.map((e, i) => (
                      <li key={i}>
                        <span className="font-medium">{e.label}:</span>{" "}
                        {e.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <Button
                onClick={submit}
                disabled={posting}
                type="button"
                className="w-full gap-2"
              >
                {posting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Procesando…
                  </>
                ) : (
                  <>
                    <Check className="size-4" />
                    Crear comprobante
                  </>
                )}
              </Button>

              {!touched && errores.length > 0 && (
                <p className="text-center text-xs text-neutral-500">
                  {errores.length} {errores.length === 1 ? "campo pendiente" : "campos pendientes"} de completar.
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ===== Subcomponentes ===== */
function SectionHeader({
  icon,
  title,
  hint,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 flex size-7 items-center justify-center rounded-md bg-medical-50 text-medical-700">
          {icon}
        </div>
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
          {hint && <p className="text-xs text-neutral-500">{hint}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

function Req() {
  return <span className="text-rose-500" aria-hidden>*</span>;
}

function FieldError({
  show,
  children,
}: {
  show: boolean;
  children: React.ReactNode;
}) {
  if (!show) return null;
  return <p className="mt-1 text-[11px] text-rose-600">{children}</p>;
}

/** Estilos compartidos. */
const labelCls = "mb-1 block text-xs font-medium text-neutral-600";
const inputCls = "h-9 rounded-lg";
const selectCls =
  "h-9 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm transition-colors hover:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-medical-500";

/** Fila etiqueta/valor del panel de totales. */
function Row({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span
        className={
          strong
            ? "text-xs font-semibold uppercase tracking-wider text-neutral-700"
            : "text-neutral-500"
        }
      >
        {label}
      </span>
      <span
        className={
          strong
            ? "font-mono text-sm font-semibold tabular-nums text-neutral-900"
            : "font-mono tabular-nums text-neutral-700"
        }
      >
        ${fmt(value)}
      </span>
    </div>
  );
}
