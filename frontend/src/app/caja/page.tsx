"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import AuthGate from "@/components/auth/AuthGate";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import { cajaService, AfiliadoSuggest, ObligPend } from "@/servicios/cajaService";
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
  CheckCircle2,
  FileText,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Trash2,
  TrendingUp,
  User,
  XCircle,
} from "lucide-react";
import { PageContainer, PageHeader, KpiGrid, Money, EmptyState } from "@/components/ui-kit";

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

function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

const toNum = (v: string) =>
  Number.isFinite(+v) ? parseFloat(v) : parseFloat(String(v).replace(",", ".")) || 0;

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

function KeyBadge({ keys }: { keys: string }) {
  return (
    <Badge
      variant="secondary"
      className="ml-2 text-[11px] font-mono px-1.5 py-0.5 bg-slate-100 text-slate-600 border border-slate-200"
    >
      {keys}
    </Badge>
  );
}

/** =========================
 *  Dólar card (compacta)
 *  ========================= */
type DolarApiQuote = {
  compra: number;
  venta: number;
  casa?: string;
  nombre?: string;
  moneda?: string;
  fechaActualizacion: string;
};

async function fetchDolar(casa: "oficial" | "blue") {
  const res = await fetch(`https://dolarapi.com/v1/dolares/${casa}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Dólar API (${casa}) ${res.status}`);
  return (await res.json()) as DolarApiQuote;
}

