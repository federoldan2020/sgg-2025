"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { cajaService } from "@/servicios/cajaService";
import { getErrorMessage } from "@/servicios/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageContainer, PageHeader, KpiGrid, Money } from "@/components/ui-kit";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Lock,
  Plus,
  Trash2,
  XCircle,
} from "lucide-react";

type Row = { metodo: string; teorico: string; declarado: string };

const toNum = (v: string) => {
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

export default function CierreCajaPage() {
  const router = useRouter();
  const [cajaId, setCajaId] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([
    { metodo: "efectivo", teorico: "0", declarado: "0" },
    { metodo: "tarjeta", teorico: "0", declarado: "0" },
    { metodo: "mercadopago", teorico: "0", declarado: "0" },
  ]);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgType, setMsgType] = useState<"success" | "error" | null>(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    (async () => {
      const st = await cajaService.estado();
      if (!st.abierta || !st.cajaId) return router.replace("/caja/apertura");
      setCajaId(st.cajaId);
    })();
  }, [router]);

  const totalTeorico = useMemo(() => rows.reduce((a, r) => a + toNum(r.teorico), 0), [rows]);
  const totalDeclarado = useMemo(() => rows.reduce((a, r) => a + toNum(r.declarado), 0), [rows]);
  const diffTotal = useMemo(() => +(totalDeclarado - totalTeorico).toFixed(2), [totalDeclarado, totalTeorico]);
  const cuadra = Math.abs(diffTotal) <= 0.01;

  const setRow = (i: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const cerrar = async () => {
    try {
      if (!cajaId) return;
      setClosing(true);
      setMsg(null);
      setMsgType(null);
      const r = await cajaService.cerrarLote(
        cajaId,
        rows.map((r) => ({
          metodo: r.metodo || null,
          declarado: toNum(r.declarado),
          teorico: toNum(r.teorico),
        }))
      );
      setMsg(
        r.asientoId
          ? `Cierre registrado. Diferencia $${fmt(r.diff)} — Asiento #${r.asientoId}`
          : `Cierre sin diferencias. Δ $${fmt(r.diff)}`
      );
      setMsgType("success");
      router.replace("/caja/apertura");
    } catch (e) {
      setMsg(`Error en cierre: ${getErrorMessage(e)}`);
      setMsgType("error");
      setClosing(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Cierre de Caja"
        subtitle={cajaId ? `Caja #${cajaId} · Arqueo por método de pago` : "Arqueo por método de pago"}
      >
        <Button variant="outline" onClick={() => router.push("/caja")} className="rounded-xl">
          <ArrowLeft className="h-4 w-4" />
          Volver a cobros
        </Button>
      </PageHeader>

      {/* Mensaje */}
      {msg && (
        <Card
          className={`rounded-2xl border shadow-sm ${
            msgType === "success" ? "bg-emerald-50 border-emerald-300" : "bg-rose-50 border-rose-300"
          }`}
        >
          <CardContent className="flex items-start gap-3 p-5">
            {msgType === "success" ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
            ) : (
              <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" />
            )}
            <p className="text-sm font-medium">{msg}</p>
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      <KpiGrid
        className="lg:grid-cols-3"
        items={[
          { label: "Total teórico", value: totalTeorico, isMoney: true },
          { label: "Total declarado", value: totalDeclarado, isMoney: true },
          {
            label: "Diferencia",
            value: diffTotal,
            isMoney: true,
            hint: cuadra ? "Caja cuadrada" : diffTotal > 0 ? "Sobrante" : "Faltante",
            variant: cuadra ? "positive" : "negative",
          },
        ]}
      />

      {/* Arqueo por método */}
      <Card className="rounded-2xl border-border/60 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Arqueo por método</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Ingresá el monto declarado (contado) frente al teórico del sistema
          </p>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Encabezado de columnas (desktop) */}
          <div className="hidden grid-cols-12 gap-3 px-4 sm:grid">
            <div className="col-span-4 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Método
            </div>
            <div className="col-span-3 text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Teórico
            </div>
            <div className="col-span-3 text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Declarado
            </div>
            <div className="col-span-2 text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Δ
            </div>
          </div>

          {rows.map((r, i) => {
            const d = +(toNum(r.declarado) - toNum(r.teorico)).toFixed(2);
            const rowOk = Math.abs(d) <= 0.01;
            return (
              <div
                key={i}
                className="grid grid-cols-12 items-center gap-3 rounded-2xl border border-border/60 bg-muted/20 p-4"
              >
                <div className="col-span-12 sm:col-span-4">
                  <span className="mb-1 block text-[11px] text-muted-foreground sm:hidden">Método</span>
                  <Select value={r.metodo} onValueChange={(value) => setRow(i, { metodo: value })}>
                    <SelectTrigger className="h-11 w-full rounded-xl">
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

                <div className="col-span-6 sm:col-span-3">
                  <span className="mb-1 block text-[11px] text-muted-foreground sm:hidden">Teórico</span>
                  <Input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    value={r.teorico}
                    onChange={(e) => setRow(i, { teorico: e.target.value })}
                    className="h-11 rounded-xl text-right tabular-nums"
                  />
                </div>

                <div className="col-span-6 sm:col-span-3">
                  <span className="mb-1 block text-[11px] text-muted-foreground sm:hidden">Declarado</span>
                  <Input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    value={r.declarado}
                    onChange={(e) => setRow(i, { declarado: e.target.value })}
                    className="h-11 rounded-xl text-right tabular-nums"
                  />
                </div>

                <div className="col-span-9 text-right sm:col-span-1">
                  <span className="mb-1 block text-[11px] text-muted-foreground sm:hidden">Diferencia</span>
                  <span
                    className={`text-sm font-semibold tabular-nums ${
                      rowOk ? "text-emerald-700" : "text-rose-600"
                    }`}
                  >
                    <Money amount={d} />
                  </span>
                </div>

                <div className="col-span-3 flex items-center justify-end sm:col-span-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-xl"
                    onClick={() => setRows(rows.filter((_, j) => j !== i))}
                    disabled={rows.length <= 1}
                    title="Quitar método"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setRows([...rows, { metodo: "otro", teorico: "0", declarado: "0" }])}
            className="h-11 w-full rounded-2xl border-dashed"
          >
            <Plus className="h-4 w-4" />
            Agregar método
          </Button>
        </CardContent>
      </Card>

      {/* Confirmación */}
      <Card className="rounded-2xl border-primary/25 bg-primary/5 shadow-sm">
        <CardContent className="space-y-5 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold">Confirmar cierre</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Revisá el arqueo antes de cerrar la caja
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Diferencia total</div>
              <div
                className={`text-lg font-semibold tabular-nums ${
                  cuadra ? "text-emerald-700" : "text-rose-600"
                }`}
              >
                <Money amount={diffTotal} />
              </div>
            </div>
          </div>

          {cuadra ? (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" />
              <p className="text-sm font-medium text-emerald-900">
                La caja cuadra. No se generará ningún ajuste.
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              <p className="text-sm font-medium text-amber-900">
                Hay un {diffTotal > 0 ? "sobrante" : "faltante"} de{" "}
                <span className="tabular-nums">$ {fmt(Math.abs(diffTotal))}</span>. Se registrará un
                asiento de ajuste al confirmar.
              </p>
            </div>
          )}

          <Button
            onClick={cerrar}
            disabled={closing || !cajaId}
            size="lg"
            className="h-12 w-full rounded-2xl text-base font-semibold"
          >
            {closing ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Cerrando caja…
              </>
            ) : (
              <>
                <Lock className="h-5 w-5" />
                Confirmar cierre
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
