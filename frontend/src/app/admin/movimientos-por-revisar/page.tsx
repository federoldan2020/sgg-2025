"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Link2,
  Loader2,
  RotateCcw,
  Search,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getErrorMessage } from "@/servicios/api";
import {
  movimientosAdmin,
  type MovimientoPorRevisar,
} from "@/servicios/movimientosAdmin";

const money = (n: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(n);

const fmtFecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

export default function MovimientosPorRevisarPage() {
  const [items, setItems] = useState<MovimientoPorRevisar[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [filtroDni, setFiltroDni] = useState("");
  const [dniDebounced, setDniDebounced] = useState("");

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await movimientosAdmin.porRevisar({ page, pageSize });
      setItems(r.items);
      setTotal(r.total);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Debounce del filtro DNI (no llega al server: filtra en memoria sobre la página actual).
  useEffect(() => {
    const t = setTimeout(() => setDniDebounced(filtroDni.trim()), 200);
    return () => clearTimeout(t);
  }, [filtroDni]);

  const visibles = dniDebounced
    ? items.filter(
        (m) =>
          (m.afiliado.dni ?? "").includes(dniDebounced) ||
          m.afiliado.apellidoNombre
            .toLowerCase()
            .includes(dniDebounced.toLowerCase()),
      )
    : items;

  const aceptar = async (id: string) => {
    if (!confirm("¿Aceptar este crédito como saldo a favor definitivo del padrón?")) return;
    setBusy(id);
    try {
      await movimientosAdmin.aceptarSaldoFavor(id);
      await cargar();
    } catch (e) {
      alert(`Error: ${getErrorMessage(e)}`);
    } finally {
      setBusy(null);
    }
  };

  const vincular = async (id: string) => {
    const obligacionId = prompt(
      "ID de la Obligación a vincular este crédito:",
    );
    if (!obligacionId) return;
    setBusy(id);
    try {
      const r = await movimientosAdmin.vincularObligacion(id, obligacionId.trim());
      alert(
        `Vinculado. Obligación quedó en ${r.obligacionEstado} con saldo ${money(
          r.obligacionSaldoFinal,
        )}.`,
      );
      await cargar();
    } catch (e) {
      alert(`Error: ${getErrorMessage(e)}`);
    } finally {
      setBusy(null);
    }
  };

  const anular = async (id: string) => {
    const motivo = prompt("Motivo de la anulación (obligatorio):");
    if (!motivo || !motivo.trim()) return;
    if (
      !confirm(
        "Esto crea un movimiento inverso que neutraliza el impacto en el saldo. ¿Continuar?",
      )
    )
      return;
    setBusy(id);
    try {
      await movimientosAdmin.anular(id, motivo.trim());
      await cargar();
    } catch (e) {
      alert(`Error: ${getErrorMessage(e)}`);
    } finally {
      setBusy(null);
    }
  };

  const totalPaginas = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700 ring-1 ring-amber-100">
          <AlertTriangle className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            Movimientos por revisar
          </h1>
          <p className="text-sm text-neutral-500">
            Créditos huérfanos: cobranzas de nómina sin obligación matcheada
            o excedentes que quedaron como saldo a favor sin destino claro.
          </p>
        </div>
      </header>

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative min-w-[260px] flex-1">
            <Search className="pointer-events-none absolute inset-y-0 left-3 my-auto h-4 w-4 text-muted-foreground/80" />
            <Input
              placeholder="Filtrar por DNI o nombre…"
              value={filtroDni}
              onChange={(e) => setFiltroDni(e.target.value)}
              className="h-10 pl-10"
            />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>
              Total: <strong className="text-foreground">{total}</strong> pendientes
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={cargar}
              disabled={loading}
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Refrescar
            </Button>
          </div>
        </div>
      </Card>

      {error && (
        <Card className="border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b">
                <TableHead className="w-[110px]">Fecha</TableHead>
                <TableHead>Afiliado</TableHead>
                <TableHead>Padrón</TableHead>
                <TableHead>Concepto</TableHead>
                <TableHead className="text-right">Importe</TableHead>
                <TableHead className="text-right">Saldo padrón</TableHead>
                <TableHead className="text-center w-[280px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && visibles.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              )}
              {!loading && visibles.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-500" />
                    Sin movimientos por revisar.
                  </TableCell>
                </TableRow>
              )}
              {visibles.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{fmtFecha(m.fecha)}</TableCell>
                  <TableCell>
                    <div className="font-semibold">{m.afiliado.apellidoNombre || "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      DNI {m.afiliado.dni ?? "—"} · ID {m.afiliado.id}
                    </div>
                  </TableCell>
                  <TableCell>
                    {m.padron.numero ? (
                      <Badge variant="outline" className="font-mono">
                        {m.padron.numero}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                    {m.periodoContable && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {m.periodoContable}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[280px]">
                    <div className="truncate text-sm">{m.concepto}</div>
                    <Badge
                      variant="secondary"
                      className="mt-1 rounded text-[10px] uppercase"
                    >
                      {m.origen.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums text-emerald-700">
                    {money(m.importe)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {m.saldoPadronActual != null ? (
                      <span
                        className={
                          m.saldoPadronActual < 0
                            ? "text-emerald-700 font-semibold"
                            : m.saldoPadronActual > 0
                              ? "text-rose-700"
                              : ""
                        }
                      >
                        {money(m.saldoPadronActual)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => vincular(m.id)}
                        disabled={busy === m.id}
                        title="Vincular a una Obligación específica"
                      >
                        <Link2 className="mr-1 h-3.5 w-3.5" />
                        Vincular
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => aceptar(m.id)}
                        disabled={busy === m.id}
                        title="Aceptar como saldo a favor definitivo"
                      >
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                        Aceptar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => anular(m.id)}
                        disabled={busy === m.id}
                        title="Anular (genera movimiento inverso)"
                        className="text-red-700 hover:bg-red-50"
                      >
                        <XCircle className="mr-1 h-3.5 w-3.5" />
                        Anular
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {totalPaginas > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
          >
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {page} de {totalPaginas}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPaginas, p + 1))}
            disabled={page >= totalPaginas || loading}
          >
            Siguiente
          </Button>
        </div>
      )}
    </div>
  );
}
