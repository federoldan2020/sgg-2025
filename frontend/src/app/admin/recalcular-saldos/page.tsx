"use client";

import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FlaskConical,
  Info,
  Loader2,
  Play,
  Scale,
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
  type RecalcAfiliadoResp,
  type RecalcOrgResp,
} from "@/servicios/movimientosAdmin";

const money = (n: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(n);

type ModoAlcance = "afiliado" | "organizacion";

function isOrgResp(
  r: RecalcAfiliadoResp | RecalcOrgResp,
): r is RecalcOrgResp {
  return (r as RecalcOrgResp).afiliadosProcesados !== undefined;
}

export default function RecalcularSaldosPage() {
  const [modo, setModo] = useState<ModoAlcance>("afiliado");
  const [afiliadoId, setAfiliadoId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<
    RecalcAfiliadoResp | RecalcOrgResp | null
  >(null);
  const [aplicado, setAplicado] = useState(false);

  const ejecutar = async (dryRun: boolean) => {
    if (modo === "afiliado" && !afiliadoId.trim()) {
      alert("Ingresá el ID del afiliado.");
      return;
    }
    if (modo === "organizacion" && !dryRun) {
      if (
        !confirm(
          "Vas a recalcular saldos de TODA la organización y persistir los cambios. Esto puede tardar varios minutos. ¿Continuar?",
        )
      )
        return;
    } else if (modo === "afiliado" && !dryRun) {
      if (!confirm(`Vas a sobrescribir los saldos del afiliado ${afiliadoId.trim()}. ¿Continuar?`)) return;
    }

    setLoading(true);
    setError(null);
    try {
      const r = await movimientosAdmin.recalcular({
        afiliadoId: modo === "afiliado" ? afiliadoId.trim() : undefined,
        dryRun,
      });
      setResultado(r);
      setAplicado(!dryRun);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-medical-50 text-medical-600 ring-1 ring-medical-100">
          <Scale className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            Recalcular saldos
          </h1>
          <p className="text-sm text-neutral-500">
            Reconstruye <code className="font-mono">Padron.saldo</code> y los{" "}
            <code className="font-mono">saldoPosterior</code> de cada movimiento
            a partir del ledger. Útil para verificar o reparar después de
            incidentes.
          </p>
        </div>
      </header>

      <div className="flex items-start gap-2 rounded-xl border border-medical-200 bg-medical-50/60 p-4 text-sm text-medical-900">
        <Info className="mt-0.5 size-5 shrink-0" />
        <div>
          <strong>Cómo se usa:</strong> elegí alcance (un afiliado o toda la
          organización), corré primero en <strong>dry-run</strong> para ver qué
          divergencias hay sin tocar la base. Si el resultado es esperable,
          ejecutá <strong>aplicar</strong>: actualiza los saldos. La operación
          es transaccional por afiliado e idempotente: correrla dos veces no
          cambia nada si ya está sincronizado.
        </div>
      </div>

      <Card className="p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium">Alcance:</span>
          <Button
            variant={modo === "afiliado" ? "default" : "outline"}
            size="sm"
            onClick={() => setModo("afiliado")}
          >
            Un afiliado
          </Button>
          <Button
            variant={modo === "organizacion" ? "default" : "outline"}
            size="sm"
            onClick={() => setModo("organizacion")}
          >
            Toda la organización
          </Button>
        </div>

        {modo === "afiliado" && (
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs font-medium text-muted-foreground">
                ID de afiliado
              </label>
              <Input
                value={afiliadoId}
                onChange={(e) => setAfiliadoId(e.target.value)}
                placeholder="ej. 6928"
                className="mt-1"
              />
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => ejecutar(true)}
            disabled={loading}
            variant="outline"
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FlaskConical className="mr-2 h-4 w-4" />
            )}
            Dry-run
          </Button>
          <Button onClick={() => ejecutar(false)} disabled={loading}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            Aplicar cambios
          </Button>
        </div>
      </Card>

      {error && (
        <Card className="border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mr-1 inline h-4 w-4" />
          {error}
        </Card>
      )}

      {resultado && (
        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            {aplicado ? (
              <Badge className="bg-emerald-100 text-emerald-800">
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                Aplicado
              </Badge>
            ) : (
              <Badge variant="outline" className="border-blue-300 bg-blue-50 text-blue-800">
                <FlaskConical className="mr-1 h-3.5 w-3.5" />
                Dry-run
              </Badge>
            )}
          </div>

          {isOrgResp(resultado) ? (
            <ResumenOrg r={resultado} />
          ) : (
            <ResumenAfiliado r={resultado} />
          )}
        </Card>
      )}
    </div>
  );
}

function ResumenAfiliado({ r }: { r: RecalcAfiliadoResp }) {
  return (
    <div className="space-y-3">
      <div className="text-sm">
        Afiliado <strong>{r.afiliadoId}</strong> · {r.padrones.length} padrón(es)
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Padrón</TableHead>
            <TableHead className="text-right">Saldo actual</TableHead>
            <TableHead className="text-right">Saldo calculado</TableHead>
            <TableHead className="text-right">Diferencia</TableHead>
            <TableHead className="text-right">Movs</TableHead>
            <TableHead className="text-right">Corregidos</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {r.padrones.map((p, i) => {
            const ok = Math.abs(p.diferencia) <= 0.009;
            return (
              <TableRow
                key={`${p.padronId ?? "huerf"}-${i}`}
                className={ok ? "" : "bg-amber-50/50"}
              >
                <TableCell className="font-mono">
                  {p.padronLabel ?? "(sin padrón)"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {money(p.saldoActual)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {money(p.saldoCalculado)}
                </TableCell>
                <TableCell
                  className={`text-right tabular-nums font-semibold ${
                    ok ? "text-muted-foreground" : "text-amber-700"
                  }`}
                >
                  {money(p.diferencia)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{p.movimientos}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {p.movimientosActualizados}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function ResumenOrg({ r }: { r: RecalcOrgResp }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
        <Stat label="Afiliados procesados" value={r.afiliadosProcesados} />
        <Stat label="Padrones con diferencia" value={r.padronesConDiferencia} />
        <Stat label="Movimientos corregidos" value={r.movimientosActualizados} />
      </div>

      {r.divergencias.length === 0 ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 className="mr-1 inline h-4 w-4" />
          Todo cuadra. No hay divergencias.
        </div>
      ) : (
        <>
          <div className="text-sm font-medium">
            Divergencias detectadas ({r.divergencias.length})
          </div>
          <div className="max-h-[400px] overflow-y-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Afiliado</TableHead>
                  <TableHead>Padrón</TableHead>
                  <TableHead className="text-right">Actual</TableHead>
                  <TableHead className="text-right">Calculado</TableHead>
                  <TableHead className="text-right">Diferencia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.divergencias.map((d, i) => (
                  <TableRow key={`${d.afiliadoId}-${d.padronId ?? "n"}-${i}`}>
                    <TableCell>{d.afiliadoId}</TableCell>
                    <TableCell className="font-mono">
                      {d.padronId ?? "(sin padrón)"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money(d.saldoActual)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money(d.saldoCalculado)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold text-amber-700">
                      {money(d.diferencia)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}
