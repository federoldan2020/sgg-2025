"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * Vista de órdenes de farmacia del afiliado titular.
 *
 * Estado actual: PLACEHOLDER — el backend (`OrdenFarmaciaConsumo`,
 * `ReglaCoberturaCoseguro`, `Farmacia`) está modelado pero no expone
 * endpoints. Cuando se publiquen los endpoints, completar:
 *
 *   GET  /coseguro/afiliados/:id/ordenes?periodo=YYYYMM     → consumos del mes
 *   GET  /coseguro/afiliados/:id/ordenes/cupo               → cupo + saldo
 *   POST /coseguro/afiliados/:id/ordenes/:consumoId/anular  → anular
 */
export function TabOrdenesFarmacia() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Órdenes de farmacia
            <Badge variant="warning">Próximamente</Badge>
          </CardTitle>
          <CardDescription>
            Visualización del cupo mensual y consumos del titular y su grupo
            familiar en farmacias internas y externas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-8 text-sm text-neutral-600">
            <p className="font-medium text-neutral-800">
              En cuanto se publiquen los endpoints, en esta pestaña vas a ver:
            </p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-neutral-600">
              <li>
                <b>Cupo del mes corriente</b> y saldo restante (por ejemplo
                3/4 disponibles). El cupo se renueva el día 1 sin acción
                manual.
              </li>
              <li>
                <b>Consumos del mes</b>: fecha, integrante del grupo que
                consumió, farmacia (interna del gremio o externa), monto si
                aplica.
              </li>
              <li>
                <b>Histórico por período</b> con selector de mes.
              </li>
              <li>
                <b>Anulación</b> de consumos con motivo (audit).
              </li>
              <li>
                Acceso rápido a farmacias externas adheridas.
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
