"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CreditCard, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { mon, fmtFecha } from "@/utiles/formatos";
import { getErrorMessage } from "@/servicios/api";
import { getCupoAfiliado, type CupoAfiliado } from "@/servicios/cupo";

export function CupoPanel({ afiliadoId }: { afiliadoId: string | number }) {
  const [data, setData] = useState<CupoAfiliado | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await getCupoAfiliado(afiliadoId);
      setData(r);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [afiliadoId]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <Skeleton className="h-6 w-32" />
        <div className="mt-3 space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        <AlertCircle className="size-4 shrink-0" />
        <div>{error}</div>
      </div>
    );
  }

  if (!data) return null;

  const pct = Math.round(data.porcentajeUsado);
  const tone =
    pct >= 90
      ? "bg-rose-500"
      : pct >= 70
        ? "bg-amber-500"
        : "bg-emerald-500";

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-xl bg-medical-50 text-medical-600 ring-1 ring-medical-100">
            <CreditCard className="size-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-neutral-900">
              Cupo de crédito
            </div>
            <div className="text-xs text-neutral-500">
              {data.cantidadOrdenesAbiertas} órdenes abiertas
            </div>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => void load()}>
          <RefreshCw className="size-4" />
        </Button>
      </header>

      {/* Totales */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl bg-neutral-50 p-3">
          <div className="text-xs uppercase tracking-wider text-neutral-500">
            Total asignado
          </div>
          <div className="mt-1 text-lg font-semibold text-neutral-900 tabular-nums">
            {mon(data.cupoTotal)}
          </div>
        </div>
        <div className="rounded-xl bg-amber-50 p-3">
          <div className="text-xs uppercase tracking-wider text-amber-700">
            Usado
          </div>
          <div className="mt-1 text-lg font-semibold text-amber-800 tabular-nums">
            {mon(data.cupoUsado)}
          </div>
        </div>
        <div className="rounded-xl bg-emerald-50 p-3">
          <div className="text-xs uppercase tracking-wider text-emerald-700">
            Disponible
          </div>
          <div className="mt-1 text-lg font-semibold text-emerald-800 tabular-nums">
            {mon(data.cupoDisponible)}
          </div>
        </div>
      </div>

      {/* Barra de progreso */}
      {data.cupoTotal > 0 ? (
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs text-neutral-500">
            <span>Uso del cupo</span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-neutral-200">
            <div
              className={`h-full transition-all ${tone}`}
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-neutral-300 p-3 text-center text-xs text-neutral-500">
          Sin cupo asignado a los padrones activos. Cargá el cupo desde la ficha
          del padrón.
        </div>
      )}

      {/* Órdenes abiertas */}
      {data.detalleOrdenes.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Órdenes vigentes
          </div>
          <div className="max-h-56 overflow-auto rounded-xl border border-neutral-200">
            <table className="w-full text-xs">
              <thead className="bg-neutral-50 text-neutral-600">
                <tr>
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Fecha</th>
                  <th className="px-3 py-2 text-left">Comercio</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-right">Saldo</th>
                  <th className="px-3 py-2 text-right">Ctas pend.</th>
                </tr>
              </thead>
              <tbody>
                {data.detalleOrdenes.map((o) => (
                  <tr key={o.ordenId} className="border-t">
                    <td className="px-3 py-1 font-mono">{o.ordenId}</td>
                    <td className="px-3 py-1">{fmtFecha(o.fechaAlta)}</td>
                    <td className="px-3 py-1">
                      {o.comercioRazonSocial ?? "—"}
                    </td>
                    <td className="px-3 py-1 text-right tabular-nums">
                      {mon(o.importeTotal)}
                    </td>
                    <td className="px-3 py-1 text-right tabular-nums">
                      {mon(o.saldoTotal)}
                    </td>
                    <td className="px-3 py-1 text-right tabular-nums">
                      {o.cuotasPendientes}/{o.cantidadCuotas ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
