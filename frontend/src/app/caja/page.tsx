"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import AuthGate from "@/components/auth/AuthGate";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import {
  cajaService,
  AfiliadoSuggest,
  AfiliadoDetalle,
  ObligPend,
} from "@/servicios/cajaService";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, apiBlob, getErrorMessage } from "@/servicios/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Layers,
  Plus,
  Printer,
  RefreshCw,
  Search,
  ShoppingCart,
  Trash2,
  TrendingUp,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { PageContainer, PageHeader, Money, EmptyState } from "@/components/ui-kit";

type MetodoRow = {
  metodo: "efectivo" | "tarjeta" | "mercadopago" | "otro";
  monto: string;
  ref?: string;
};
type AplicRow = {
  obligacionId?: string;
  cuotaId?: string;
  monto: string;
};

/* ============ helpers ============ */
function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

const toNum = (v: string) => {
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

/** Identifica el destino (obligación/cuota) de una fila pendiente. */
function aplicTarget(o: ObligPend): { obligacionId?: string; cuotaId?: string } {
  if (o.tipo === "cuota" && o.cuotaId) return { cuotaId: o.cuotaId };
  if (o.tipo === "obligacion" && o.obligacionId) return { obligacionId: o.obligacionId };
  if (o.id.startsWith("CUO-")) return { cuotaId: o.id.replace("CUO-", "") };
  if (o.id.startsWith("OBL-")) return { obligacionId: o.id.replace("OBL-", "") };
  return { obligacionId: o.id };
}
const sameTarget = (a: AplicRow, t: { obligacionId?: string; cuotaId?: string }) =>
  t.cuotaId ? a.cuotaId === t.cuotaId : t.obligacionId ? a.obligacionId === t.obligacionId : false;

/** Normaliza un período variado a "YYYY-MM". */
function periodoToYM(periodo?: string | null): string | null {
  if (!periodo) return null;
  if (/^\d{4}-\d{2}$/.test(periodo)) return periodo;
  if (/^\d{2}\/\d{4}$/.test(periodo)) {
    const [m, y] = periodo.split("/");
    return `${y}-${m}`;
  }
  if (/^\d{2}\/\d{2}$/.test(periodo)) {
    const [m, a] = periodo.split("/");
    const y = Number(a) < 50 ? 2000 + Number(a) : 1900 + Number(a);
    return `${y}-${m}`;
  }
  return null;
}
function periodoLabel(periodo?: string | null): string | null {
  const ym = periodoToYM(periodo);
  if (!ym) return periodo ?? null;
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("es-AR", { month: "long", year: "numeric" });
}
function initials(name?: string | null): string {
  if (!name) return "—";
  const parts = name.trim().split(/[\s,]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "—";
}

function KeyBadge({ keys }: { keys: string }) {
  return (
    <Badge
      variant="secondary"
      className="ml-1.5 text-[10px] font-mono px-1.5 py-0.5 bg-neutral-100 text-neutral-500 border border-neutral-200"
    >
      {keys}
    </Badge>
  );
}

/* ============ Dólar (píldora compacta para el toolbar) ============ */
type DolarApiQuote = {
  compra: number;
  venta: number;
  fechaActualizacion: string;
};

async function fetchDolar(casa: "oficial" | "blue") {
  const res = await fetch(`https://dolarapi.com/v1/dolares/${casa}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Dólar API (${casa}) ${res.status}`);
  return (await res.json()) as DolarApiQuote;
}

function DolarPill() {
  const [oficial, setOficial] = useState<DolarApiQuote | null>(null);
  const [blue, setBlue] = useState<DolarApiQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);

  const load = useCallback(async () => {
    try {
      setErr(false);
      setLoading(true);
      const [o, b] = await Promise.all([fetchDolar("oficial"), fetchDolar("blue")]);
      setOficial(o);
      setBlue(b);
    } catch {
      setErr(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const brecha = useMemo(() => {
    if (!oficial?.venta || !blue?.venta) return null;
    return +(((blue.venta - oficial.venta) / oficial.venta) * 100).toFixed(1);
  }, [oficial?.venta, blue?.venta]);

  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 shadow-sm">
      <TrendingUp className="h-4 w-4 shrink-0 text-medical-600" />
      {err ? (
        <span className="text-xs text-muted-foreground">Dólar no disponible</span>
      ) : (
        <>
          <div className="flex items-baseline gap-1">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Of.</span>
            <span className="text-sm font-semibold tabular-nums">
              {loading || !oficial ? "—" : `$${fmt(oficial.venta)}`}
            </span>
          </div>
          <span className="h-4 w-px bg-neutral-200" />
          <div className="flex items-baseline gap-1">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Blue</span>
            <span className="text-sm font-semibold tabular-nums">
              {loading || !blue ? "—" : `$${fmt(blue.venta)}`}
            </span>
          </div>
          {brecha !== null && (
            <Badge
              variant="secondary"
              className="px-1.5 py-0 text-[10px] font-semibold tabular-nums bg-medical-50 text-medical-700 border border-medical-200"
            >
              +{brecha}%
            </Badge>
          )}
        </>
      )}
      <button
        onClick={load}
        disabled={loading}
        title="Actualizar"
        className="ml-0.5 text-neutral-400 hover:text-neutral-700"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
      </button>
    </div>
  );
}

/* ============ Cuota (fila con checkbox + monto editable) ============ */
function CuotaRow({
  o,
  checked,
  monto,
  onToggle,
  onMonto,
}: {
  o: ObligPend;
  checked: boolean;
  monto: string;
  onToggle: () => void;
  onMonto: (v: string) => void;
}) {
  const ym = periodoToYM(o.periodo);
  const currentYM = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, []);
  const vencida = !!ym && ym < currentYM;
  const titulo = periodoLabel(o.periodo) || o.concepto;

  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border p-3 transition-colors sm:flex-row sm:items-center ${
        checked ? "border-medical-300 bg-medical-50/60" : "border-border/60 bg-background hover:bg-muted/30"
      }`}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={onToggle}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
          checked
            ? "border-medical-500 bg-medical-500 text-white"
            : "border-neutral-300 bg-white hover:border-medical-400"
        }`}
      >
        {checked && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      </button>

      <button type="button" onClick={onToggle} className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium capitalize leading-5">{titulo}</span>
          {vencida && (
            <Badge variant="outline" className="shrink-0 gap-1 border-rose-200 bg-rose-50 px-1.5 py-0 text-[10px] text-rose-600">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
              Vencida
            </Badge>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span className="truncate">{o.concepto}</span>
        </div>
      </button>

      <div className="flex items-center gap-3 sm:justify-end">
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Saldo</div>
          <div className="text-sm font-semibold tabular-nums">
            <Money amount={o.saldo} />
          </div>
        </div>
        <div className="w-32">
          <Input
            type="number"
            step="0.01"
            inputMode="decimal"
            placeholder="0.00"
            value={checked ? monto : ""}
            disabled={!checked}
            onChange={(e) => onMonto(e.target.value)}
            className="h-10 rounded-lg text-right tabular-nums disabled:opacity-50"
          />
        </div>
      </div>
    </div>
  );
}

/* ============ Página ============ */
function CajaCobrosInner() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        const st = await cajaService.estado();
        if (!st.abierta || !st.cajaId) router.replace("/caja/apertura");
      } catch {
        router.replace("/caja/apertura");
      }
    })();
  }, [router]);

  const [afQuery, setAfQuery] = useState("");
  const debouncedQuery = useDebounced(afQuery, 220);
  const [afOpts, setAfOpts] = useState<AfiliadoSuggest[]>([]);
  const [afi, setAfi] = useState<AfiliadoSuggest | null>(null);
  const [afiDet, setAfiDet] = useState<AfiliadoDetalle | null>(null);
  const [showOpts, setShowOpts] = useState(false);

  const [padrones, setPadrones] = useState<
    Array<{ id: string; padron: string | null; sistema: string | null; centro: number | null }>
  >([]);
  const [padronId, setPadronId] = useState<string>(""); // "" = todos

  const [pend, setPend] = useState<ObligPend[]>([]);
  const [deudaTotal, setDeudaTotal] = useState(0);
  const [aplic, setAplic] = useState<AplicRow[]>([]);
  const [metodos, setMetodos] = useState<MetodoRow[]>([{ metodo: "efectivo", monto: "", ref: "" }]);

  const [msg, setMsg] = useState<string | null>(null);
  const [msgType, setMsgType] = useState<"success" | "error" | null>(null);
  const [loading, setLoading] = useState(false);
  const [pagoId, setPagoId] = useState<string | null>(null);
  const [comprobanteId, setComprobanteId] = useState<string | null>(null);
  const [numeroRecibo, setNumeroRecibo] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // suggest afiliados (debounced)
  useEffect(() => {
    let cancel = false;
    (async () => {
      const q = debouncedQuery.trim();
      if (q.length < 2) return setAfOpts([]);
      const r = await cajaService.suggestAfiliados(q).catch(() => []);
      if (!cancel) setAfOpts(r);
    })();
    return () => {
      cancel = true;
    };
  }, [debouncedQuery]);

  // al cambiar afiliado: padrones + detalle + deuda total
  useEffect(() => {
    setPadrones([]);
    setPadronId("");
    setPend([]);
    setAplic([]);
    setAfiDet(null);
    setDeudaTotal(0);
    setPagoId(null);
    setComprobanteId(null);
    setNumeroRecibo(null);
    if (!afi) return;
    (async () => {
      const [pads, det, todos] = await Promise.all([
        cajaService.padronesAfiliado(afi.id).catch(() => []),
        cajaService.getAfiliado(afi.id).catch(() => null),
        cajaService.pendientesAfiliado(afi.id).catch(() => []),
      ]);
      setPadrones(pads);
      setAfiDet(det);
      setDeudaTotal(todos.reduce((a, b) => a + b.saldo, 0));
    })();
  }, [afi]);

  // selector de padrón → carga movimientos (cuotas) de ese padrón (NO resetea selección)
  useEffect(() => {
    if (!afi) {
      setPend([]);
      return;
    }
    let cancel = false;
    (async () => {
      const r = await cajaService.pendientesAfiliado(afi.id, padronId || undefined).catch(() => []);
      if (!cancel) setPend(r);
    })();
    return () => {
      cancel = true;
    };
  }, [afi, padronId]);

  /* ----- derivados ----- */
  const totalAplic = useMemo(() => aplic.reduce((a, b) => a + toNum(b.monto), 0), [aplic]);
  const totalMetodos = useMemo(() => metodos.reduce((a, b) => a + toNum(b.monto), 0), [metodos]);
  const diff = useMemo(() => +(totalMetodos - totalAplic).toFixed(2), [totalMetodos, totalAplic]);
  const faltaAsignar = useMemo(() => +(totalAplic - totalMetodos).toFixed(2), [totalAplic, totalMetodos]);
  const cuotasSel = useMemo(() => aplic.filter((a) => toNum(a.monto) > 0).length, [aplic]);

  const canConfirmar = useMemo(
    () => !!afi && cuotasSel > 0 && Math.abs(diff) <= 0.01 && totalAplic > 0 && !loading,
    [afi, cuotasSel, diff, totalAplic, loading]
  );

  // agrupar pendientes por padrón
  const grupos = useMemo(() => {
    const m = new Map<string, ObligPend[]>();
    for (const o of pend) {
      const k = o.padronLabel || "Sin padrón";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(o);
    }
    return Array.from(m.entries());
  }, [pend]);

  const rowFor = useCallback(
    (o: ObligPend) => aplic.find((a) => sameTarget(a, aplicTarget(o))),
    [aplic]
  );

  /* ----- acciones cuotas ----- */
  const toggleCuota = (o: ObligPend) => {
    const t = aplicTarget(o);
    setAplic((prev) => {
      const i = prev.findIndex((a) => sameTarget(a, t));
      if (i >= 0) return prev.filter((_, j) => j !== i);
      return [...prev, { ...t, monto: o.saldo.toFixed(2) }];
    });
  };
  const setMontoCuota = (o: ObligPend, value: string) => {
    const t = aplicTarget(o);
    setAplic((prev) => {
      const i = prev.findIndex((a) => sameTarget(a, t));
      if (i >= 0) {
        const c = [...prev];
        c[i] = { ...c[i], monto: value };
        return c;
      }
      return [...prev, { ...t, monto: value }];
    });
  };
  const seleccionarVisibles = () => {
    setAplic((prev) => {
      const next = [...prev];
      for (const o of pend) {
        const t = aplicTarget(o);
        if (!next.some((a) => sameTarget(a, t))) next.push({ ...t, monto: o.saldo.toFixed(2) });
      }
      return next;
    });
  };

  /* ----- métodos ----- */
  const autoAsignar = useCallback(() => {
    const objetivo = +totalAplic.toFixed(2);
    setMetodos((prev) => {
      if (prev.length === 0) return [{ metodo: "efectivo", monto: objetivo.toFixed(2), ref: "" }];
      const others = prev.slice(1).reduce((a, m) => a + toNum(m.monto), 0);
      const primero = { ...prev[0], monto: Math.max(0, +(objetivo - others).toFixed(2)).toFixed(2) };
      return [primero, ...prev.slice(1)];
    });
  }, [totalAplic]);

  const resetAll = useCallback(() => {
    setAfi(null);
    setAfiDet(null);
    setAfQuery("");
    setAfOpts([]);
    setPadrones([]);
    setPadronId("");
    setPend([]);
    setDeudaTotal(0);
    setAplic([]);
    setMetodos([{ metodo: "efectivo", monto: "", ref: "" }]);
    setMsg(null);
    setMsgType(null);
    setPagoId(null);
    setComprobanteId(null);
    setNumeroRecibo(null);
    setTimeout(() => inputRef.current?.focus(), 80);
  }, []);

  /* ----- atajos ----- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const editing =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable ||
        target.closest("[role='combobox']") ||
        target.closest("[role='dialog']");

      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        return;
      }
      if (e.key === "F2" && totalAplic > 0) {
        e.preventDefault();
        autoAsignar();
        return;
      }
      if (editing) return;
      if (mod && e.key === "Enter" && canConfirmar) {
        e.preventDefault();
        cobrar().catch(console.error);
      }
      if (mod && e.key.toLowerCase() === "p" && pagoId && !loading) {
        e.preventDefault();
        imprimirRecibo("A4", pagoId).catch(console.error);
      }
      if (e.key === "Escape" && !loading) {
        e.preventDefault();
        resetAll();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canConfirmar, pagoId, loading, resetAll, autoAsignar, totalAplic]);

  /* ----- impresión / cobro ----- */
  const imprimirRecibo = async (
    formato: "A4" | "TICKET_80MM",
    pagoIdParam?: string,
    comprobanteIdParam?: string,
    numeroReciboParam?: string,
  ) => {
    const idPago = pagoIdParam || pagoId;
    const idComp = comprobanteIdParam ?? comprobanteId;
    const nroRecibo = numeroReciboParam ?? numeroRecibo;
    if (!idPago) {
      await Swal.fire({ title: "Error", text: "No se encontró el ID del pago", icon: "error", confirmButtonColor: "#0284c7" });
      return;
    }
    try {
      setLoading(true);
      Swal.fire({
        title: "Generando recibo…",
        text: "Por favor esperá",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      let blob: Blob;
      let downloadName: string;

      if (idComp && formato === "A4") {
        // Recibo persistido en disco (idéntico al emitido en el cobro).
        blob = await apiBlob(
          `/comprobantes/${idComp}/pdf?disposition=attachment`,
          { method: "GET" },
        );
        downloadName = `recibo-${nroRecibo || idPago}-a4.pdf`;
      } else {
        // Ticket 80mm o pago sin comprobante persistido: render on-the-fly.
        const pagoData = await api<Record<string, unknown>>(
          `/caja/pagos/${idPago}/para-imprimir`,
          { method: "GET" },
        );
        blob = await apiBlob("/print/comprobantes?disposition=attachment", {
          method: "POST",
          body: JSON.stringify({ ...pagoData, formato }),
        });
        downloadName = `recibo-${nroRecibo || idPago}-${
          formato === "A4" ? "a4" : "ticket"
        }.pdf`;
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = downloadName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      Swal.fire({
        title: "¡Recibo generado!",
        text: "El archivo se está descargando",
        icon: "success",
        confirmButtonColor: "#0284c7",
        timer: 1800,
        timerProgressBar: true,
      });
    } catch (error) {
      Swal.fire({ title: "Error al imprimir", text: getErrorMessage(error), icon: "error", confirmButtonColor: "#0284c7" });
      setMsg(`Error al imprimir: ${getErrorMessage(error)}`);
      setMsgType("error");
    } finally {
      setLoading(false);
    }
  };

  const cobrar = async () => {
    try {
      setLoading(true);
      setMsg(null);
      if (!afi) throw new Error("Seleccioná un afiliado.");
      const aplicValidas = aplic.filter((a) => toNum(a.monto) > 0);
      if (aplicValidas.length === 0) throw new Error("Seleccioná al menos una cuota.");
      if (Math.abs(diff) > 0.01) throw new Error("El total de métodos debe igualar el total a cobrar.");

      const { cajaId } = await cajaService.estado();
      const payload = {
        cajaId: Number(cajaId),
        afiliadoId: Number(afi.id),
        metodos: metodos
          .filter((m) => toNum(m.monto) > 0)
          .map((m) => ({ metodo: m.metodo, monto: toNum(m.monto), ref: m.ref ?? null })),
        aplicaciones: aplicValidas.map((a) => ({
          ...(a.obligacionId ? { obligacionId: Number(a.obligacionId) } : {}),
          ...(a.cuotaId ? { cuotaId: Number(a.cuotaId) } : {}),
          monto: toNum(a.monto),
        })),
      };

      const r = await cajaService.cobrar(payload);
      const nuevoPagoId = String(r.id);
      const nuevoComprobanteId = r.comprobanteId ?? null;
      const nuevoNumeroRecibo = r.numeroRecibo ?? r.comprobanteNumero ?? null;
      const reciboLabel = nuevoNumeroRecibo ?? `#${nuevoPagoId}`;
      setPagoId(nuevoPagoId);
      setComprobanteId(nuevoComprobanteId);
      setNumeroRecibo(nuevoNumeroRecibo);
      setMsg(`Pago registrado correctamente. Recibo ${reciboLabel} — Total $${fmt(Number(r.total))}`);
      setMsgType("success");
      setMetodos([{ metodo: "efectivo", monto: "", ref: "" }]);
      setAplic([]);

      const result = await Swal.fire({
        title: "¡Pago registrado!",
        html: `<div class="text-center"><p class="text-lg mb-3">Recibo ${reciboLabel}</p><p class="text-3xl font-bold text-green-600 mb-2">$${fmt(Number(r.total))}</p><p class="text-sm text-gray-600">¿Deseás imprimir el comprobante?</p></div>`,
        icon: "success",
        showCancelButton: true,
        confirmButtonText: "Sí, imprimir",
        cancelButtonText: "No",
        confirmButtonColor: "#0284c7",
        cancelButtonColor: "#6b7280",
        reverseButtons: true,
        customClass: { popup: "rounded-2xl" },
      });

      if (result.isConfirmed) {
        const f = await Swal.fire({
          title: "Formato",
          text: "¿En qué formato deseás imprimir?",
          icon: "question",
          showCancelButton: true,
          showDenyButton: true,
          confirmButtonText: "A4",
          denyButtonText: "Ticket",
          cancelButtonText: "Cancelar",
          confirmButtonColor: "#0284c7",
          denyButtonColor: "#059669",
          cancelButtonColor: "#6b7280",
          customClass: { popup: "rounded-2xl" },
        });
        if (f.isConfirmed)
          await imprimirRecibo("A4", nuevoPagoId, nuevoComprobanteId ?? undefined, nuevoNumeroRecibo ?? undefined);
        else if (f.isDenied)
          await imprimirRecibo("TICKET_80MM", nuevoPagoId, nuevoComprobanteId ?? undefined, nuevoNumeroRecibo ?? undefined);
      }

      setTimeout(() => resetAll(), 1200);
    } catch (e) {
      setMsg(`Error: ${getErrorMessage(e)}`);
      setMsgType("error");
      setPagoId(null);
      setComprobanteId(null);
      setNumeroRecibo(null);
    } finally {
      setLoading(false);
    }
  };

  const nombreAfi = afiDet
    ? `${afiDet.apellido ?? ""}${afiDet.apellido && afiDet.nombre ? ", " : ""}${afiDet.nombre ?? ""}`.trim() || afi?.display
    : afi?.display;
  const altaLabel = afiDet?.creadoEn
    ? new Date(afiDet.creadoEn).toLocaleDateString("es-AR", { month: "2-digit", year: "numeric" })
    : null;

  return (
    <PageContainer>
      {/* ===== Toolbar sticky: buscador + dólar ===== */}
      <div className="sticky top-14 z-30 -mx-6 border-b border-neutral-200/70 bg-white/90 px-6 py-3 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute inset-y-0 left-3 my-auto h-4 w-4 text-muted-foreground/80" />
            <Input
              ref={inputRef}
              placeholder="Buscar afiliado por DNI o nombre…"
              value={afQuery}
              onFocus={() => setShowOpts(true)}
              onBlur={() => setTimeout(() => setShowOpts(false), 150)}
              onChange={(e) => {
                setAfQuery(e.target.value);
                setShowOpts(true);
                if (afi) {
                  setAfi(null);
                }
              }}
              className="h-11 rounded-xl pl-10 pr-20"
              autoFocus
            />
            <kbd className="pointer-events-none absolute inset-y-0 right-3 my-auto hidden h-fit items-center rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-neutral-400 sm:flex">
              Ctrl K
            </kbd>

            {showOpts && debouncedQuery.trim().length >= 2 && !afi && afOpts.length > 0 && (
              <div className="isolate absolute left-0 right-0 top-full z-[60] mt-1 max-h-80 overflow-y-auto rounded-xl border border-neutral-200 bg-white shadow-xl ring-1 ring-black/5">
                {afOpts.map((o) => (
                  <button
                    key={o.id}
                    className="block w-full border-b border-neutral-100 bg-white px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-medical-50"
                    onClick={() => {
                      setAfi(o);
                      setAfQuery(o.display);
                      setShowOpts(false);
                    }}
                  >
                    <div className="text-sm font-medium text-neutral-900">{o.display}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">DNI: {o.dni}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <DolarPill />
        </div>
      </div>

      <PageHeader title="Caja" subtitle="Registrar pago de cuotas · aporte gremial">
        <Button variant="ghost" onClick={resetAll} className="rounded-xl" disabled={loading}>
          Limpiar
          <KeyBadge keys="Esc" />
        </Button>
        <Button variant="outline" onClick={() => router.push("/caja/cierre")} className="rounded-xl">
          Ir a cierre
        </Button>
      </PageHeader>

      {/* Alert */}
      {msg && (
        <Card
          className={`rounded-2xl border shadow-sm ${
            msgType === "success" ? "bg-emerald-50 border-emerald-300" : "bg-rose-50 border-rose-300"
          }`}
        >
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              {msgType === "success" ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
              ) : (
                <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" />
              )}
              <div className="flex-1">
                <p className="text-sm font-medium">{msg}</p>
                {msgType === "success" && pagoId && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => imprimirRecibo("A4", pagoId)} disabled={loading}>
                      <Printer className="mr-1 h-4 w-4" />
                      Imprimir A4
                      <KeyBadge keys="Ctrl+P" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => imprimirRecibo("TICKET_80MM", pagoId)} disabled={loading}>
                      <Printer className="mr-1 h-4 w-4" />
                      Imprimir Ticket
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Layout grilla SIEMPRE activo: izquierda contexto, derecha POS sticky */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* ===== Columna principal ===== */}
        <div className="space-y-6 lg:col-span-8">
          {afi ? (
            <>
              {/* Afiliado */}
              <Card className="rounded-2xl border-border/60 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-medical-400 to-medical-600 text-lg font-bold text-white shadow-sm">
                      {initials(nombreAfi)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-lg font-semibold tracking-tight">{nombreAfi}</h2>
                        {deudaTotal > 0.01 ? (
                          <Badge variant="outline" className="gap-1 border-rose-200 bg-rose-50 px-2 py-0 text-[11px] text-rose-600">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                            Con deuda
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 border-emerald-200 bg-emerald-50 px-2 py-0 text-[11px] text-emerald-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Al día
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {[
                          afiDet?.tipo ? `Tipo ${afiDet.tipo}` : null,
                          altaLabel ? `Alta ${altaLabel}` : null,
                          padrones.length ? `${padrones.length} padr${padrones.length === 1 ? "ón" : "ones"}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "Afiliado"}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <InfoChip label="DNI" value={String(afi.dni)} />
                        {afiDet?.numeroSocio && <InfoChip label="N° Socio" value={afiDet.numeroSocio} />}
                        {afiDet?.cuit && <InfoChip label="CUIT" value={afiDet.cuit} />}
                        {afiDet?.estado && <InfoChip label="Estado" value={afiDet.estado} capitalize />}
                      </div>
                    </div>

                    <Button variant="ghost" size="icon" className="shrink-0 rounded-xl" onClick={resetAll} title="Cambiar afiliado">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Deuda total — rojo si debe, verde compacta si está al día */}
                  {deudaTotal > 0.01 ? (
                    <div className="mt-4 flex flex-col gap-2 rounded-xl border border-rose-200 bg-rose-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-[11px] font-medium uppercase tracking-wide text-rose-600">
                          Deuda total acumulada
                        </div>
                        <div className="text-2xl font-bold tabular-nums text-rose-700">
                          <Money amount={deudaTotal} />
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground sm:text-right">
                        Sumando cuotas pendientes de todos los padrones
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-800">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      <span className="font-medium">Afiliado al día</span>
                      <span className="text-emerald-700/70">— sin cuotas pendientes en ningún padrón</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Selector de padrón + cuotas */}
              <Card className="rounded-2xl border-border/60 shadow-sm">
                <CardHeader className="pb-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Layers className="h-4 w-4" />
                        Cuotas pendientes
                      </CardTitle>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {cuotasSel > 0 ? `${cuotasSel} seleccionada${cuotasSel === 1 ? "" : "s"}` : "Elegí un padrón y tildá las cuotas a cobrar"}
                      </p>
                    </div>
                    {pend.length > 0 && (
                      <Button variant="outline" size="sm" className="rounded-xl" onClick={seleccionarVisibles}>
                        <Check className="mr-1 h-4 w-4" />
                        Seleccionar visibles
                      </Button>
                    )}
                  </div>

                  {/* Selector de padrones (pills) */}
                  {padrones.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <PadronPill active={padronId === ""} onClick={() => setPadronId("")} label="Todos" />
                      {padrones.map((p) => (
                        <PadronPill
                          key={p.id}
                          active={padronId === p.id}
                          onClick={() => setPadronId(p.id)}
                          label={`${p.padron || "Sin padrón"}${p.centro ? ` · C${p.centro}` : ""}`}
                          hint={p.sistema || undefined}
                        />
                      ))}
                    </div>
                  )}
                </CardHeader>

                <CardContent>
                  {pend.length === 0 ? (
                    <EmptyState
                      title="Sin cuotas pendientes"
                      description={padronId ? "Este padrón no tiene cuotas pendientes" : "El afiliado no tiene cuotas pendientes"}
                    />
                  ) : (
                    <div className="thin-scroll max-h-[calc(100vh-26rem)] space-y-5 overflow-y-auto pr-1">
                      {grupos.map(([label, items]) => {
                        const sub = items.reduce((a, b) => a + b.saldo, 0);
                        return (
                          <div key={label} className="space-y-2">
                            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border/50 bg-white/95 pb-1.5 pt-0.5 backdrop-blur-sm">
                              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                <Layers className="h-3.5 w-3.5" />
                                <span className="truncate">{label}</span>
                              </div>
                              <div className="shrink-0 text-xs text-muted-foreground tabular-nums">
                                {items.length} · <Money amount={sub} />
                              </div>
                            </div>
                            {items.map((o) => {
                              const row = rowFor(o);
                              return (
                                <CuotaRow
                                  key={o.id}
                                  o={o}
                                  checked={!!row}
                                  monto={row?.monto ?? ""}
                                  onToggle={() => toggleCuota(o)}
                                  onMonto={(v) => setMontoCuota(o, v)}
                                />
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            /* Estado vacío: bienvenida — solo en la columna principal, NO colapsa el ancho */
            <Card className="rounded-2xl border-2 border-dashed border-border/60 bg-muted/20 shadow-none">
              <CardContent className="flex flex-col items-center justify-center px-6 py-20 text-center">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-medical-50 text-medical-600">
                  <Search className="h-7 w-7" />
                </div>
                <h2 className="text-lg font-semibold tracking-tight text-neutral-900">
                  Buscá un afiliado para comenzar
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                  Ingresá el DNI o el nombre en el buscador de arriba para ver
                  sus padrones, cuotas pendientes y cobrar.
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
                  <kbd className="rounded border border-neutral-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-neutral-500">Ctrl K</kbd>
                  <span>foco buscador</span>
                  <span className="opacity-50">·</span>
                  <kbd className="rounded border border-neutral-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-neutral-500">F2</kbd>
                  <span>autoasignar</span>
                  <span className="opacity-50">·</span>
                  <kbd className="rounded border border-neutral-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-neutral-500">Ctrl Enter</kbd>
                  <span>cobrar</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ===== Sidebar POS — SIEMPRE visible y sticky ===== */}
        <div className="space-y-4 lg:col-span-4 lg:sticky lg:top-32 lg:h-fit lg:self-start">
          {/* Total a cobrar (hero) */}
          <div className={`overflow-hidden rounded-2xl p-5 text-white shadow-lg transition-all ${
            afi
              ? "bg-gradient-to-br from-medical-600 to-medical-800 shadow-medical-600/20"
              : "bg-gradient-to-br from-neutral-400 to-neutral-600 shadow-neutral-400/20"
          }`}>
            <div className="text-[11px] font-medium uppercase tracking-wider text-white/70">
              Total a cobrar
            </div>
            <div className="mt-1 text-4xl font-bold tabular-nums">
              <Money amount={totalAplic} />
            </div>
            <div className="mt-2 truncate text-sm text-white/80">
              {!afi
                ? "Seleccioná un afiliado"
                : cuotasSel > 0
                ? `${cuotasSel} cuota${cuotasSel === 1 ? "" : "s"} · ${nombreAfi}`
                : `Sin cuotas · ${nombreAfi}`}
            </div>
          </div>

          {/* Métodos de pago */}
          <Card className="rounded-2xl border-border/60 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Métodos de pago
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 rounded-lg px-2 text-xs text-medical-700 hover:bg-medical-50"
                  onClick={autoAsignar}
                  disabled={totalAplic <= 0}
                  title="Asignar el total al primer método"
                >
                  <Zap className="mr-1 h-3.5 w-3.5" />
                  Auto
                  <KeyBadge keys="F2" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-2.5">
              {metodos.map((m, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Select
                    value={m.metodo}
                    onValueChange={(value) => {
                      const v = [...metodos];
                      v[i].metodo = value as typeof m.metodo;
                      setMetodos(v);
                    }}
                    disabled={!afi}
                  >
                    <SelectTrigger className="h-10 w-32 shrink-0 rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="efectivo">Efectivo</SelectItem>
                      <SelectItem value="tarjeta">Tarjeta</SelectItem>
                      <SelectItem value="mercadopago">MercadoPago</SelectItem>
                      <SelectItem value="otro">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={m.monto}
                    disabled={!afi}
                    onChange={(e) => {
                      const v = [...metodos];
                      v[i].monto = e.target.value;
                      setMetodos(v);
                    }}
                    className="h-10 flex-1 rounded-lg text-right tabular-nums"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-9 shrink-0 rounded-lg"
                    onClick={() => setMetodos(metodos.filter((_, j) => j !== i))}
                    disabled={metodos.length === 1 || !afi}
                    title="Quitar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              <Button
                variant="outline"
                size="sm"
                onClick={() => setMetodos([...metodos, { metodo: "efectivo", monto: "", ref: "" }])}
                disabled={!afi}
                className="h-10 w-full rounded-lg border-dashed"
              >
                <Plus className="mr-1 h-4 w-4" />
                Agregar método
              </Button>

              {/* Estado de asignación */}
              {totalAplic > 0 && (
                <div className="pt-1">
                  {Math.abs(diff) <= 0.01 ? (
                    <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      Métodos asignados correctamente
                    </div>
                  ) : faltaAsignar > 0 ? (
                    <div className="flex items-center justify-between gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                      <span className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        Falta asignar
                      </span>
                      <span className="tabular-nums">
                        <Money amount={faltaAsignar} />
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
                      <span className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        Sobra asignado
                      </span>
                      <span className="tabular-nums">
                        <Money amount={Math.abs(faltaAsignar)} />
                      </span>
                    </div>
                  )}
                </div>
              )}

              <Button
                onClick={cobrar}
                disabled={!canConfirmar}
                size="lg"
                className="mt-1 h-12 w-full rounded-xl text-base font-semibold"
              >
                <ShoppingCart className="h-5 w-5" />
                {loading ? "Procesando…" : (
                  <>
                    Cobrar <Money amount={totalAplic} className="font-bold" />
                  </>
                )}
                {!loading && canConfirmar && <KeyBadge keys="Ctrl+Enter" />}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}

/* ============ subcomponentes UI ============ */
function InfoChip({ label, value, capitalize }: { label: string; value: string; capitalize?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/40 px-2 py-1 text-xs">
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={`font-medium tabular-nums ${capitalize ? "capitalize" : ""}`}>{value}</span>
    </span>
  );
}

function PadronPill({
  active,
  onClick,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={hint}
      className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "border-medical-500 bg-medical-500 text-white shadow-sm"
          : "border-border/60 bg-background text-neutral-700 hover:border-medical-300 hover:bg-medical-50"
      }`}
    >
      {label}
      {hint && <span className={`ml-1 ${active ? "text-white/70" : "text-muted-foreground"}`}>· {hint}</span>}
    </button>
  );
}

export default function CajaCobrosPage() {
  return (
    <AuthGate roles={["CAJA", "TESORERIA", "ADMIN"]}>
      <CajaCobrosInner />
    </AuthGate>
  );
}
