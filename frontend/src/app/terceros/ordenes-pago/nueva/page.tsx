/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  CreditCard,
  DollarSign,
  Download,
  Eye,
  FileText,
  Loader2,
  Plus,
  Printer,
  Receipt,
  RefreshCw,
  Search,
  Trash2,
  User,
  Wallet,
  X,
} from "lucide-react";
import Swal from "sweetalert2";
import {
  api,
  downloadPdf,
  getErrorMessage,
  openPdf,
  ORG,
} from "@/servicios/api";
import { formatearFechaArgentina } from "@/utiles/formatos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/* ================== Tipos ================== */
type RolTercero =
  | "PROVEEDOR"
  | "PRESTADOR"
  | "COMERCIO"
  | "AFILIADO"
  | "OTRO"
  | "REINTEGROS";
type MetodoPago = "transferencia" | "cheque" | "efectivo" | "otro";

type AfiliadoSuggest = {
  id: string;
  dni: string;
  apellido?: string | null;
  nombre?: string | null;
  display: string;
};

type Metodo = { metodo: MetodoPago; monto: number; ref?: string };
type Aplic = {
  comprobanteId: string;
  numero?: string | null;
  fecha?: string;
  total?: number;
  aplicadoPrevio?: number;
  saldo?: number;
  montoAplicado: number;
};

type TerceroLite = {
  id: string;
  nombre: string;
  fantasia?: string | null;
  cuit?: string | null;
  codigo?: string | null;
  activo: boolean;
};

type Pendiente = {
  id: string;
  tipo: string;
  clase?: string | null;
  numero?: string | null;
  fecha: string;
  total: number;
  aplicadoPrevio: number;
  saldo: number;
};

/* ================== Helpers ================== */
const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);

const inputCls = "h-9 rounded-lg border-neutral-200";
const selectCls =
  "h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-medical-500";
const labelCls = "mb-1 block text-xs font-medium text-neutral-600";

