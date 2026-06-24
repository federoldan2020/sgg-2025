'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, getErrorMessage } from '@/servicios/api';
import type { OrdenCredito, OrdenCreditoCuota } from '@/tipos/modelos';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState, Money, PageContainer, PageHeader } from '@/components/ui-kit';
import { AlertCircle, CreditCard, FileText, Hash, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

function EstadoBadge({ estado }: { estado?: string | null }) {
  const value = estado ?? '—';
  const style =
    value === 'OK'
      ? { dot: 'bg-emerald-500', cls: 'border-emerald-200 bg-emerald-50 text-emerald-700' }
      : value === 'ANULADA'
        ? { dot: 'bg-rose-500', cls: 'border-rose-200 bg-rose-50 text-rose-700' }
        : { dot: 'bg-amber-500', cls: 'border-amber-200 bg-amber-50 text-amber-700' };

  return (
    <Badge variant="outline" className={cn('gap-1.5 px-2 py-0 text-[11px]', style.cls)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', style.dot)} />
      {value}
    </Badge>
  );
}

function CronogramaTable({ cuotas }: { cuotas: OrdenCreditoCuota[] }) {
  if (cuotas.length === 0) {
    return (
      <EmptyState
        className="py-6"
        title="Sin cronograma"
        description="Esta orden no tiene cuotas cargadas todavía."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border/60">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[70px]">#</TableHead>
            <TableHead className="w-[110px]">Período</TableHead>
            <TableHead className="text-right">Importe</TableHead>
            <TableHead className="text-right">Cancelado</TableHead>
            <TableHead className="text-right">Saldo</TableHead>
            <TableHead className="w-[110px]">Estado</TableHead>
            <TableHead className="w-[120px]">Obligación</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cuotas.map((c) => (
            <TableRow key={String(c.id)}>
              <TableCell className="font-medium">{c.numero}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{c.periodoVenc}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">
                <Money amount={Number(c.importe)} />
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                <Money amount={Number(c.cancelado)} />
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums">
                <Money amount={Number(c.saldo)} />
              </TableCell>
              <TableCell>
                <EstadoBadge estado={c.estado} />
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {c.obligacionId ?? '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function OrdenCard({ orden }: { orden: OrdenCredito }) {
  const cuotas = orden.cuotas ?? [];
  const cantidadCuotas = (orden.cantidadCuotas ?? cuotas.length) || 1;

  return (
    <Card className="rounded-2xl border-border/60 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4" />
              Orden #{String(orden.id)}
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {orden.descripcion || 'Sin descripción'}
            </p>
          </div>
          <EstadoBadge estado={String(orden.estado ?? 'PEND')} />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
            <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              <FileText className="h-3.5 w-3.5" />
              Tipo
            </div>
            <div className="mt-1 text-sm font-semibold text-neutral-900">
              {orden.enCuotas ? 'En cuotas' : 'Pago único'}
            </div>
          </div>
          <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
            <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              <Hash className="h-3.5 w-3.5" />
              Cuotas
            </div>
            <div className="mt-1 text-sm font-semibold text-neutral-900">
              {cantidadCuotas}
            </div>
          </div>
          <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
            <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Total
            </div>
            <div className="mt-1 text-sm font-semibold tabular-nums text-neutral-900">
              <Money amount={Number(orden.importeTotal)} />
            </div>
          </div>
          <div className="rounded-xl border border-medical-200 bg-medical-50/60 p-3">
            <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-medical-700">
              <Layers className="h-3.5 w-3.5" />
              Saldo total
            </div>
            <div className="mt-1 text-sm font-semibold tabular-nums text-medical-800">
              <Money amount={Number(orden.saldoTotal)} />
            </div>
          </div>
        </div>

        {orden.enCuotas && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
              <Layers className="h-4 w-4" />
              Cronograma
            </div>
            <CronogramaTable cuotas={cuotas} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function OrdenesAfiliadoClient({ afiliadoId }: { afiliadoId: string }) {
  const [lista, setLista] = useState<OrdenCredito[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const r = await api<OrdenCredito[]>(`/ordenes/${afiliadoId}`);
      setLista(r);
      setMsg(null);
    } catch (e) {
      setMsg(getErrorMessage(e));
    }
  }, [afiliadoId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const resumen = useMemo(() => {
    return lista.reduce(
      (acc, orden) => {
        acc.total += Number(orden.importeTotal ?? 0);
        acc.saldo += Number(orden.saldoTotal ?? 0);
        return acc;
      },
      { total: 0, saldo: 0 }
    );
  }, [lista]);

  return (
    <PageContainer>
      <PageHeader
        title={`Órdenes del afiliado #${afiliadoId}`}
        subtitle="Detalle de órdenes emitidas y cronograma de cuotas"
        className="mb-6 pb-3"
      />

      {msg && (
        <Card className="rounded-2xl border border-rose-300 bg-rose-50 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-start gap-3 text-sm text-rose-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              <p>{msg}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {lista.length === 0 ? (
        <Card className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <CardContent className="px-6 py-14">
            <EmptyState
              title="Sin órdenes registradas"
              description="Cuando este afiliado tenga órdenes emitidas, se mostrarán acá con su detalle y cronograma."
              icon={
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-medical-50 text-medical-600 shadow-sm">
                  <FileText className="h-7 w-7" />
                </div>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card className="rounded-2xl border-border/60 shadow-sm">
              <CardContent className="p-4">
                <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Órdenes
                </div>
                <div className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900">
                  {lista.length}
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border-border/60 shadow-sm">
              <CardContent className="p-4">
                <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Importe total
                </div>
                <div className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900">
                  <Money amount={resumen.total} />
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border-medical-200 bg-medical-50/60 shadow-sm">
              <CardContent className="p-4">
                <div className="text-[10px] font-medium uppercase tracking-wide text-medical-700">
                  Saldo pendiente
                </div>
                <div className="mt-1 text-2xl font-semibold tabular-nums text-medical-800">
                  <Money amount={resumen.saldo} />
                </div>
              </CardContent>
            </Card>
          </div>

          {lista.map((orden) => (
            <OrdenCard key={String(orden.id)} orden={orden} />
          ))}
        </div>
      )}
    </PageContainer>
  );
}
