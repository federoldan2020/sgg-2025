"use client";

import * as React from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/ui-kit/Money";
import {
  historialCobertura,
  obligacionesPendientes,
  type Cobertura,
  type ObligacionPendiente,
} from "@/servicios/suspensiones";

type Props = {
  afiliadoId: string;
};

/**
 * Tab "Cuotas" — muestra el resumen mensual (esperado vs cobrado) y la lista
 * de cuotas pendientes del afiliado. "Cuotas" en lugar de "Obligaciones" para
 * usar terminología natural en Argentina (decisión registrada en memoria).
 */
export function TabCuotas({ afiliadoId }: Props) {
  const [cobertura, setCobertura] = React.useState<Cobertura | null>(null);
  const [pendientes, setPendientes] = React.useState<ObligacionPendiente[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [cob, pend] = await Promise.all([
          historialCobertura(afiliadoId, 1).then((r) => r[0] ?? null),
          obligacionesPendientes(afiliadoId).catch(() => [] as ObligacionPendiente[]),
        ]);
        if (cancel) return;
        setCobertura(cob);
        setPendientes(pend);
      } catch (e) {
        if (!cancel) {
          setError(e instanceof Error ? e.message : "Error cargando cuotas");
        }
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [afiliadoId]);

  return (
    <div className="space-y-6">
      {/* Resumen del mes corriente */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Resumen del período</CardTitle>
            <CardDescription>
              {cobertura
                ? `Período ${cobertura.periodo} — esperado vs cobrado`
                : "Último período calculado"}
            </CardDescription>
          </div>
          <Link href={`/afiliados/${afiliadoId}/estado`}>
            <Button variant="outline" size="sm">
              Ver cobertura completa →
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-neutral-500">Cargando…</div>
          ) : error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          ) : !cobertura ? (
            <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center text-sm text-neutral-500">
              Sin cálculo de cobertura disponible.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-neutral-200">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-xs uppercase text-neutral-600">
                  <tr>
                    <th className="px-3 py-2 text-left">Concepto</th>
                    <th className="px-3 py-2 text-right">Esperado</th>
                    <th className="px-3 py-2 text-right">Cobrado</th>
                    <th className="px-3 py-2 text-right">Deuda</th>
                    <th className="px-3 py-2 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  <FilaConcepto
                    label="J17 — Cuota social"
                    esperado={cobertura.j17Esperado}
                    cobrado={cobertura.j17Cobrado}
                    cubierto={cobertura.j17Cubierto}
                  />
                  <FilaConcepto
                    label="J22 — Coseguro"
                    esperado={cobertura.j22Esperado}
                    cobrado={cobertura.j22Cobrado}
                    cubierto={cobertura.j22Cubierto}
                  />
                  <FilaConcepto
                    label="J38 — Colaterales"
                    esperado={cobertura.j38Esperado}
                    cobrado={cobertura.j38Cobrado}
                    cubierto={cobertura.j38Cubierto}
                  />
                  {cobertura.k16Esperado > 0 && (
                    <FilaConcepto
                      label="K16 — Orden de crédito"
                      esperado={cobertura.k16Esperado}
                      cobrado={cobertura.k16Cobrado}
                      cubierto={cobertura.k16Esperado <= cobertura.k16Cobrado}
                    />
                  )}
                </tbody>
                <tfoot className="bg-neutral-50 text-sm font-semibold">
                  <tr>
                    <td className="px-3 py-2">Deuda total</td>
                    <td colSpan={2}></td>
                    <td className="px-3 py-2 text-right">
                      <Money amount={Number(cobertura.deudaTotal) || 0} />
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cuotas pendientes */}
      <Card>
        <CardHeader>
          <CardTitle>Cuotas pendientes</CardTitle>
          <CardDescription>
            {pendientes.length} cuota{pendientes.length === 1 ? "" : "s"} sin
            cancelar (incluye obligaciones y cuotas de órdenes).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-neutral-500">Cargando…</div>
          ) : pendientes.length === 0 ? (
            <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center text-sm text-neutral-500">
              Sin cuotas pendientes.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-neutral-200">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-xs uppercase text-neutral-600">
                  <tr>
                    <th className="px-3 py-2 text-left">Padrón</th>
                    <th className="px-3 py-2 text-left">Concepto</th>
                    <th className="px-3 py-2 text-left">Período</th>
                    <th className="px-3 py-2 text-right">Monto</th>
                    <th className="px-3 py-2 text-right">Saldo</th>
                    <th className="px-3 py-2 text-center">Tipo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {pendientes.map((o) => (
                    <tr key={o.id} className="hover:bg-neutral-50">
                      <td className="px-3 py-2 text-neutral-600">
                        {o.padronLabel}
                      </td>
                      <td className="px-3 py-2 font-medium">{o.concepto}</td>
                      <td className="px-3 py-2 tabular-nums">{o.periodo}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        <Money amount={o.monto} />
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">
                        <Money amount={o.saldo} />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Badge variant="secondary">{o.tipo}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function FilaConcepto({
  label,
  esperado,
  cobrado,
  cubierto,
}: {
  label: string;
  esperado: number;
  cobrado: number;
  cubierto?: boolean;
}) {
  const deuda = Math.max(0, esperado - cobrado);
  const noAplica = esperado === 0;
  return (
    <tr className="hover:bg-neutral-50">
      <td className="px-3 py-2 font-medium">{label}</td>
      <td className="px-3 py-2 text-right tabular-nums">
        <Money amount={esperado} />
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        <Money amount={cobrado} />
      </td>
      <td className="px-3 py-2 text-right tabular-nums font-medium text-neutral-900">
        {deuda > 0 ? <Money amount={deuda} /> : "—"}
      </td>
      <td className="px-3 py-2 text-center">
        {noAplica ? (
          <Badge variant="secondary">No aplica</Badge>
        ) : cubierto ? (
          <Badge variant="success">Cubierto</Badge>
        ) : (
          <Badge variant="warning">Con deuda</Badge>
        )}
      </td>
    </tr>
  );
}