function useDebounced<T>(value: T, delay = 300) {
  const [deb, setDeb] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDeb(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return deb;
}

/* ================== Autocomplete Tercero ================== */
function AutocompleteTercero({
  rol,
  onSelect,
  selectedTercero,
}: {
  rol: RolTercero;
  onSelect: (t: TerceroLite | null) => void;
  selectedTercero: TerceroLite | null;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<TerceroLite[]>([]);
  const debQ = useDebounced(q, 300);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedTercero) {
      const label = `${selectedTercero.nombre}${selectedTercero.fantasia ? ` (${selectedTercero.fantasia})` : ""}${selectedTercero.cuit ? ` · CUIT ${selectedTercero.cuit}` : ""}`;
      setQ(label);
    }
  }, [selectedTercero]);

  useEffect(() => {
    if (!debQ.trim()) {
      setItems([]);
      return;
    }
    setLoading(true);
    const fetchData = async () => {
      try {
        const data = await api<TerceroLite[]>(
          `/terceros/buscar?q=${encodeURIComponent(debQ.trim())}&rol=${rol}&limit=20`
        );
        setItems(Array.isArray(data) ? data : []);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [debQ, rol]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const handleSelect = (t: TerceroLite) => {
    onSelect(t);
    setOpen(false);
  };

  const handleClear = () => {
    onSelect(null);
    setQ("");
    setOpen(false);
  };

  return (
    <div ref={wrapperRef}>
      <label className={labelCls}>
        Tercero <span className="text-rose-500">*</span>
        {selectedTercero?.cuit && (
          <span className="ml-1 font-normal text-neutral-400">
            · CUIT {selectedTercero.cuit}
          </span>
        )}
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
        <Input
          className={`${inputCls} pl-9 pr-9`}
          value={q}
          onFocus={() => setOpen(Boolean(debQ.trim()))}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(Boolean(e.target.value.trim()));
            if (!e.target.value) onSelect(null);
          }}
          placeholder={
            rol === "AFILIADO"
              ? "Buscar por nombre, DNI o padrón…"
              : "Buscar por CUIT o nombre…"
          }
        />
        {selectedTercero && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-neutral-400 hover:text-neutral-700"
            title="Limpiar selección"
          >
            <X className="size-4" />
          </button>
        )}

        {open && (loading || items.length > 0 || debQ.trim()) && (
          <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-neutral-200 bg-white shadow-lg">
            {loading && (
              <div className="flex items-center gap-2 px-3 py-2.5 text-sm text-neutral-500">
                <Loader2 className="size-4 animate-spin" />
                Buscando…
              </div>
            )}
            {!loading &&
              items.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="flex w-full items-start justify-between gap-2 border-b border-neutral-100 px-3 py-2 text-left last:border-0 hover:bg-neutral-50"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(t)}
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
                      <div className="font-mono text-xs text-neutral-500">
                        CUIT {t.cuit}
                      </div>
                    )}
                  </div>
                  <span
                    className={`shrink-0 text-[10px] font-medium ${t.activo ? "text-emerald-600" : "text-neutral-400"}`}
                  >
                    {t.activo ? "Activo" : "Inactivo"}
                  </span>
                </button>
              ))}
            {!loading && items.length === 0 && debQ.trim() && (
              <div className="px-3 py-4 text-center text-sm text-neutral-500">
                Sin resultados para &quot;{debQ}&quot;
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ================== Autocomplete Afiliado ================== */
function AutocompleteAfiliado({
  onSelect,
  selectedAfiliado,
}: {
  onSelect: (a: AfiliadoSuggest | null) => void;
  selectedAfiliado: AfiliadoSuggest | null;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<AfiliadoSuggest[]>([]);
  const debQ = useDebounced(q, 300);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedAfiliado) setQ(selectedAfiliado.display);
  }, [selectedAfiliado]);

  useEffect(() => {
    if (!debQ.trim() || debQ.trim().length < 2) {
      setItems([]);
      return;
    }
    setLoading(true);
    const fetchData = async () => {
      try {
        const data = await api<AfiliadoSuggest[]>(
          `/afiliados/suggest?q=${encodeURIComponent(debQ.trim())}`
        );
        setItems(Array.isArray(data) ? data : []);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [debQ]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const handleSelect = (a: AfiliadoSuggest) => {
    onSelect(a);
    setQ(a.display);
    setOpen(false);
  };

  const handleClear = () => {
    onSelect(null);
    setQ("");
    setOpen(false);
  };

  return (
    <div ref={wrapperRef}>
      <label className={labelCls}>
        Afiliado <span className="text-rose-500">*</span>
        {selectedAfiliado && (
          <span className="ml-1 font-normal text-neutral-400">
            · DNI {selectedAfiliado.dni}
          </span>
        )}
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
        <Input
          className={`${inputCls} pl-9 pr-9`}
          value={q}
          onFocus={() =>
            setOpen(Boolean(debQ.trim() && debQ.trim().length >= 2))
          }
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(Boolean(e.target.value.trim().length >= 2));
            if (!e.target.value) onSelect(null);
          }}
          placeholder="Buscar por nombre, DNI o padrón…"
        />
        {selectedAfiliado && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-neutral-400 hover:text-neutral-700"
            title="Limpiar selección"
          >
            <X className="size-4" />
          </button>
        )}
        {open && (loading || items.length > 0 || debQ.trim().length >= 2) && (
          <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-neutral-200 bg-white shadow-lg">
            {loading && (
              <div className="flex items-center gap-2 px-3 py-2.5 text-sm text-neutral-500">
                <Loader2 className="size-4 animate-spin" />
                Buscando…
              </div>
            )}
            {!loading &&
              items.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className="flex w-full items-start justify-between gap-2 border-b border-neutral-100 px-3 py-2 text-left last:border-0 hover:bg-neutral-50"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(a)}
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-neutral-900">
                      {a.display}
                    </div>
                    <div className="font-mono text-xs text-neutral-500">
                      DNI {a.dni}
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="shrink-0 border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700"
                  >
                    Afiliado
                  </Badge>
                </button>
              ))}
            {!loading && items.length === 0 && debQ.trim().length >= 2 && (
              <div className="px-3 py-4 text-center text-sm text-neutral-500">
                Sin resultados para &quot;{debQ}&quot;
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ================== Helpers de carga de reintegros ================== */
function mapReintegrosToPendientes(items: any[]): Pendiente[] {
  const filtered = items.filter((r: any) => {
    if (r.estado === "PAGADO") return false;
    const montoReintegro =
      r.importeReintegro != null
        ? Number(r.importeReintegro)
        : r.importeAprobado != null
          ? Number(r.importeAprobado)
          : Number(r.importeTotal ?? 0);
    const totalPagado = (r.pagos ?? []).reduce(
      (acc: number, p: any) => acc + Number(p.monto ?? 0),
      0
    );
    const saldo = Math.max(0, montoReintegro - totalPagado);
    const tienePagosConOrden =
      r.pagos && r.pagos.some((p: any) => p.ordenPagoId);
    if (tienePagosConOrden) return false;
    return saldo > 0.000001;
  });

  return filtered.map((r: any) => {
    const montoReintegro =
      r.importeReintegro != null
        ? Number(r.importeReintegro)
        : r.importeAprobado != null
          ? Number(r.importeAprobado)
          : Number(r.importeTotal ?? 0);
    const totalPagado = (r.pagos ?? []).reduce(
      (acc: number, p: any) => acc + Number(p.monto ?? 0),
      0
    );
    const aplicadoPrevio = (r.pagos ?? [])
      .filter((p: any) => !p.ordenPagoId)
      .reduce((acc: number, p: any) => acc + Number(p.monto ?? 0), 0);
    const saldo = Math.max(0, montoReintegro - totalPagado);
    return {
      id: `REINTEGRO-${r.id}`,
      tipo: "PRESTACION",
      clase: null,
      numero: `REINT-${r.id}`,
      fecha:
        r.fechaFactura || r.fechaPresentacion || new Date().toISOString(),
      total: montoReintegro,
      aplicadoPrevio,
      saldo,
    };
  });
}

/* ================== Página Principal ================== */
export default function NuevaOrdenPagoPage() {
  const [organizacionId, setOrg] = useState(ORG);
  const [rol, setRol] = useState<RolTercero>("PROVEEDOR");
  const [fecha, setFecha] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [observaciones, setObs] = useState("");

  const [tercero, setTercero] = useState<TerceroLite | null>(null);
  const [afiliadoSeleccionado, setAfiliadoSeleccionado] =
    useState<AfiliadoSuggest | null>(null);

  const [metodos, setMetodos] = useState<Metodo[]>([
    { metodo: "transferencia", monto: 0 },
  ]);
  const [aplicaciones, setAplics] = useState<Aplic[]>([]);

  const [pendLoading, setPendLoading] = useState(false);
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  // Comprobante generado
  const [compId, setCompId] = useState<string | null>(null);
  const [compNumero, setCompNumero] = useState<string | null>(null);
  const [compFilename, setCompFilename] = useState<string | null>(null);

  const totalMetodos = useMemo(
    () => metodos.reduce((a, m) => a + Number(m.monto || 0), 0),
    [metodos]
  );
  const totalAplic = useMemo(
    () => aplicaciones.reduce((a, ap) => a + Number(ap.montoAplicado || 0), 0),
    [aplicaciones]
  );
  const difTotales = totalMetodos - totalAplic;
  const balanceado = Math.round(difTotales * 100) === 0;

  const canSubmit =
    !!organizacionId &&
    ((rol === "REINTEGROS" && !!afiliadoSeleccionado) ||
      (rol !== "REINTEGROS" && !!tercero)) &&
    pendientes.length > 0 &&
    metodos.length > 0 &&
    aplicaciones.length > 0 &&
    balanceado &&
    !posting;

  const parseMessage = (message: string | null) => {
    if (!message) return null;
    if (message.startsWith("SUCCESS:"))
      return { type: "success" as const, content: message.substring(8) };
    if (message.startsWith("ERROR:"))
      return { type: "error" as const, content: message.substring(6) };
    if (message.startsWith("INFO:"))
      return { type: "info" as const, content: message.substring(5) };
    return {
      type:
        message.includes("Error") || message.includes("❌")
          ? ("error" as const)
          : ("success" as const),
      content: message.replace(/^(✅|❌)\s*/, ""),
    };
  };
  const messageInfo = parseMessage(msg);

  // Cargar pendientes cuando hay tercero+rol, o afiliado para REINTEGROS
  useEffect(() => {
    const load = async () => {
      if (rol === "REINTEGROS") {
        if (!afiliadoSeleccionado) {
          setPendientes([]);
          setAplics([]);
          return;
        }
        setPendLoading(true);
        setMsg(null);
        try {
          const raw = await api<{ items: any[] }>(
            `/reintegros/solicitudes?afiliadoId=${afiliadoSeleccionado.id}&estado=APROBADO&pageSize=200`
          );
          const data = mapReintegrosToPendientes(raw?.items ?? []);
          setPendientes(data.filter((p) => p.saldo > 0.000001));
          setAplics((prev) =>
            prev.filter((ap) => data.some((p) => p.id === ap.comprobanteId))
          );
        } catch (e) {
          setMsg(`ERROR:Error al cargar reintegros: ${getErrorMessage(e)}`);
          setPendientes([]);
        } finally {
          setPendLoading(false);
        }
      } else {
        if (!tercero) {
          setPendientes([]);
          setAplics([]);
          return;
        }
        setPendLoading(true);
        setMsg(null);
        try {
          const raw = await api<any[]>(
            `/terceros/comprobantes/pendientes?terceroId=${tercero.id}&rol=${rol}&limit=200`
          );
          const data: Pendiente[] = (raw ?? []).map((p) => ({
            id: String(p.id),
            tipo: p.tipo,
            clase: p.clase ?? null,
            numero: p.numero ?? null,
            fecha: p.fecha,
            total: Number(p.total ?? 0),
            aplicadoPrevio: Number(p.aplicadoPrevio ?? 0),
            saldo: Number(p.saldo ?? 0),
          }));
          setPendientes(data);
          setAplics((prev) =>
            prev.filter((ap) => data.some((p) => p.id === ap.comprobanteId))
          );
        } catch (e) {
          setMsg(`ERROR:Error al cargar pendientes: ${getErrorMessage(e)}`);
          setPendientes([]);
        } finally {
          setPendLoading(false);
        }
      }
    };
    void load();
  }, [tercero, rol, afiliadoSeleccionado]);

  /* ================== Handlers ================== */
  const addMetodo = () =>
    setMetodos((x) => [...x, { metodo: "efectivo", monto: 0 }]);
  const delMetodo = (i: number) =>
    setMetodos((x) => x.filter((_, idx) => idx !== i));
  const updMetodo = (i: number, patch: Partial<Metodo>) =>
    setMetodos((x) =>
      x.map((row, idx) => (idx === i ? { ...row, ...patch } : row))
    );

  const pickPendiente = (p: Pendiente) => {
    if (aplicaciones.some((a) => a.comprobanteId === p.id)) return;
    setAplics((x) => [
      ...x,
      {
        comprobanteId: p.id,
        numero: p.numero ?? null,
        fecha: p.fecha,
        total: Number(p.total ?? 0),
        aplicadoPrevio: Number(p.aplicadoPrevio ?? 0),
        saldo: Number(p.saldo ?? 0),
        montoAplicado: Number(p.saldo ?? 0),
      },
    ]);
  };

  const delAplic = (i: number) =>
    setAplics((x) => x.filter((_, idx) => idx !== i));
  const updAplic = (i: number, patch: Partial<Aplic>) =>
    setAplics((x) =>
      x.map((row, idx) => {
        if (idx !== i) return row;
        const next = { ...row, ...patch };
        const max = Number(row.saldo ?? 0);
        if (next.montoAplicado > max) next.montoAplicado = max;
        if (next.montoAplicado < 0) next.montoAplicado = 0;
        return next;
      })
    );

  const autobalance = () => {
    // distribuye el monto total de aplicaciones en el primer método de pago,
    // limpiando los demás. Útil para "1 click" cuando sobra/falta.
    if (!aplicaciones.length) return;
    const total = totalAplic;
    setMetodos((prev) => {
      if (!prev.length) return [{ metodo: "transferencia", monto: total }];
      return prev.map((m, i) =>
        i === 0 ? { ...m, monto: total } : { ...m, monto: 0 }
      );
    });
  };

  const aplicarTodos = () => {
    const yaAplicados = new Set(aplicaciones.map((a) => a.comprobanteId));
    const nuevos = pendientes
      .filter((p) => !yaAplicados.has(p.id))
      .map((p) => ({
        comprobanteId: p.id,
        numero: p.numero ?? null,
        fecha: p.fecha,
        total: Number(p.total ?? 0),
        aplicadoPrevio: Number(p.aplicadoPrevio ?? 0),
        saldo: Number(p.saldo ?? 0),
        montoAplicado: Number(p.saldo ?? 0),
      }));
    if (nuevos.length) setAplics((x) => [...x, ...nuevos]);
  };

  const resetAll = () => {
    setMsg(null);
    setCompId(null);
    setCompNumero(null);
    setCompFilename(null);
    setOrg(ORG);
    setRol("PROVEEDOR");
    setFecha(new Date().toISOString().slice(0, 10));
    setObs("");
    setTercero(null);
    setAfiliadoSeleccionado(null);
    setMetodos([{ metodo: "transferencia", monto: 0 }]);
    setAplics([]);
    setPendientes([]);
  };

  const submit = async () => {
    try {
      setPosting(true);
      setMsg(null);
      if (!organizacionId) throw new Error("Falta organización");
      if (!rol) throw new Error("Seleccioná rol");

      let terceroIdFinal: string;
      let rolFinal: RolTercero;

      if (rol === "REINTEGROS") {
        if (!afiliadoSeleccionado) throw new Error("Seleccioná un afiliado");
        const codigo = `AFI-${afiliadoSeleccionado.id}`;
        const tercerosRes = await api<TerceroLite[]>(
          `/terceros/buscar?q=${encodeURIComponent(codigo)}&rol=AFILIADO&limit=10`
        );
        const terceroEncontrado = Array.isArray(tercerosRes)
          ? tercerosRes.find((t) => t.codigo === codigo)
          : null;
        if (!terceroEncontrado) {
          throw new Error(
            `No se pudo obtener o crear el tercero del afiliado. Código: ${codigo}`
          );
        }
        terceroIdFinal = terceroEncontrado.id;
        rolFinal = "AFILIADO";
      } else {
        if (!tercero) throw new Error("Seleccioná un tercero");
        terceroIdFinal = tercero.id;
        rolFinal = rol;
      }

      if (pendientes.length === 0)
        throw new Error(
          rol === "REINTEGROS"
            ? "No hay reintegros aprobados para este afiliado."
            : "No hay comprobantes pendientes para este tercero/rol."
        );
      if (metodos.length === 0)
        throw new Error("Agregá al menos un método de pago");
      if (aplicaciones.length === 0)
        throw new Error("Agregá al menos una aplicación");
      if (Math.round(totalMetodos * 100) !== Math.round(totalAplic * 100)) {
        throw new Error(
          `Los métodos ($${fmt(totalMetodos)}) deben sumar igual que las aplicaciones ($${fmt(totalAplic)}).`
        );
      }

      const payload = {
        organizacionId,
        terceroId: terceroIdFinal,
        rol: rolFinal,
        fecha,
        observaciones: observaciones || null,
        metodos: metodos.map((m) => ({
          metodo: m.metodo.toUpperCase(),
          monto: Number(m.monto || 0),
          ref: m.ref || null,
        })),
        aplicaciones: aplicaciones.map((ap) => ({
          comprobanteId: ap.comprobanteId,
          montoAplicado: Number(ap.montoAplicado || 0),
        })),
      };

      const r = await api<{
        id: number | string;
        comprobanteId: string;
        comprobanteNumero: string;
        filename?: string;
      }>("/terceros/ordenes-pago", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setCompId(String(r.comprobanteId));
      setCompNumero(r.comprobanteNumero ?? null);
      setCompFilename(r.filename ?? null);

      const htmlContent = `
        <div style="text-align:left;font-size:14px;">
          <div style="background:#ecfdf5;border:1px solid #10b981;border-radius:8px;padding:16px;margin-bottom:20px;">
            <h4 style="margin:0 0 12px 0;color:#059669;">✅ Orden de Pago Creada</h4>
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
              <span style="color:#047857;">N° Orden</span>
              <strong style="color:#059669;font-family:monospace;">#${r.id}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
              <span style="color:#047857;">Comprobante</span>
              <strong style="color:#059669;font-family:monospace;">${
                r.comprobanteNumero
                  ? "N° " + r.comprobanteNumero
                  : `ID ${r.comprobanteId}`
              }</strong>
            </div>
            <div style="display:flex;justify-content:space-between;border-top:2px solid #10b981;padding-top:8px;margin-top:12px;">
              <span style="color:#047857;font-size:16px;">Total</span>
              <strong style="color:#059669;font-size:18px;font-family:monospace;">$${fmt(totalMetodos)}</strong>
            </div>
          </div>
        </div>`;

      await Swal.fire({
        title: "✅ Orden de Pago Creada",
        html: htmlContent,
        icon: "success",
        width: "560px",
        showCancelButton: true,
        showDenyButton: true,
        showConfirmButton: true,
        confirmButtonText: "🖨️ Imprimir",
        denyButtonText: "📥 Descargar PDF",
        cancelButtonText: "🔄 Nueva Orden",
        allowOutsideClick: true,
        allowEscapeKey: true,
      }).then(async (result) => {
        if (result.isConfirmed) {
          try {
            await openPdf(
              `/comprobantes/${r.comprobanteId}/pdf?disposition=inline&organizacionId=${organizacionId}`
            );
          } catch (error) {
            Swal.fire({
              title: "Error",
              text: getErrorMessage(error),
              icon: "error",
            });
          }
        } else if (result.isDenied) {
          try {
            await downloadPdf(
              `/comprobantes/${r.comprobanteId}/pdf?disposition=attachment&organizacionId=${organizacionId}`,
              r.filename ||
                `orden-pago-${r.comprobanteNumero || r.comprobanteId}.pdf`
            );
          } catch (error) {
            Swal.fire({
              title: "Error",
              text: getErrorMessage(error),
              icon: "error",
            });
          }
        } else if (result.dismiss === Swal.DismissReason.cancel) {
          resetAll();
        }
      });

      // Refrescar pendientes y limpiar formulario
      if (rol === "REINTEGROS" && afiliadoSeleccionado) {
        const raw = await api<{ items: any[] }>(
          `/reintegros/solicitudes?afiliadoId=${afiliadoSeleccionado.id}&estado=APROBADO&pageSize=200`
        );
        const data = mapReintegrosToPendientes(raw?.items ?? []);
        setPendientes(data.filter((p) => p.saldo > 0.000001));
      } else if (tercero) {
        const raw = await api<any[]>(
          `/terceros/comprobantes/pendientes?terceroId=${tercero.id}&rol=${rol}&limit=200`
        );
        const data: Pendiente[] = (raw ?? []).map((p) => ({
          id: String(p.id),
          tipo: p.tipo,
          clase: p.clase ?? null,
          numero: p.numero ?? null,
          fecha: p.fecha,
          total: Number(p.total ?? 0),
          aplicadoPrevio: Number(p.aplicadoPrevio ?? 0),
          saldo: Number(p.saldo ?? 0),
        }));
        setPendientes(data);
      }
      setAplics([]);
      setMetodos([{ metodo: "transferencia", monto: 0 }]);
      setObs("");
    } catch (e) {
      const errorMsg = getErrorMessage(e);
      setMsg(`ERROR:${errorMsg}`);
      await Swal.fire({
        title: "❌ Error al Crear Orden de Pago",
        html: `<div style="text-align:left;font-size:14px;"><div style="background:#fef2f2;border:1px solid #ef4444;border-radius:8px;padding:16px;"><p style="margin:0;color:#991b1b;font-weight:500;">${errorMsg.replace(/\n/g, "<br>")}</p></div></div>`,
        icon: "error",
        width: "500px",
        confirmButtonText: "Cerrar",
      });
      setTimeout(
        () => window.scrollTo({ top: 0, behavior: "smooth" }),
        100
      );
    } finally {
      setPosting(false);
    }
  };

  const handlePrint = async () => {
    if (!compId) return;
    try {
      await openPdf(
        `/comprobantes/${compId}/pdf?disposition=inline&organizacionId=${organizacionId}`
      );
    } catch (error) {
      setMsg(`ERROR:${getErrorMessage(error)}`);
    }
  };
  const handleDownload = async () => {
    if (!compId) return;
    try {
      await downloadPdf(
        `/comprobantes/${compId}/pdf?disposition=attachment&organizacionId=${organizacionId}`,
        compFilename || `orden-pago-${compNumero || compId}.pdf`
      );
    } catch (error) {
      setMsg(`ERROR:${getErrorMessage(error)}`);
    }
  };

  const metodoIcon = (m: MetodoPago) => {
    switch (m) {
      case "transferencia":
        return <Building2 className="size-4" />;
      case "cheque":
        return <Receipt className="size-4" />;
      case "efectivo":
        return <DollarSign className="size-4" />;
      default:
        return <CreditCard className="size-4" />;
    }
  };

  const submitHelp = !canSubmit
    ? rol === "REINTEGROS"
      ? !afiliadoSeleccionado
        ? "Seleccioná un afiliado"
        : pendientes.length === 0
          ? "No hay reintegros aprobados"
          : aplicaciones.length === 0
            ? "Agregá al menos una aplicación"
            : !balanceado
              ? "Los totales no coinciden"
              : "Completá los campos requeridos"
      : !tercero
        ? "Seleccioná un tercero"
        : pendientes.length === 0
          ? "No hay comprobantes pendientes"
          : aplicaciones.length === 0
            ? "Agregá al menos una aplicación"
            : !balanceado
              ? "Los totales no coinciden"
              : "Completá los campos requeridos"
    : null;

  return (
    <div className="mx-auto max-w-7xl">
      {/* Toolbar */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-neutral-900">
          Nueva orden de pago
        </h1>
        <Button variant="outline" size="sm" asChild>
          <Link href="/terceros/ordenes-pago" className="gap-1.5">
            <ArrowLeft className="size-4" />
            Volver al listado
          </Link>
        </Button>
      </div>

      {/* Mensaje */}
      {messageInfo && (
        <div
          className={`mb-4 flex items-center gap-3 rounded-lg border px-4 py-3 text-sm ${
            messageInfo.type === "error"
              ? "border-rose-200 bg-rose-50 text-rose-800"
              : messageInfo.type === "info"
                ? "border-blue-200 bg-blue-50 text-blue-800"
                : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
          role="alert"
        >
          {messageInfo.type === "error" ? (
            <AlertCircle className="size-5 shrink-0" />
          ) : (
            <CheckCircle2 className="size-5 shrink-0" />
          )}
          <span className="font-medium">{messageInfo.content}</span>
          <button
            onClick={() => setMsg(null)}
            className="ml-auto rounded p-1 hover:bg-black/5"
            aria-label="Cerrar"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Comprobante generado (panel premium) */}
      {compId && (
        <Card className="mb-4 rounded-xl border-emerald-300 bg-emerald-50/60 p-5 ring-1 ring-emerald-200">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 className="size-5" />
                <h2 className="text-base font-semibold">
                  Orden de pago creada
                </h2>
              </div>
              <p className="mt-1 text-sm text-emerald-700/80">
                {compNumero ? `Comprobante N° ${compNumero}` : `ID ${compId}`}
                {compFilename && (
                  <span className="font-mono"> · {compFilename}</span>
                )}
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-wider text-emerald-700/70">
                Total
              </div>
              <div className="text-2xl font-bold tabular-nums text-emerald-700">
                ${fmt(totalMetodos)}
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button onClick={handlePrint} size="sm" className="gap-1.5">
              <Printer className="size-4" />
              Imprimir
            </Button>
            <Button
              onClick={handleDownload}
              size="sm"
              variant="outline"
              className="gap-1.5"
            >
              <Download className="size-4" />
              Descargar PDF
            </Button>
            <Button
              onClick={handlePrint}
              size="sm"
              variant="outline"
              className="gap-1.5"
            >
              <Eye className="size-4" />
              Ver
            </Button>
            <Button
              onClick={resetAll}
              size="sm"
              variant="ghost"
              className="ml-auto gap-1.5"
            >
              <RefreshCw className="size-4" />
              Nueva orden
            </Button>
          </div>
        </Card>
      )}

      {/* Layout 2 columnas: formulario + panel sticky */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Columna principal */}
        <div className="space-y-4 lg:col-span-2">
          {/* Información general */}
          <Card className="rounded-xl border-neutral-200 p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-neutral-500">
              <FileText className="size-4 text-neutral-400" />
              Información general
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Tercero / Afiliado (ocupa los 2 col en mobile, 1 en desktop) */}
              <div className="sm:col-span-2">
                {rol === "REINTEGROS" ? (
                  <AutocompleteAfiliado
                    onSelect={setAfiliadoSeleccionado}
                    selectedAfiliado={afiliadoSeleccionado}
                  />
                ) : (
                  <AutocompleteTercero
                    rol={rol}
                    onSelect={setTercero}
                    selectedTercero={tercero}
                  />
                )}
              </div>

              <div>
                <label className={labelCls}>Rol del tercero</label>
                <select
                  className={selectCls}
                  value={rol}
                  onChange={(e) => {
                    const newRol = e.target.value as RolTercero;
                    setRol(newRol);
                    if (newRol !== "REINTEGROS") setAfiliadoSeleccionado(null);
                    if (newRol !== rol && newRol !== "REINTEGROS")
                      setTercero(null);
                  }}
                >
                  <option value="PROVEEDOR">Proveedor</option>
                  <option value="PRESTADOR">Prestador</option>
                  <option value="COMERCIO">Comercio</option>
                  <option value="AFILIADO">Afiliado</option>
                  <option value="REINTEGROS">Reintegros</option>
                  <option value="OTRO">Otro</option>
                </select>
              </div>

              <div>
                <label className={labelCls}>
                  <Calendar className="mr-1 inline size-3" />
                  Fecha
                </label>
                <Input
                  className={inputCls}
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                />
              </div>

              <div className="sm:col-span-2">
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

          {/* Pendientes */}
          <Card className="rounded-xl border-neutral-200 p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-neutral-500">
                <Receipt className="size-4 text-neutral-400" />
                Comprobantes pendientes
              </h2>
              <div className="flex items-center gap-2">
                {pendLoading && (
                  <span className="flex items-center gap-1 text-xs text-neutral-500">
                    <Loader2 className="size-3 animate-spin" />
                    Cargando…
                  </span>
                )}
                <Badge variant="outline" className="text-[10px]">
                  {pendientes.length} pendientes
                </Badge>
                {pendientes.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={aplicarTodos}
                    className="h-7 gap-1.5 text-xs"
                  >
                    <Check className="size-3" />
                    Aplicar todos
                  </Button>
                )}
              </div>
            </div>

            {(rol === "REINTEGROS" && afiliadoSeleccionado) ||
            (rol !== "REINTEGROS" && tercero) ? (
              pendientes.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs uppercase tracking-wider text-neutral-500">
                      <tr className="border-b border-neutral-200">
                        <th className="px-2 py-2">Fecha</th>
                        <th className="px-2 py-2">Tipo</th>
                        <th className="px-2 py-2">Número</th>
                        <th className="px-2 py-2 text-right">Total</th>
                        <th className="px-2 py-2 text-right">Aplicado</th>
                        <th className="px-2 py-2 text-right">Saldo</th>
                        <th className="px-2 py-2 text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {pendientes.map((p) => {
                        const isApplied = aplicaciones.some(
                          (a) => a.comprobanteId === p.id
                        );
                        const esReintegro = p.id.startsWith("REINTEGRO-");
                        return (
                          <tr
                            key={p.id}
                            className={
                              isApplied ? "bg-emerald-50/50" : "hover:bg-neutral-50/60"
                            }
                          >
                            <td className="whitespace-nowrap px-2 py-2 text-neutral-600">
                              {formatearFechaArgentina(p.fecha)}
                            </td>
                            <td className="px-2 py-2">
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${
                                  esReintegro
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                    : "border-blue-200 bg-blue-50 text-blue-700"
                                }`}
                              >
                                {esReintegro ? "Reintegro" : p.tipo}
                              </Badge>
                            </td>
                            <td className="px-2 py-2 font-mono text-xs text-neutral-600">
                              {p.numero || "—"}
                            </td>
                            <td className="px-2 py-2 text-right font-mono tabular-nums text-neutral-700">
                              ${fmt(p.total)}
                            </td>
                            <td className="px-2 py-2 text-right font-mono tabular-nums text-neutral-500">
                              ${fmt(p.aplicadoPrevio)}
                            </td>
                            <td className="px-2 py-2 text-right font-mono font-semibold tabular-nums text-neutral-900">
                              ${fmt(p.saldo)}
                            </td>
                            <td className="px-2 py-2 text-right">
                              <Button
                                size="sm"
                                variant={isApplied ? "ghost" : "default"}
                                className="h-7 gap-1.5 px-2 text-xs"
                                onClick={() => pickPendiente(p)}
                                disabled={isApplied}
                                type="button"
                              >
                                {isApplied ? (
                                  <>
                                    <CheckCircle2 className="size-3" />
                                    Aplicado
                                  </>
                                ) : (
                                  <>
                                    <Plus className="size-3" />
                                    Aplicar
                                  </>
                                )}
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4 text-center">
                  <AlertCircle className="mx-auto mb-2 size-6 text-amber-600" />
                  <p className="text-sm font-medium text-amber-800">
                    Sin comprobantes pendientes
                  </p>
                  <p className="mt-1 text-xs text-amber-700">
                    No hay comprobantes con saldo para este tercero/rol.
                  </p>
                </div>
              )
            ) : (
              <div className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50/60 p-6 text-center">
                <User className="mx-auto mb-2 size-6 text-neutral-400" />
                <p className="text-sm font-medium text-neutral-700">
                  {rol === "REINTEGROS"
                    ? "Seleccioná un afiliado"
                    : "Seleccioná un tercero"}
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  {rol === "REINTEGROS"
                    ? "Buscalo arriba para ver sus reintegros aprobados."
                    : "Buscalo arriba para ver sus comprobantes pendientes."}
                </p>
              </div>
            )}
          </Card>

          {/* Aplicaciones */}
          <Card className="rounded-xl border-neutral-200 p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-neutral-500">
                <CheckCircle2 className="size-4 text-neutral-400" />
                Aplicaciones
              </h2>
              <span className="font-mono text-sm tabular-nums text-neutral-700">
                Total{" "}
                <span className="font-semibold text-neutral-900">
                  ${fmt(totalAplic)}
                </span>
              </span>
            </div>
            {aplicaciones.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wider text-neutral-500">
                    <tr className="border-b border-neutral-200">
                      <th className="px-2 py-2">Fecha</th>
                      <th className="px-2 py-2">Número</th>
                      <th className="px-2 py-2 text-right">Saldo</th>
                      <th className="w-40 px-2 py-2 text-right">Aplicar</th>
                      <th className="w-12 px-2 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {aplicaciones.map((ap, i) => (
                      <tr
                        key={`${ap.comprobanteId}-${i}`}
                        className="hover:bg-neutral-50/60"
                      >
                        <td className="whitespace-nowrap px-2 py-2 text-neutral-600">
                          {ap.fecha ? formatearFechaArgentina(ap.fecha) : "—"}
                        </td>
                        <td className="px-2 py-2 font-mono text-xs text-neutral-600">
                          {ap.numero || "—"}
                        </td>
                        <td className="px-2 py-2 text-right font-mono tabular-nums text-neutral-700">
                          ${fmt(ap.saldo || 0)}
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            className={`${inputCls} text-right`}
                            type="number"
                            value={ap.montoAplicado}
                            min={0}
                            max={ap.saldo}
                            step="0.01"
                            onChange={(e) =>
                              updAplic(i, {
                                montoAplicado: Number(e.target.value),
                              })
                            }
                            placeholder="0.00"
                          />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => delAplic(i)}
                            className="rounded p-1.5 text-neutral-400 hover:bg-rose-50 hover:text-rose-600"
                            title="Quitar"
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
              <p className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50/60 p-4 text-center text-sm text-neutral-500">
                Sin aplicaciones. Tocá &quot;Aplicar&quot; en la tabla de
                pendientes.
              </p>
            )}
          </Card>

          {/* Métodos de pago */}
          <Card className="rounded-xl border-neutral-200 p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-neutral-500">
                <CreditCard className="size-4 text-neutral-400" />
                Métodos de pago
              </h2>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm tabular-nums text-neutral-700">
                  Total{" "}
                  <span className="font-semibold text-neutral-900">
                    ${fmt(totalMetodos)}
                  </span>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={autobalance}
                  disabled={!aplicaciones.length}
                  className="h-7 gap-1.5 text-xs"
                  title="Cargar el total en el primer método"
                >
                  Igualar
                </Button>
                <Button
                  size="sm"
                  onClick={addMetodo}
                  type="button"
                  className="h-7 gap-1.5 text-xs"
                >
                  <Plus className="size-3" />
                  Agregar
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wider text-neutral-500">
                  <tr className="border-b border-neutral-200">
                    <th className="w-48 px-2 py-2">Método</th>
                    <th className="w-40 px-2 py-2 text-right">Monto</th>
                    <th className="px-2 py-2">Referencia</th>
                    <th className="w-12 px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {metodos.map((m, i) => (
                    <tr key={i}>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-neutral-400">
                            {metodoIcon(m.metodo)}
                          </span>
                          <select
                            className={selectCls}
                            value={m.metodo}
                            onChange={(e) =>
                              updMetodo(i, {
                                metodo: e.target.value as MetodoPago,
                              })
                            }
                          >
                            <option value="transferencia">Transferencia</option>
                            <option value="cheque">Cheque</option>
                            <option value="efectivo">Efectivo</option>
                            <option value="otro">Otro</option>
                          </select>
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <Input
                          className={`${inputCls} text-right`}
                          type="number"
                          value={m.monto}
                          onChange={(e) =>
                            updMetodo(i, { monto: Number(e.target.value) })
                          }
                          min={0}
                          step="0.01"
                          placeholder="0.00"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <Input
                          className={inputCls}
                          value={m.ref || ""}
                          onChange={(e) =>
                            updMetodo(i, { ref: e.target.value })
                          }
                          placeholder="N° cheque, CBU, etc."
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => delMetodo(i)}
                          className="rounded p-1.5 text-neutral-400 hover:bg-rose-50 hover:text-rose-600"
                          title="Eliminar"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Columna lateral sticky: resumen */}
        <div className="lg:col-span-1">
          <Card className="sticky top-4 rounded-xl border-neutral-200 p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-neutral-500">
              <Wallet className="size-4 text-neutral-400" />
              Resumen
            </h2>

            <div className="space-y-2 text-sm">
              <Row label="Métodos" value={`$${fmt(totalMetodos)}`} />
              <Row label="Aplicaciones" value={`$${fmt(totalAplic)}`} />
              <div className="my-2 border-t border-neutral-100" />
              <div className="flex items-baseline justify-between">
                <span className="text-neutral-500">Diferencia</span>
                <span
                  className={`font-mono font-semibold tabular-nums ${
                    balanceado
                      ? "text-emerald-700"
                      : difTotales > 0
                        ? "text-amber-700"
                        : "text-rose-700"
                  }`}
                >
                  ${fmt(Math.abs(difTotales))}
                  {!balanceado && (
                    <span className="ml-1 text-[10px] font-medium uppercase">
                      {difTotales > 0 ? "sobra" : "falta"}
                    </span>
                  )}
                </span>
              </div>
            </div>

            {!balanceado && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/70 p-2.5 text-xs text-amber-800">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>
                  Métodos y aplicaciones deben sumar exactamente lo mismo.
                </span>
              </div>
            )}

            <Button
              onClick={submit}
              disabled={!canSubmit}
              className="mt-4 w-full gap-2"
              type="button"
            >
              {posting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Procesando…
                </>
              ) : (
                <>
                  <Check className="size-4" />
                  Crear orden de pago
                </>
              )}
            </Button>

            {submitHelp && (
              <p className="mt-2 text-center text-xs text-amber-600">
                {submitHelp}
              </p>
            )}

            <p className="mt-3 text-center text-[11px] text-neutral-400">
              Podés aplicar menos que el saldo total. El resto queda como saldo
              pendiente.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* Fila etiqueta/valor del panel de totales. */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-neutral-500">{label}</span>
      <span className="font-mono tabular-nums text-neutral-700">{value}</span>
    </div>
  );
}
