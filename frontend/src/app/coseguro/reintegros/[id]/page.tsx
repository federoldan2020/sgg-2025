"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, getErrorMessage } from "@/servicios/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  ArrowLeft,
  Calendar,
  DollarSign,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  FileText,
  Link as LinkIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { mon } from "@/utiles/formatos";

type Solicitud = {
  id: string;
  afiliadoId: string;
  familiarId?: string | null;
  personaTipo: "TITULAR" | "FAMILIAR";
  tipo: "MEDICAMENTO" | "PRACTICA";
  estado: string;
  fechaFactura: string;
  fechaPresentacion?: string | null;
  importeTotal: string;
  importeReintegro?: string | null;
  importeAprobado?: string | null;
  afiliado?: { apellido?: string | null; nombre?: string | null } | null;
  familiar?: { nombre?: string | null } | null;
  items: {
    id: string;
    descripcion: string;
    cantidad: number;
    importe: string;
    porcentaje?: string | null;
    tipoItem: string;
  }[];
  adjuntos: { id: string; tipoAdjunto: string; url: string }[];
  historial: {
    id: string;
    estadoAnterior?: string | null;
    estadoNuevo: string;
    observacion?: string | null;
    actorId?: string | null;
    fecha: string;
  }[];
  pagos: {
    id: string;
    ordenPagoId?: string | null;
    monto: string;
    medioPago: string;
    estadoPago: string;
    fechaPago?: string | null;
    comprobante?: { numeroCompleto?: string | null; pdfStorageKey?: string | null };
  }[];
};

const ADJUNTOS = ["FACTURA", "RECETA", "ORDEN", "INFORME", "OTRO"] as const;

const ESTADO_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: LucideIcon }
> = {
  BORRADOR: { label: "Borrador", variant: "outline", icon: FileText },
  PRESENTADO: { label: "Presentado", variant: "secondary", icon: Clock },
  EN_REVISION: { label: "En revisión", variant: "secondary", icon: Clock },
  OBSERVADO: { label: "Observado", variant: "outline", icon: AlertCircle },
  APROBADO: { label: "Aprobado", variant: "default", icon: CheckCircle2 },
  A_PAGAR: { label: "A pagar", variant: "secondary", icon: Clock },
  PAGADO: { label: "Pagado", variant: "default", icon: CheckCircle2 },
  RECHAZADO: { label: "Rechazado", variant: "destructive", icon: XCircle },
  CERRADO: { label: "Cerrado", variant: "outline", icon: CheckCircle2 },
};

function EstadoBadge({ estado }: { estado: string }) {
  const config = ESTADO_CONFIG[estado] ?? { label: estado, variant: "outline" as const, icon: AlertCircle };
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="inline-flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5" />
      {config.label}
    </Badge>
  );
}

