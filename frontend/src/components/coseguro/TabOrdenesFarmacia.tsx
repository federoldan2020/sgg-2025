"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ui-kit/ConfirmDialog";
import { Money } from "@/components/ui-kit/Money";
import {
  obtenerSaldoOrdenes,
  listarConsumosOrdenes,
  anularConsumoAdmin,
  type SaldoOrdenes,
  type ConsumoOrden,
} from "@/servicios/farmacias";
import { getErrorMessage } from "@/servicios/api";

type Props = {
  afiliadoId: string;
};

function periodoActual(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function fmtPeriodo(p: string): string {
  if (!/^\d{6}$/.test(p)) return p;
  return `${p.slice(4, 6)}/${p.slice(0, 4)}`;
}

export function TabOrdenesFarmacia({ afiliadoId }: Props) {
  const [periodo, setPeriodo] = React.useState(periodoActual());
  const [saldo, setSaldo] = React.useState<SaldoOrdenes | null>(null);
  const [consumos, setConsumos] = React.useState<ConsumoOrden[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const [delOpen, setDelOpen] = React.useState(false);
  const [delTarget, setDelTarget] = React.useState<ConsumoOrden | null>(null);

  const refresh = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [s, c] = await Promise.all([
        obtenerSaldoOrdenes(afiliadoId, periodo),
        listarConsumosOrdenes(afiliadoId, periodo),
      ]);
      setSaldo(s);
      setConsumos(c);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [afiliadoId, periodo]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const onAnular = async (motivo?: string) => {
    if (!delTarget || !motivo) return;
    try {
      setBusy(true);
      await anularConsumoAdmin(delTarget.id, motivo);
      setDelOpen(false);
      setDelTarget(null);
      await refresh();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Cupo del período</CardTitle>
            <CardDescription>
              Período {fmtPeriodo(periodo)} — el reset el día 1 es implícito.
            </CardDescription>
          </div>
          <div className="flex items-end gap-2">
            <div>
              <label className="block text-xs font-medium text-neutral-600">
                Período (YYYYMM)
              </label>
              <Input
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="h-9 w-32 tabular-nums"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-16 w-full" />
          ) : error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          ) : saldo ? (
            <div className="grid grid-cols-3 gap-4">
              <KpiInline label="Cupo total" value={String(saldo.cupo)} />
              <KpiInline
                label="Consumidas"
                value={String(saldo.consumidas)}
                muted={saldo.consumidas === 0}
              />
              <KpiInline
                label="Disponibles"
                value={String(saldo.disponibles)}
                warning={saldo.disponibles === 0}
              />
            </div>
          ) : (
            <div className="text-sm text-neutral-500">Sin datos.</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Consumos del período</CardTitle>
          <CardDescription>
            Cada orden registrada por farmacia interna o externa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : consumos.length === 0 ? (
            <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center text-sm text-neutral-500">
              Sin consumos en este período.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-neutral-200">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-xs uppercase text-neutral-600">
                  <tr>
                    <th className="px-3 py-2 text-right">#</th>
                    <th className="px-3 py-2 text-left">Fecha</th>
                    <th className="px-3 py-2 text-left">Farmacia</th>
                    <th className="px-3 py-2 text-left">Quién consumió</th>
                    <th className="px-3 py-2 text-right">Monto</th>
                    <th className="px-3 py-2 text-center">Estado</th>
                    <th className="px-3 py-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {consumos.map((c) => (
                    <tr key={c.id} className="hover:bg-neutral-50">
                      <td className="px-3 py-2 text-right text-xs font-mono tabular-nums">
                        {c.numeroOrdenEnMes}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {c.consumidaEn.slice(0, 16).replace("T", " ")}
                      </td>
                      <td className="px-3 py-2">
                        {c.farmacia ? (
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{c.farmacia.nombre}</span>
                            <Badge variant={c.farmacia.esInterna ? "medical" : "secondary"}>
                              {c.farmacia.esInterna ? "Interna" : "Externa"}
                            </Badge>
                          </div>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {c.integrante ? c.integrante.nombre : "Titular"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {c.monto != null ? <Money amount={c.monto} /> : "—"}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {c.anuladaEn ? (
                          <Badge variant="error" title={c.anuladaMotivo ?? undefined}>
                            Anulada
                          </Badge>
                        ) : (
                          <Badge variant="success">Vigente</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {!c.anuladaEn && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setDelTarget(c);
                              setDelOpen(true);
                            }}
                            disabled={busy}
                          >
                            Anular
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={delOpen}
        onOpenChange={setDelOpen}
        title="Anular consumo de orden"
        description={
          delTarget ? (
            <span>
              Vas a anular el consumo #{delTarget.numeroOrdenEnMes} del{" "}
              {delTarget.consumidaEn.slice(0, 10)}. Quedará registrado el motivo
              para auditoría.
            </span>
          ) : undefined
        }
        confirmLabel="Anular"
        variant="error"
        requireReason
        reasonLabel="Motivo"
        reasonPlaceholder="Ej: orden cargada por error, devolución del afiliado, etc."
        loading={busy}
        onConfirm={onAnular}
      />
    </div>
  );
}

function KpiInline({
  label,
  value,
  muted,
  warning,
}: {
  label: string;
  value: string;
  muted?: boolean;
  warning?: boolean;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 text-center">
      <div className="text-xs text-neutral-500">{label}</div>
      <div
        className={`mt-1 text-3xl font-semibold tabular-nums ${
          warning ? "text-amber-700" : muted ? "text-neutral-400" : "text-neutral-900"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