function DolarHoyCard() {
  const [oficial, setOficial] = useState<DolarApiQuote | null>(null);
  const [blue, setBlue] = useState<DolarApiQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setErr(null);
      setLoading(true);
      const [o, b] = await Promise.all([fetchDolar("oficial"), fetchDolar("blue")]);
      setOficial(o);
      setBlue(b);
    } catch (e) {
      setErr(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const updatedAt = useMemo(() => {
    const dates = [oficial?.fechaActualizacion, blue?.fechaActualizacion].filter(Boolean) as string[];
    if (!dates.length) return null;
    const max = dates.map((d) => new Date(d).getTime()).sort((a, b) => b - a)[0];
    return new Date(max);
  }, [oficial?.fechaActualizacion, blue?.fechaActualizacion]);

  const spread = useMemo(() => {
    if (!oficial?.venta || !blue?.venta) return null;
    return +(blue.venta - oficial.venta).toFixed(2);
  }, [oficial?.venta, blue?.venta]);

  return (
    <Card className="rounded-2xl border-border/60 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Dólar hoy
            </CardTitle>
            <p className="text-[11px] text-muted-foreground mt-1">
              {updatedAt ? `Últ. act: ${updatedAt.toLocaleString("es-AR")}` : "Actualización automática"}
            </p>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={load}
            disabled={loading}
            className="rounded-xl"
            title="Actualizar"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {err ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            No se pudo cargar el dólar: <span className="font-medium">{err}</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
              <div className="text-[11px] text-muted-foreground">Oficial (venta)</div>
              <div className="mt-1 text-lg font-semibold tabular-nums">
                {loading || !oficial ? "—" : <Money amount={oficial.venta} />}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                compra: {loading || !oficial ? "—" : fmt(oficial.compra)}
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
              <div className="text-[11px] text-muted-foreground">Blue (venta)</div>
              <div className="mt-1 text-lg font-semibold tabular-nums">
                {loading || !blue ? "—" : <Money amount={blue.venta} />}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                compra: {loading || !blue ? "—" : fmt(blue.compra)}
              </div>
            </div>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between rounded-xl border border-border/60 bg-background p-2.5">
          <div className="text-[11px] text-muted-foreground">Brecha (Blue - Oficial)</div>
          <div className="text-sm font-semibold tabular-nums">
            {spread === null ? "—" : <Money amount={spread} />}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

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

  const [padrones, setPadrones] = useState<
    Array<{ id: string; padron: string | null; sistema: string | null; centro: number | null }>
  >([]);
  const [padronId, setPadronId] = useState<string>("");

  const [pend, setPend] = useState<ObligPend[]>([]);
  const [aplic, setAplic] = useState<AplicRow[]>([]);
  const [metodos, setMetodos] = useState<MetodoRow[]>([{ metodo: "efectivo", monto: "0", ref: "" }]);

  const [msg, setMsg] = useState<string | null>(null);
  const [msgType, setMsgType] = useState<"success" | "error" | null>(null);
  const [loading, setLoading] = useState(false);
  const [pagoId, setPagoId] = useState<string | null>(null);

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

  // cargar padrones
  useEffect(() => {
    (async () => {
      setPadrones([]);
      setPadronId("");
      setPend([]);
      setAplic([]);
      if (!afi) return;
      const pads = await cajaService.padronesAfiliado(afi.id).catch(() => []);
      setPadrones(pads);
    })();
  }, [afi]);

  // pendientes
  useEffect(() => {
    (async () => {
      setPend([]);
      setAplic([]);
      if (!afi) return;
      const r = await cajaService.pendientesAfiliado(afi.id, padronId || undefined).catch(() => []);
      setPend(r);
    })();
  }, [afi, padronId]);

  const totalAplic = useMemo(() => aplic.reduce((a, b) => a + toNum(b.monto), 0), [aplic]);
  const totalMetodos = useMemo(() => metodos.reduce((a, b) => a + toNum(b.monto), 0), [metodos]);
  const diff = useMemo(() => +(totalMetodos - totalAplic).toFixed(2), [totalMetodos, totalAplic]);

  const canConfirmar = useMemo(
    () => !!afi && aplic.length > 0 && Math.abs(diff) <= 0.01 && !loading,
    [afi, aplic.length, diff, loading]
  );

  const inputRef = useRef<HTMLInputElement>(null);

  const resetAll = useCallback(() => {
    setAfi(null);
    setAfQuery("");
    setAfOpts([]);
    setPadrones([]);
    setPadronId("");
    setPend([]);
    setAplic([]);
    setMetodos([{ metodo: "efectivo", monto: "0", ref: "" }]);
    setMsg(null);
    setMsgType(null);
    setPagoId(null);
    setTimeout(() => inputRef.current?.focus(), 80);
  }, []);

  // atajos
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable ||
        target.closest("[role='combobox']") ||
        target.closest("[role='dialog']")
      ) {
        return;
      }

      const ctrlOrCmd = e.ctrlKey || e.metaKey;

      // Ctrl+K focus search
      if (ctrlOrCmd && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }

      // Ctrl+Enter confirmar
      if (ctrlOrCmd && e.key === "Enter" && canConfirmar) {
        e.preventDefault();
        cobrar().catch(console.error);
      }

      // Ctrl+P imprimir A4 si existe pago
      if (ctrlOrCmd && e.key.toLowerCase() === "p" && pagoId && !loading) {
        e.preventDefault();
        imprimirRecibo("A4", pagoId).catch(console.error);
      }

      // ESC reset
      if (e.key === "Escape" && !loading) {
        e.preventDefault();
        resetAll();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canConfirmar, pagoId, loading, resetAll]);

  const pagarTodo = (o: ObligPend) => {
    const v = [...aplic];

    const keyMatch = (x: AplicRow) => {
      if (o.tipo === "cuota" && o.cuotaId) return x.cuotaId === o.cuotaId;
      if (o.tipo === "obligacion" && o.obligacionId) return x.obligacionId === o.obligacionId;

      if (o.id.startsWith("CUO-")) return x.cuotaId === o.id.replace("CUO-", "");
      if (o.id.startsWith("OBL-")) return x.obligacionId === o.id.replace("OBL-", "");

      return x.obligacionId === o.id || x.cuotaId === o.id;
    };

    const i = v.findIndex(keyMatch);

    const item: AplicRow = { monto: o.saldo.toFixed(2) };
    if (o.tipo === "cuota" && o.cuotaId) item.cuotaId = o.cuotaId;
    else if (o.tipo === "obligacion" && o.obligacionId) item.obligacionId = o.obligacionId;
    else {
      if (o.id.startsWith("CUO-")) item.cuotaId = o.id.replace("CUO-", "");
      else if (o.id.startsWith("OBL-")) item.obligacionId = o.id.replace("OBL-", "");
      else item.obligacionId = o.id;
    }

    if (i === -1) v.push(item);
    else v[i] = item;

    setAplic(v);
  };

  const handleMontoChange = (o: ObligPend, value: string) => {
    const v = [...aplic];

    const keyMatch = (x: AplicRow) => {
      if (o.tipo === "cuota" && o.cuotaId) return x.cuotaId === o.cuotaId;
      if (o.tipo === "obligacion" && o.obligacionId) return x.obligacionId === o.obligacionId;

      if (o.id.startsWith("CUO-")) return x.cuotaId === o.id.replace("CUO-", "");
      if (o.id.startsWith("OBL-")) return x.obligacionId === o.id.replace("OBL-", "");

      return x.obligacionId === o.id || x.cuotaId === o.id;
    };

    const i = v.findIndex(keyMatch);

    const item: AplicRow = { monto: value };
    if (o.tipo === "cuota" && o.cuotaId) item.cuotaId = o.cuotaId;
    else if (o.tipo === "obligacion" && o.obligacionId) item.obligacionId = o.obligacionId;
    else {
      if (o.id.startsWith("CUO-")) item.cuotaId = o.id.replace("CUO-", "");
      else if (o.id.startsWith("OBL-")) item.obligacionId = o.id.replace("OBL-", "");
      else item.obligacionId = o.id;
    }

    if (i === -1) v.push(item);
    else v[i] = item;

    setAplic(v);
  };

  const imprimirRecibo = async (formato: "A4" | "TICKET_80MM", pagoIdParam?: string) => {
    const idPago = pagoIdParam || pagoId;
    if (!idPago) {
      await Swal.fire({
        title: "Error",
        text: "No se encontró el ID del pago",
        icon: "error",
        confirmButtonColor: "#2563eb",
      });
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

      const pagoData = await api<Record<string, unknown>>(`/caja/pagos/${idPago}/para-imprimir`, {
        method: "GET",
      });

      const blob = await apiBlob("/print/comprobantes?disposition=attachment", {
        method: "POST",
        body: JSON.stringify({ ...pagoData, formato }),
      });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `recibo-${idPago}-${formato === "A4" ? "a4" : "ticket"}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      Swal.fire({
        title: "¡Recibo generado!",
        text: "El archivo se está descargando",
        icon: "success",
        confirmButtonColor: "#2563eb",
        timer: 1800,
        timerProgressBar: true,
      });
    } catch (error) {
      console.error("Error al imprimir:", error);
      Swal.fire({
        title: "Error al imprimir",
        text: getErrorMessage(error),
        icon: "error",
        confirmButtonColor: "#2563eb",
      });
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
      if (aplic.length === 0) throw new Error("No hay aplicaciones.");
      if (Math.abs(diff) > 0.01) throw new Error("Total métodos debe igualar total aplicado.");

      const { cajaId } = await cajaService.estado();

      const payload = {
        cajaId: Number(cajaId),
        afiliadoId: Number(afi.id),
        metodos: metodos.map((m) => ({
          metodo: m.metodo,
          monto: toNum(m.monto),
          ref: m.ref ?? null,
        })),
        aplicaciones: aplic.map((a) => ({
          ...(a.obligacionId ? { obligacionId: Number(a.obligacionId) } : {}),
          ...(a.cuotaId ? { cuotaId: Number(a.cuotaId) } : {}),
          monto: toNum(a.monto),
        })),
      };

      const r = await cajaService.cobrar(payload);
      const nuevoPagoId = String(r.id);

      setPagoId(nuevoPagoId);
      setMsg(`Pago registrado correctamente. Recibo #${nuevoPagoId} — Total $${fmt(Number(r.total))}`);
      setMsgType("success");

      setMetodos([{ metodo: "efectivo", monto: "0", ref: "" }]);
      setAplic([]);

      const result = await Swal.fire({
        title: "¡Pago registrado!",
        html: `
          <div class="text-center">
            <p class="text-lg mb-3">Recibo #${nuevoPagoId}</p>
            <p class="text-3xl font-bold text-green-600 mb-2">$${fmt(Number(r.total))}</p>
            <p class="text-sm text-gray-600">¿Deseas imprimir el comprobante?</p>
          </div>
        `,
        icon: "success",
        showCancelButton: true,
        confirmButtonText: "Sí, imprimir",
        cancelButtonText: "No",
        confirmButtonColor: "#2563eb",
        cancelButtonColor: "#6b7280",
        reverseButtons: true,
        customClass: {
          popup: "rounded-2xl",
          confirmButton: "px-6 py-2 rounded-lg",
          cancelButton: "px-6 py-2 rounded-lg",
        },
      });

      if (result.isConfirmed) {
        const formatResult = await Swal.fire({
          title: "Formato",
          text: "¿En qué formato deseas imprimir?",
          icon: "question",
          showCancelButton: true,
          showDenyButton: true,
          confirmButtonText: "A4",
          denyButtonText: "Ticket",
          cancelButtonText: "Cancelar",
          confirmButtonColor: "#2563eb",
          denyButtonColor: "#059669",
          cancelButtonColor: "#6b7280",
          customClass: { popup: "rounded-2xl" },
        });

        if (formatResult.isConfirmed) await imprimirRecibo("A4", nuevoPagoId);
        else if (formatResult.isDenied) await imprimirRecibo("TICKET_80MM", nuevoPagoId);
      }

      setTimeout(() => resetAll(), 1200);
    } catch (e) {
      setMsg(`Error: ${getErrorMessage(e)}`);
      setMsgType("error");
      setPagoId(null);
    } finally {
      setLoading(false);
    }
  };

  const totalPend = useMemo(() => pend.reduce((sum, p) => sum + p.saldo, 0), [pend]);

  return (
    <PageContainer>
      <PageHeader title="Caja" subtitle="Registrar pagos de afiliados">
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.push("/caja/cierre")} className="rounded-xl">
            Ir a cierre
          </Button>
          <Button variant="ghost" onClick={resetAll} className="rounded-xl" disabled={loading}>
            Limpiar
            <KeyBadge keys="Esc" />
          </Button>
        </div>
      </PageHeader>

      {/* Alert */}
      {msg && (
        <Card
          className={`rounded-2xl border shadow-sm ${msgType === "success"
              ? "bg-emerald-50 border-emerald-300"
              : msgType === "error"
                ? "bg-rose-50 border-rose-300"
                : "bg-muted border-border"
            }`}
        >
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              {msgType === "success" ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-700 mt-0.5 shrink-0" />
              ) : msgType === "error" ? (
                <XCircle className="h-5 w-5 text-rose-700 mt-0.5 shrink-0" />
              ) : null}
              <div className="flex-1">
                <p className="font-medium text-sm">{msg}</p>
                {msgType === "success" && pagoId && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => imprimirRecibo("A4", pagoId)} disabled={loading}>
                      <Printer className="h-4 w-4 mr-2" />
                      <span className="flex items-center gap-1">
                        Imprimir A4
                        <KeyBadge keys="Ctrl+P" />
                      </span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => imprimirRecibo("TICKET_80MM", pagoId)}
                      disabled={loading}
                    >
                      <Printer className="h-4 w-4 mr-2" />
                      Imprimir Ticket
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-6 h-fit">
          {/* Buscar afiliado */}
          <Card className="rounded-2xl border-border/60 shadow-sm">
            

            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute inset-y-0 left-3 my-auto h-4 w-4 text-muted-foreground/80" />
                <Input
                  ref={inputRef}
                  placeholder="DNI o nombre del afiliado…"
                  value={afQuery}
                  onChange={(e) => {
                    setAfQuery(e.target.value);
                    setAfi(null);
                    setPadrones([]);
                    setPadronId("");
                  }}
                  className="h-11 rounded-xl pl-12"
                  autoFocus
                />
              </div>

              {debouncedQuery.trim().length >= 2 && !afi && afOpts.length > 0 && (
                <div className="border border-border/60 rounded-xl bg-background shadow-sm max-h-64 overflow-y-auto">
                  {afOpts.map((o) => (
                    <button
                      key={o.id}
                      className="w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors border-b border-border/60 last:border-b-0"
                      onClick={() => {
                        setAfi(o);
                        setAfQuery(o.display);
                      }}
                    >
                      <div className="font-medium text-sm">{o.display}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">DNI: {o.dni}</div>
                    </button>
                  ))}
                </div>
              )}

              {afi && (
                <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-xl border border-border/60">
                  <div className="p-2.5 bg-primary rounded-2xl shadow-sm">
                    <User className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{afi.display}</div>
                    <div className="text-xs text-muted-foreground">DNI: {afi.dni}</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Padrón */}
          {afi && padrones.length > 0 && (
            <Card className="rounded-2xl border-border/60 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Padrón
                </CardTitle>
                <p className="text-xs text-muted-foreground">Filtrar movimientos</p>
              </CardHeader>
              <CardContent>
                <Select
                  value={padronId || "all"}
                  onValueChange={(value) => {
                    setPadronId(value === "all" ? "" : value);
                    setAplic([]);
                  }}
                >
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue placeholder="Seleccionar padrón" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los padrones</SelectItem>
                    {padrones.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.padron || "Sin padrón"}
                        {p.centro ? ` (Centro: ${p.centro})` : ""}
                        {p.sistema ? ` - ${p.sistema}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          )}

          {/* Dólar hoy (no molesta, compacta) */}
          <DolarHoyCard />
        </div>

        {/* Main */}
        <div className="lg:col-span-8 space-y-6">
          {/* Pendientes */}
          {afi && (
            <Card className="rounded-2xl border-border/60 shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-base">Movimientos pendientes</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      {pend.length > 0
                        ? `${pend.length} movimiento${pend.length !== 1 ? "s" : ""} pendiente${pend.length !== 1 ? "s" : ""
                        }`
                        : "No hay movimientos pendientes"}
                    </p>
                  </div>

                  {pend.length > 0 && (
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Total pendiente</div>
                      <div className="text-2xl font-semibold tabular-nums mt-0.5">
                        <Money amount={totalPend} />
                      </div>
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent>
                {pend.length === 0 ? (
                  <EmptyState
                    title="Sin movimientos pendientes"
                    description={padronId ? "No hay pendientes para este padrón" : "No hay pendientes para este afiliado"}
                  />
                ) : (
                  <div className="space-y-3">
                    {pend.map((o) => {
                      const row = aplic.find((x) => {
                        if (o.tipo === "cuota" && o.cuotaId) return x.cuotaId === o.cuotaId;
                        if (o.tipo === "obligacion" && o.obligacionId) return x.obligacionId === o.obligacionId;
                        if (o.id.startsWith("CUO-")) return x.cuotaId === o.id.replace("CUO-", "");
                        if (o.id.startsWith("OBL-")) return x.obligacionId === o.id.replace("OBL-", "");
                        return x.obligacionId === o.id || x.cuotaId === o.id;
                      });

                      return (
                        <div
                          key={o.id}
                          className="group rounded-2xl border border-border/60 bg-background hover:bg-muted/30 hover:border-border transition-all p-4"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm leading-5">{o.concepto}</div>
                              <div className="text-xs text-muted-foreground mt-1">{o.padronLabel}</div>
                            </div>

                            <div className="flex items-center gap-3 sm:gap-4 sm:justify-end">
                              <div className="text-right">
                                <div className="text-[11px] text-muted-foreground">Saldo</div>
                                <div className="text-lg font-semibold tabular-nums">
                                  <Money amount={o.saldo} />
                                </div>
                              </div>

                              <div className="w-36">
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="0.00"
                                  value={row?.monto ?? ""}
                                  onChange={(e) => handleMontoChange(o, e.target.value)}
                                  className="text-right h-11 rounded-xl tabular-nums"
                                />
                              </div>

                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-xl"
                                onClick={() => pagarTodo(o)}
                              >
                                Todo
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Métodos de pago */}
          <Card className="rounded-2xl border-border/60 shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-base">Métodos de pago</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">Seleccioná métodos y montos</p>
                </div>

                {totalMetodos > 0 && (
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Total métodos</div>
                    <div className="text-2xl font-semibold tabular-nums mt-0.5">
                      <Money amount={totalMetodos} />
                    </div>
                  </div>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              {metodos.map((m, i) => (
                <div
                  key={i}
                  className="grid grid-cols-12 gap-3 p-4 rounded-2xl border border-border/60 bg-muted/20"
                >
                  <div className="col-span-12 sm:col-span-4">
                    <Select
                      value={m.metodo}
                      onValueChange={(value) => {
                        const v = [...metodos];
                        v[i].metodo = value as typeof m.metodo;
                        setMetodos(v);
                      }}
                    >
                      <SelectTrigger className="h-11 rounded-xl w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="efectivo">Efectivo</SelectItem>
                        <SelectItem value="tarjeta">Tarjeta</SelectItem>
                        <SelectItem value="mercadopago">MercadoPago</SelectItem>
                        <SelectItem value="otro">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-12 sm:col-span-4">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={m.monto}
                      onChange={(e) => {
                        const v = [...metodos];
                        v[i].monto = e.target.value;
                        setMetodos(v);
                      }}
                      className="h-11 rounded-xl text-right tabular-nums"
                    />
                  </div>

                  <div className="col-span-10 sm:col-span-3">
                    <Input
                      placeholder="Ref. opcional"
                      value={m.ref ?? ""}
                      onChange={(e) => {
                        const v = [...metodos];
                        v[i].ref = e.target.value;
                        setMetodos(v);
                      }}
                      className="h-11 rounded-xl"
                    />
                  </div>

                  <div className="col-span-2 sm:col-span-1 flex items-center justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-xl"
                      onClick={() => setMetodos(metodos.filter((_, j) => j !== i))}
                      disabled={metodos.length === 1}
                      title="Quitar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}

              <Button
                variant="outline"
                size="sm"
                onClick={() => setMetodos([...metodos, { metodo: "efectivo", monto: "0", ref: "" }])}
                className="w-full rounded-2xl border-dashed h-11"
              >
                <Plus className="h-4 w-4 mr-2" />
                Agregar método
                <KeyBadge keys="+" />
              </Button>
            </CardContent>
          </Card>

          {/* Resumen + Confirmar */}
          {(aplic.length > 0 || metodos.some((m) => toNum(m.monto) > 0)) && (
            <Card className="rounded-2xl border-primary/25 bg-primary/5 shadow-sm">
              <CardContent className="p-5 space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-semibold">Resumen del cobro</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Confirmá cuando los totales coincidan
                    </p>
                  </div>

                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Diferencia</div>
                    <div className={`text-lg font-semibold tabular-nums ${Math.abs(diff) > 0.01 ? "text-amber-700" : "text-emerald-700"}`}>
                      <Money amount={Math.abs(diff)} />
                    </div>
                  </div>
                </div>

                <KpiGrid
                  items={[
                    { label: "Total aplicado", value: totalAplic, isMoney: true, variant: "default" },
                    { label: "Total métodos", value: totalMetodos, isMoney: true, variant: "default" },
                  ]}
                />

                {Math.abs(diff) > 0.01 ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <p className="text-sm font-medium text-amber-900">
                      ⚠️ Los totales deben coincidir para confirmar.
                    </p>
                  </div>
                ) : aplic.length > 0 ? (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <p className="text-sm font-medium text-emerald-900 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Totales OK. Listo para confirmar.
                    </p>
                  </div>
                ) : null}

                <Button
                  onClick={cobrar}
                  disabled={!afi || aplic.length === 0 || Math.abs(diff) > 0.01 || loading}
                  size="lg"
                  className="w-full h-12 text-base font-semibold rounded-2xl"
                >
                  <span className="flex items-center justify-center gap-2">
                    {loading ? "Procesando…" : "Confirmar cobro"}
                    {!loading && canConfirmar && <KeyBadge keys="Ctrl+Enter" />}
                  </span>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </PageContainer>
  );
}

export default function CajaCobrosPage() {
  return (
    <AuthGate roles={["CAJA", "TESORERIA", "ADMIN"]}>
      <CajaCobrosInner />
    </AuthGate>
  );
}
