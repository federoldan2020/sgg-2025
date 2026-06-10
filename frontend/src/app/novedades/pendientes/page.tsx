"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { mon, fmtFechaHora } from "@/utiles/formatos";
import { getErrorMessage } from "@/servicios/api";
import {
  cancelarPendiente,
  crearPendienteManual,
  listarPendientes,
  type ConceptoNov,
  type DestinoNov,
  type EstadoNov,
  type NovedadPendiente,
  type TipoNov,
} from "@/servicios/novedades";

const ESTADOS: { value: EstadoNov; label: string }[] = [
  { value: "pendiente", label: "Pendientes" },
  { value: "enviada", label: "Enviadas" },
  { value: "cancelada", label: "Canceladas" },
];

function periodoActualUtc(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function badgeEstado(e: EstadoNov) {
  const map: Record<EstadoNov, { label: string; cls: string }> = {
    pendiente: {
      label: "Pendiente",
      cls: "bg-amber-100 text-amber-800 border-amber-200",
    },
    enviada: {
      label: "Enviada",
      cls: "bg-emerald-100 text-emerald-800 border-emerald-200",
    },
    cancelada: {
      label: "Cancelada",
      cls: "bg-slate-100 text-slate-700 border-slate-200",
    },
  };
  const it = map[e];
  return (
    <Badge variant="outline" className={`${it.cls} text-xs`}>
      {it.label}
    </Badge>
  );
}

function badgeTipo(t: TipoNov) {
  const cls =
    t === "alta"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : t === "baja"
        ? "bg-rose-50 text-rose-700 border-rose-200"
        : "bg-indigo-50 text-indigo-700 border-indigo-200";
  return (
    <Badge variant="outline" className={`${cls} text-xs uppercase`}>
      {t}
    </Badge>
  );
}

export default function NovedadesPendientesPage() {
  const [items, setItems] = useState<NovedadPendiente[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // filtros
  const [fEstado, setFEstado] = useState<EstadoNov | "">("pendiente");
  const [fDestino, setFDestino] = useState<DestinoNov | "">("");
  const [fConcepto, setFConcepto] = useState<ConceptoNov | "">("");
  const [fPeriodo, setFPeriodo] = useState<string>("");

  // dialogs
  const [openNuevo, setOpenNuevo] = useState(false);
  const [openCancelar, setOpenCancelar] = useState<NovedadPendiente | null>(
    null,
  );

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listarPendientes({
        estado: fEstado || undefined,
        destino: fDestino || undefined,
        concepto: fConcepto || undefined,
        periodoObjetivo: fPeriodo || undefined,
        take: 200,
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [fEstado, fDestino, fConcepto, fPeriodo]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const totalPorConcepto = useMemo(() => {
    return items.reduce(
      (acc, it) => {
        acc[it.concepto] = (acc[it.concepto] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
  }, [items]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Novedades pendientes</h1>
          <p className="text-sm text-slate-600">
            Bandeja operator-driven de altas/bajas J17/J22/J38 que se
            consolidarán al generar el lote.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={cargar} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2">Refrescar</span>
          </Button>
          <Link href="/novedades">
            <Button variant="outline">Ir a lotes</Button>
          </Link>
          <Button onClick={() => setOpenNuevo(true)}>
            <Plus className="h-4 w-4 mr-2" /> Nueva novedad
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 bg-white p-4 rounded-lg border">
        <div>
          <Label className="text-xs">Estado</Label>
          <Select
            value={fEstado || "all"}
            onValueChange={(v) => setFEstado(v === "all" ? "" : (v as EstadoNov))}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {ESTADOS.map((e) => (
                <SelectItem key={e.value} value={e.value}>
                  {e.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Destino</Label>
          <Select
            value={fDestino || "all"}
            onValueChange={(v) =>
              setFDestino(v === "all" ? "" : (v as DestinoNov))
            }
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="COMPUTOS">Cómputos</SelectItem>
              <SelectItem value="ANSES">ANSES</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Concepto</Label>
          <Select
            value={fConcepto || "all"}
            onValueChange={(v) =>
              setFConcepto(v === "all" ? "" : (v as ConceptoNov))
            }
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="J17">J17 (Cuota societaria)</SelectItem>
              <SelectItem value="J22">J22 (Coseguro)</SelectItem>
              <SelectItem value="J38">J38 (Colaterales)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Período (YYYY-MM)</Label>
          <Input
            className="mt-1"
            placeholder={periodoActualUtc()}
            value={fPeriodo}
            onChange={(e) => setFPeriodo(e.target.value)}
          />
        </div>
        <div className="flex items-end">
          <Button
            variant="ghost"
            onClick={() => {
              setFEstado("pendiente");
              setFDestino("");
              setFConcepto("");
              setFPeriodo("");
            }}
          >
            Reset
          </Button>
        </div>
      </div>

      {/* Summary chips */}
      <div className="flex gap-2 text-xs">
        <span className="px-2 py-1 rounded bg-slate-100">
          Total: <strong>{total}</strong>
        </span>
        {Object.entries(totalPorConcepto).map(([k, v]) => (
          <span key={k} className="px-2 py-1 rounded bg-slate-100">
            {k}: <strong>{v}</strong>
          </span>
        ))}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg border overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="p-6 text-rose-700 flex items-center gap-2">
            <AlertCircle className="h-5 w-5" /> {error}
          </div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center text-slate-500">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
            No hay novedades con esos filtros.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left p-3">Padrón</th>
                <th className="text-left p-3">Afiliado</th>
                <th className="text-left p-3">Concepto</th>
                <th className="text-left p-3">Tipo</th>
                <th className="text-left p-3">Destino</th>
                <th className="text-right p-3">Valor</th>
                <th className="text-left p-3">Período</th>
                <th className="text-left p-3">Estado</th>
                <th className="text-left p-3">Origen</th>
                <th className="text-left p-3">Creada</th>
                <th className="text-right p-3"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-t hover:bg-slate-50">
                  <td className="p-3 font-mono">{it.padron.padron}</td>
                  <td className="p-3">
                    {it.afiliado.apellido}, {it.afiliado.nombre}
                    <div className="text-xs text-slate-500">
                      DNI {it.afiliado.dni}
                    </div>
                  </td>
                  <td className="p-3 font-semibold">{it.concepto}</td>
                  <td className="p-3">{badgeTipo(it.tipoMovimiento)}</td>
                  <td className="p-3 text-xs">{it.destino}</td>
                  <td className="p-3 text-right font-mono">
                    {it.valor != null ? mon(it.valor) : "—"}
                  </td>
                  <td className="p-3 font-mono">{it.periodoObjetivo}</td>
                  <td className="p-3">{badgeEstado(it.estado)}</td>
                  <td className="p-3 text-xs text-slate-500">
                    {it.origenEvento}
                  </td>
                  <td className="p-3 text-xs">{fmtFechaHora(it.creadoEn)}</td>
                  <td className="p-3 text-right">
                    {it.estado === "pendiente" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setOpenCancelar(it)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {openNuevo ? (
        <DialogNuevaNovedad
          onClose={() => setOpenNuevo(false)}
          onCreated={() => {
            setOpenNuevo(false);
            cargar();
          }}
        />
      ) : null}
      {openCancelar ? (
        <DialogCancelar
          pendiente={openCancelar}
          onClose={() => setOpenCancelar(null)}
          onDone={() => {
            setOpenCancelar(null);
            cargar();
          }}
        />
      ) : null}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Dialog: cancelar
// ────────────────────────────────────────────────────────────
function DialogCancelar({
  pendiente,
  onClose,
  onDone,
}: {
  pendiente: NovedadPendiente;
  onClose: () => void;
  onDone: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!motivo.trim()) {
      setError("Indicá un motivo");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await cancelarPendiente(pendiente.id, motivo.trim());
      onDone();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancelar novedad pendiente</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-sm bg-slate-50 p-3 rounded">
            <div>
              <strong>Padrón:</strong> {pendiente.padron.padron}
            </div>
            <div>
              <strong>{pendiente.concepto}</strong>{" "}
              {pendiente.tipoMovimiento.toUpperCase()} — período{" "}
              {pendiente.periodoObjetivo}
            </div>
          </div>
          <div>
            <Label>Motivo</Label>
            <Input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Por qué se cancela"
            />
          </div>
          {error ? (
            <div className="text-sm text-rose-700">{error}</div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Volver
          </Button>
          <Button variant="error" onClick={submit} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Cancelar novedad"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ────────────────────────────────────────────────────────────
// Dialog: alta manual
// ────────────────────────────────────────────────────────────
function DialogNuevaNovedad({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [padronId, setPadronId] = useState("");
  const [afiliadoId, setAfiliadoId] = useState("");
  const [concepto, setConcepto] = useState<ConceptoNov>("J17");
  const [tipo, setTipo] = useState<TipoNov>("alta");
  const [destino, setDestino] = useState<DestinoNov>("COMPUTOS");
  const [valor, setValor] = useState("");
  const [periodo, setPeriodo] = useState(periodoActualUtc());
  const [observacion, setObservacion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!padronId || !afiliadoId || !periodo) {
      setError("Faltan datos obligatorios");
      return;
    }
    if (tipo !== "baja" && (!valor || Number(valor) <= 0)) {
      setError("Valor obligatorio para alta/modificación");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await crearPendienteManual({
        padronId,
        afiliadoId,
        concepto,
        tipoMovimiento: tipo,
        destino,
        valor: tipo === "baja" ? undefined : Number(valor),
        periodoObjetivo: periodo,
        observacion: observacion || undefined,
      });
      onCreated();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Cargar novedad manual</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Padrón ID</Label>
            <Input
              value={padronId}
              onChange={(e) => setPadronId(e.target.value)}
              placeholder="bigint padronId"
            />
          </div>
          <div>
            <Label>Afiliado ID</Label>
            <Input
              value={afiliadoId}
              onChange={(e) => setAfiliadoId(e.target.value)}
              placeholder="bigint afiliadoId"
            />
          </div>
          <div>
            <Label>Concepto</Label>
            <Select value={concepto} onValueChange={(v) => setConcepto(v as ConceptoNov)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="J17">J17 (Cuota societaria)</SelectItem>
                <SelectItem value="J22">J22 (Coseguro)</SelectItem>
                <SelectItem value="J38">J38 (Colaterales)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoNov)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="baja">Baja</SelectItem>
                <SelectItem value="modificacion">Modificación</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Destino</Label>
            <Select value={destino} onValueChange={(v) => setDestino(v as DestinoNov)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="COMPUTOS">Cómputos</SelectItem>
                <SelectItem value="ANSES">ANSES (solo J17)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Período (YYYY-MM)</Label>
            <Input value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
          </div>
          {tipo !== "baja" ? (
            <div className="col-span-2">
              <Label>
                Valor {concepto === "J17" ? "(porcentaje, ej: 2)" : "(pesos)"}
              </Label>
              <Input
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                type="number"
                step="0.01"
              />
            </div>
          ) : null}
          <div className="col-span-2">
            <Label>Observación (opcional)</Label>
            <Input
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
            />
          </div>
        </div>
        {error ? <div className="text-sm text-rose-700">{error}</div> : null}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
