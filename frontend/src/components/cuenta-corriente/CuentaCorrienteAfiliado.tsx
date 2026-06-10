"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { KpiCard } from "./KpiCard";
import { PeriodToolbar } from "./PeriodToolbar";
import { TablaMovimientos } from "./TablaMovimientos";
import { listarMovimientos, padronesActivos } from "./api";
import type { CtaCteResp, PadronLite } from "./types";

const money = (n: number | string) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(typeof n === "string" ? Number(n || 0) : n || 0);

function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const h = setTimeout(() => setV(value), ms);
    return () => clearTimeout(h);
  }, [value, ms]);
  return v;
}

/**
 * Cuenta corriente del afiliado. Acepta `afiliadoId` por prop. El header
 * con datos del afiliado (display, dni) es opcional: si no se pasa, sólo
 * se muestra el selector de padrón, KPIs y la tabla.
 *
 * Esta es la versión "embebible" del módulo Movimientos, pensada para usar
 * dentro de la ficha del afiliado.
 */
export function CuentaCorrienteAfiliado({
  afiliadoId,
  afiliadoDisplay,
  afiliadoDni,
  hideHeader,
}: {
  afiliadoId: string;
  afiliadoDisplay?: string | null;
  afiliadoDni?: string | null;
  /** Si true, no muestra la card de datos del afiliado (sólo padrón + período). */
  hideHeader?: boolean;
}) {
  const [padrones, setPadrones] = useState<PadronLite[]>([]);
  const [padronId, setPadronId] = useState<string>("");

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const dSelectedDate = useDebounced(selectedDate, 250);

  const [data, setData] = useState<CtaCteResp | null>(null);
  const [loading, setLoading] = useState(false);

  // Cargar padrones cuando cambia el afiliado.
  useEffect(() => {
    if (!afiliadoId) {
      setPadrones([]);
      setPadronId("");
      return;
    }
    padronesActivos(afiliadoId).then((res) => {
      setPadrones(res);
      setPadronId((prev) => prev || res?.[0]?.id || "");
    });
  }, [afiliadoId]);

  // Cargar movimientos.
  useEffect(() => {
    (async () => {
      if (!afiliadoId) {
        setData(null);
        return;
      }
      setLoading(true);
      try {
        const year = dSelectedDate.getFullYear();
        const month = dSelectedDate.getMonth();
        const periodoContable = `${year}-${String(month + 1).padStart(2, "0")}`;

        const resp = await listarMovimientos({
          afiliadoId,
          padronId: padronId || undefined,
          periodoContable,
          take: 500,
        });

        setData(resp);
      } finally {
        setLoading(false);
      }
    })();
  }, [afiliadoId, padronId, dSelectedDate]);

  const padronSel = useMemo(
    () => padrones.find((p) => p.id === padronId),
    [padrones, padronId],
  );

  const padronesMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of padrones) m.set(String(p.id), p.padron);
    return m;
  }, [padrones]);

  const saldoFinal = data?.saldoFinal ?? 0;

  const totalDebitos =
    data?.movimientos
      .filter((m) => m.naturaleza === "debito")
      .reduce((a, b) => a + Number(b.importe || 0), 0) ?? 0;

  const totalCreditos =
    data?.movimientos
      .filter((m) => m.naturaleza === "credito")
      .reduce((a, b) => a + Number(b.importe || 0), 0) ?? 0;

  return (
    <div className="space-y-6">
      <Card className="p-5">
        {!hideHeader && (
          <>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                {afiliadoDisplay && (
                  <h2 className="text-xl font-semibold truncate">
                    {afiliadoDisplay}
                  </h2>
                )}
                {afiliadoDni && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    DNI {afiliadoDni}
                  </div>
                )}

                {padronSel && (
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                    <Badge
                      variant="outline"
                      className={cn(
                        "rounded-full",
                        padronSel.activo
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-border bg-muted text-muted-foreground",
                      )}
                    >
                      {padronSel.activo ? "Activo" : "Inactivo"}
                    </Badge>

                    <span className="text-muted-foreground">
                      Saldo:{" "}
                      <span className="font-semibold text-foreground tabular-nums">
                        {money(padronSel.saldo)}
                      </span>
                    </span>

                    <span className="text-muted-foreground">
                      Cupo:{" "}
                      <span className="font-semibold text-foreground tabular-nums">
                        {money(padronSel.cupo)}
                      </span>
                    </span>

                    {padronSel.sistema && (
                      <span className="text-muted-foreground">
                        Sistema:{" "}
                        <span className="font-semibold text-foreground">
                          {padronSel.sistema}
                        </span>
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="text-xs font-medium text-muted-foreground">
                  Padrón
                </div>

                <Select value={padronId} onValueChange={setPadronId}>
                  <SelectTrigger className="h-10 w-[180px]">
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {padrones.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.padron} {!p.activo ? "(inactivo)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator className="my-4" />
          </>
        )}

        {hideHeader && (
          <div className="mb-4 flex items-center justify-end gap-3">
            <div className="text-xs font-medium text-muted-foreground">Padrón</div>
            <Select value={padronId} onValueChange={setPadronId}>
              <SelectTrigger className="h-10 w-[180px]">
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent>
                {padrones.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.padron} {!p.activo ? "(inactivo)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <PeriodToolbar
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          disabled={!afiliadoId}
        />
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Lo que nos debe"
          value={money(totalDebitos)}
          tone="debit"
        />
        <KpiCard
          label="Lo que nos paga"
          value={money(totalCreditos)}
          tone="credit"
        />
        <KpiCard
          label={
            saldoFinal < 0
              ? "Saldo final (a favor del afiliado)"
              : "Saldo final (deuda total acumulada)"
          }
          value={money(saldoFinal)}
          tone={saldoFinal < 0 ? "credit" : saldoFinal > 0 ? "debit" : "neutral"}
        />
      </div>

      <TablaMovimientos
        rows={data?.movimientos || []}
        loading={loading}
        padronesMap={padronesMap}
      />
    </div>
  );
}