function fmtDate(dateLike?: string | null) {
  if (!dateLike) return "—";
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtDateTime(dateLike?: string | null) {
  if (!dateLike) return "—";
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ReintegroDetallePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id as string;

  const [data, setData] = useState<Solicitud | null>(null);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Acciones
  const [observacion, setObservacion] = useState("");
  const [importeAprobado, setImporteAprobado] = useState("");

  // Adjuntos
  const [adjTipo, setAdjTipo] = useState<(typeof ADJUNTOS)[number]>("FACTURA");
  const [adjUrl, setAdjUrl] = useState("");

  const personaNombre = useMemo(() => {
    if (!data) return "—";
    if (data.personaTipo === "FAMILIAR" && data.familiar?.nombre) return data.familiar.nombre;
    if (data.afiliado) {
      const apellido = data.afiliado.apellido || "";
      const nombre = data.afiliado.nombre || "";
      return `${apellido} ${nombre}`.trim() || "—";
    }
    return "—";
  }, [data]);

  const importeTotal = useMemo(() => Number(data?.importeTotal || 0), [data]);

  const importeReintegro = useMemo(() => {
    if (!data) return 0;
    if (data.importeReintegro != null) return Number(data.importeReintegro);

    return data.items.reduce((acc, it) => {
      const cantidad = Number(it.cantidad || 0);
      const importe = Number(it.importe || 0);
      const porcentaje = Number(it.porcentaje ?? 100);
      const subtotal = cantidad * importe;
      return acc + subtotal * (porcentaje / 100);
    }, 0);
  }, [data]);

  const cargar = async () => {
    try {
      setIsLoading(true);
      const res = await api<Solicitud>(`/reintegros/solicitudes/${id}`);
      setData(res);
    } catch (e) {
      setMsg({ type: "error", text: getErrorMessage(e) });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (id) void cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const accion = async (path: string, body?: unknown) => {
    try {
      setIsLoading(true);
      await api(path, { method: "PATCH", body: JSON.stringify(body ?? {}) });
      setMsg({ type: "success", text: "Acción aplicada correctamente" });
      await cargar();
    } catch (e) {
      setMsg({ type: "error", text: getErrorMessage(e) });
    } finally {
      setIsLoading(false);
    }
  };

  const agregarAdjunto = async () => {
    try {
      if (!adjUrl.trim()) return;
      setIsLoading(true);
      await api(`/reintegros/solicitudes/${id}/adjuntos`, {
        method: "POST",
        body: JSON.stringify({ tipoAdjunto: adjTipo, url: adjUrl.trim() }),
      });
      setAdjUrl("");
      setMsg({ type: "success", text: "Adjunto agregado correctamente" });
      await cargar();
    } catch (e) {
      setMsg({ type: "error", text: getErrorMessage(e) });
    } finally {
      setIsLoading(false);
    }
  };


  // Loading state “premium”
  if (!data) {
    return (
      <main className="max-w-[1200px] mx-auto px-6 py-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Cargando solicitud…</CardTitle>
            <CardDescription>Obteniendo datos del reintegro</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-28 rounded-lg border border-border/60 bg-muted/20" />
          </CardContent>
        </Card>
      </main>
    );
  }

  const ratio = importeTotal > 0 ? (importeReintegro / importeTotal) * 100 : 0;

  return (
    <main className="max-w-[1200px] mx-auto px-6 py-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/coseguro/reintegros")}
            className="h-9 w-9 mt-0.5"
            title="Volver"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Detalle de solicitud</h1>
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{personaNombre}</span>
              <span className="mx-2">·</span>
              <span>{data.tipo}</span>
              <span className="mx-2">·</span>
              <span className="font-mono text-xs">#{data.id}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <EstadoBadge estado={data.estado} />
        </div>
      </div>

      {/* Mensajes */}
      {msg && (
        <Alert variant={msg.type === "error" ? "destructive" : "default"} className="border-l-4">
          <AlertDescription className="flex items-start justify-between gap-3">
            <span className="text-sm">{msg.text}</span>
            <button className="text-xs underline shrink-0" onClick={() => setMsg(null)}>
              Cerrar
            </button>
          </AlertDescription>
        </Alert>
      )}

      {/* Layout principal: contenido + panel lateral */}
      <section className="grid grid-cols-12 gap-4">
        {/* Columna principal */}
        <div className="col-span-12 lg:col-span-8 space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Total factura
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold tabular-nums">{mon(importeTotal)}</div>
              </CardContent>
            </Card>

            <Card className="border border-emerald-200/60 bg-emerald-50/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-emerald-700 font-medium flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Reintegro estimado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold tabular-nums text-emerald-700">{mon(importeReintegro)}</div>
                <div className="text-xs text-emerald-700/80 mt-1 tabular-nums">{ratio.toFixed(1)}% del total</div>
              </CardContent>
            </Card>

            <Card className="border border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Fecha factura
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{fmtDate(data.fechaFactura)}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Presentación: {fmtDate(data.fechaPresentacion)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Items */}
          <Card className="border border-border/60">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Ítems</CardTitle>
              <CardDescription>Detalle de medicamentos o prácticas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-border/60 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Descripción
                      </TableHead>
                      <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground text-center">
                        Cant.
                      </TableHead>
                      <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground text-right">
                        Unit.
                      </TableHead>
                      <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground text-right">
                        Cobertura
                      </TableHead>
                      <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground text-right">
                        Subtotal
                      </TableHead>
                      <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground text-right">
                        Reintegro
                      </TableHead>
                      <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Tipo
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.items.map((it) => {
                      const cantidad = Number(it.cantidad || 0);
                      const importe = Number(it.importe || 0);
                      const porcentaje = Number(it.porcentaje ?? 100);
                      const subtotal = cantidad * importe;
                      const reintegro = subtotal * (porcentaje / 100);

                      return (
                        <TableRow key={it.id} className="hover:bg-muted/30">
                          <TableCell className="py-3">
                            <div className="text-sm font-medium">{it.descripcion}</div>
                          </TableCell>
                          <TableCell className="py-3 text-center tabular-nums">{cantidad}</TableCell>
                          <TableCell className="py-3 text-right tabular-nums">{mon(importe)}</TableCell>
                          <TableCell className="py-3 text-right tabular-nums">
                            <Badge variant="outline" className="tabular-nums">
                              {porcentaje.toFixed(1)}%
                            </Badge>
                          </TableCell>
                          <TableCell className="py-3 text-right tabular-nums font-medium">{mon(subtotal)}</TableCell>
                          <TableCell className="py-3 text-right tabular-nums font-semibold text-emerald-700">
                            {mon(reintegro)}
                          </TableCell>
                          <TableCell className="py-3">
                            <Badge variant="secondary" className="text-xs">
                              {it.tipoItem}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <Separator />

              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-end gap-4">
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Total factura</div>
                  <div className="text-lg font-semibold tabular-nums">{mon(importeTotal)}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Total reintegro</div>
                  <div className="text-lg font-semibold tabular-nums text-emerald-700">{mon(importeReintegro)}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Adjuntos */}
          <Card className="border border-border/60">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Adjuntos</CardTitle>
              <CardDescription>Documentación asociada</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-border/60 p-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Select value={adjTipo} onValueChange={(v) => setAdjTipo(v as typeof ADJUNTOS[number])}>
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ADJUNTOS.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Input
                    className="h-10"
                    placeholder="Pegá el link del archivo (Drive / Dropbox / etc.)"
                    value={adjUrl}
                    onChange={(e) => setAdjUrl(e.target.value)}
                  />

                  <Button onClick={agregarAdjunto} disabled={!adjUrl.trim() || isLoading} className="h-10">
                    Agregar
                  </Button>
                </div>

                <div className="text-xs text-muted-foreground mt-2">
                  Tip: usá un enlace accesible al operador (por ejemplo, un link compartido).
                </div>
              </div>

              {data.adjuntos.length === 0 ? (
                <div className="rounded-xl border border-border/60 p-6 text-center">
                  <div className="text-sm font-medium text-muted-foreground">Sin adjuntos</div>
                  <div className="text-xs text-muted-foreground mt-1">Cuando agregues uno, aparecerá acá.</div>
                </div>
              ) : (
                <div className="rounded-xl border border-border/60 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Tipo
                        </TableHead>
                        <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Enlace
                        </TableHead>
                        <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground text-right">
                          Acción
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.adjuntos.map((a) => (
                        <TableRow key={a.id} className="hover:bg-muted/30">
                          <TableCell className="py-3">
                            <Badge variant="outline">{a.tipoAdjunto}</Badge>
                          </TableCell>
                          <TableCell className="py-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <LinkIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                              <a
                                href={a.url}
                                className="text-sm text-blue-600 hover:underline truncate"
                                target="_blank"
                                rel="noreferrer"
                                title={a.url}
                              >
                                {a.url}
                              </a>
                            </div>
                          </TableCell>
                          <TableCell className="py-3 text-right">
                            <Button variant="outline" size="sm" onClick={() => window.open(a.url, "_blank")}>
                              Abrir
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>


          {/* Historial */}
          <Card className="border border-border/60">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Historial</CardTitle>
              <CardDescription>Cambios de estado y observaciones</CardDescription>
            </CardHeader>
            <CardContent>
              {data.historial.length === 0 ? (
                <div className="rounded-xl border border-border/60 p-6 text-center">
                  <div className="text-sm font-medium text-muted-foreground">Sin historial</div>
                  <div className="text-xs text-muted-foreground mt-1">Los movimientos aparecerán acá.</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.historial.map((h) => (
                    <div key={h.id} className="rounded-xl border border-border/60 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <EstadoBadge estado={h.estadoNuevo} />
                        <span className="text-xs text-muted-foreground">{fmtDateTime(h.fecha)}</span>
                      </div>

                      {h.observacion ? (
                        <p className="text-sm text-muted-foreground mt-2">{h.observacion}</p>
                      ) : null}

                      {h.estadoAnterior ? (
                        <div className="text-xs text-muted-foreground/80 mt-2">
                          Anterior: <span className="font-medium">{h.estadoAnterior}</span>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Panel lateral: info + acciones (sticky) */}
        <aside className="col-span-12 lg:col-span-4 space-y-4 lg:sticky lg:top-6 self-start">
          {/* Info rápida */}
          <Card className="border border-border/60">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Resumen</CardTitle>
              <CardDescription>Datos clave para el operador</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-muted-foreground">Persona</div>
                  <div className="text-sm font-medium">{personaNombre}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {data.personaTipo === "FAMILIAR" ? "Familiar" : "Titular"}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">Estado</div>
                  <div className="mt-1">
                    <EstadoBadge estado={data.estado} />
                  </div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">Tipo</div>
                  <div className="mt-1">
                    <Badge variant="outline">{data.tipo}</Badge>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">Aprobado</div>
                  <div className="text-sm font-semibold tabular-nums mt-1">
                    {data.importeAprobado ? mon(data.importeAprobado) : "—"}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">Total</div>
                <div className="text-sm font-semibold tabular-nums">{mon(importeTotal)}</div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">Reintegro</div>
                <div className="text-sm font-semibold tabular-nums text-emerald-700">{mon(importeReintegro)}</div>
              </div>
            </CardContent>
          </Card>

          {/* Acciones (más claro para usuario) */}
          <Card className="border border-border/60">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Acciones</CardTitle>
              <CardDescription>Usá estos pasos para gestionar la solicitud</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Observación */}
              <div className="rounded-xl border border-border/60 p-3 space-y-2">
                <div className="text-sm font-medium">Observación</div>
                <textarea
                  className="min-h-[84px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/20"
                  placeholder="Escribí un comentario breve (visible en el historial)…"
                  value={observacion}
                  onChange={(e) => setObservacion(e.target.value)}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Button
                    onClick={() => accion(`/reintegros/solicitudes/${id}/presentar`, { observacion })}
                    disabled={isLoading}
                    className="h-10"
                  >
                    Presentar
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => accion(`/reintegros/solicitudes/${id}/observar`, { observacion })}
                    disabled={isLoading || !observacion.trim()}
                    className="h-10"
                    title={!observacion.trim() ? "Agregá una observación para marcar como observado" : undefined}
                  >
                    Observar
                  </Button>
                </div>
              </div>

              {/* Aprobar / Rechazar */}
              <div className="rounded-xl border border-border/60 p-3 space-y-2">
                <div className="text-sm font-medium">Aprobación</div>
                <Input
                  className="h-10"
                  placeholder="Importe aprobado (opcional)"
                  value={importeAprobado}
                  onChange={(e) => setImporteAprobado(e.target.value)}
                  type="number"
                  step="0.01"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Button
                    variant="secondary"
                    onClick={() =>
                      accion(`/reintegros/solicitudes/${id}/aprobar`, {
                        observacion,
                        importeAprobado: importeAprobado ? Number(importeAprobado) : undefined,
                      })
                    }
                    disabled={isLoading}
                    className="h-10"
                  >
                    Aprobar
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => accion(`/reintegros/solicitudes/${id}/rechazar`, { observacion })}
                    disabled={isLoading || !observacion.trim()}
                    className="h-10"
                    title={!observacion.trim() ? "Agregá una observación para rechazar" : undefined}
                  >
                    Rechazar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>
      </section>
    </main>
  );
}
