"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { ConfirmDialog } from "@/components/ui-kit/ConfirmDialog";
import {
  listarReglasCobertura,
  crearReglaCobertura,
  actualizarReglaCobertura,
  eliminarReglaCobertura,
  type ReglaCobertura,
} from "@/servicios/coseguroAdmin";
import { getErrorMessage } from "@/servicios/api";

function fmtDate(d: string | null) {
  if (!d) return "—";
  return d.slice(0, 10);
}

export default function ReglasCoberturaPage() {
  const [items, setItems] = useState<ReglaCobertura[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ kind: "success" | "error"; msg: string } | null>(null);

  // Form de alta
  const [showForm, setShowForm] = useState(false);
  const [ordenesPorMes, setOrdenesPorMes] = useState("4");
  const [vigenteDesde, setVigenteDesde] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [vigenteHasta, setVigenteHasta] = useState("");

  // Eliminar
  const [delOpen, setDelOpen] = useState(false);
  const [delTarget, setDelTarget] = useState<ReglaCobertura | null>(null);

  const notify = (kind: "success" | "error", msg: string) => {
    setToast({ kind, msg });
    window.setTimeout(() => setToast(null), 4000);
  };

  const refresh = async () => {
    try {
      setLoading(true);
      setItems(await listarReglasCobertura());
    } catch (e) {
      notify("error", getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const onCrear = async () => {
    const n = Number(ordenesPorMes);
    if (!Number.isInteger(n) || n <= 0) {
      notify("error", "ordenesPorMes debe ser entero positivo");
      return;
    }
    if (!vigenteDesde) {
      notify("error", "vigenteDesde requerido");
      return;
    }
    try {
      setBusy(true);
      await crearReglaCobertura({
        ordenesPorMes: n,
        vigenteDesde,
        vigenteHasta: vigenteHasta || null,
        activo: true,
      });
      notify("success", "Regla creada");
      setShowForm(false);
      setOrdenesPorMes("4");
      setVigenteHasta("");
      await refresh();
    } catch (e) {
      notify("error", getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const onToggle = async (r: ReglaCobertura) => {
    try {
      setBusy(true);
      await actualizarReglaCobertura(r.id, { activo: !r.activo });
      notify("success", `Regla ${r.activo ? "desactivada" : "activada"}`);
      await refresh();
    } catch (e) {
      notify("error", getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    if (!delTarget) return;
    try {
      setBusy(true);
      await eliminarReglaCobertura(delTarget.id);
      notify("success", "Regla eliminada");
      setDelOpen(false);
      setDelTarget(null);
      await refresh();
    } catch (e) {
      notify("error", getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const vigente = items.find(
    (r) =>
      r.activo &&
      new Date(r.vigenteDesde) <= new Date() &&
      (!r.vigenteHasta || new Date(r.vigenteHasta) >= new Date()),
  );

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Cupo de órdenes de farmacia"
        subtitle="Cantidad de órdenes mensuales por afiliado titular. El reset el día 1 es implícito."
      >
        {!showForm && (
          <Button onClick={() => setShowForm(true)}>+ Nueva regla</Button>
        )}
      </PageHeader>

      {toast && (
        <div
          className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
            toast.kind === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* KPI: regla vigente */}
      <Card className="mb-6 py-4">
        <CardContent>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs text-neutral-500">Vigente hoy</div>
              {loading ? (
                <Skeleton className="mt-1 h-8 w-32" />
              ) : vigente ? (
                <div className="mt-1 text-3xl font-semibold tabular-nums text-neutral-900">
                  {vigente.ordenesPorMes}
                  <span className="ml-1 text-base font-normal text-neutral-500">
                    órdenes / mes
                  </span>
                </div>
              ) : (
                <div className="mt-1 text-base text-neutral-500">
                  Sin regla vigente — las farmacias no podrán consumir.
                </div>
              )}
            </div>
            {vigente && (
              <div className="text-right text-xs text-neutral-500">
                Desde {fmtDate(vigente.vigenteDesde)}
                {vigente.vigenteHasta && (
                  <>
                    <br />
                    Hasta {fmtDate(vigente.vigenteHasta)}
                  </>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {showForm && (
        <Card className="mb-6">
          <CardContent>
            <h3 className="mb-4 text-sm font-semibold text-neutral-900">
              Nueva regla
            </h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-600">
                  Órdenes por mes
                </label>
                <Input
                  type="number"
                  min={1}
                  value={ordenesPorMes}
                  onChange={(e) => setOrdenesPorMes(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-600">
                  Vigente desde
                </label>
                <Input
                  type="date"
                  value={vigenteDesde}
                  onChange={(e) => setVigenteDesde(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-600">
                  Vigente hasta (opcional)
                </label>
                <Input
                  type="date"
                  value={vigenteHasta}
                  onChange={(e) => setVigenteHasta(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowForm(false)}
                disabled={busy}
              >
                Cancelar
              </Button>
              <Button onClick={() => void onCrear()} disabled={busy}>
                {busy ? "Guardando…" : "Crear"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="py-0">
        <CardContent className="px-0 py-0">
          {loading ? (
            <div className="space-y-3 p-6">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center text-sm text-neutral-500">
              No hay reglas de cobertura. Creá una para habilitar el cupo de
              órdenes de farmacia.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase text-neutral-600">
                  <tr>
                    <th className="px-4 py-3 text-right">Órdenes/mes</th>
                    <th className="px-4 py-3 text-left">Vigente desde</th>
                    <th className="px-4 py-3 text-left">Vigente hasta</th>
                    <th className="px-4 py-3 text-center">Estado</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {items.map((r) => (
                    <tr key={r.id} className="hover:bg-neutral-50">
                      <td className="px-4 py-3 text-right text-lg font-semibold tabular-nums">
                        {r.ordenesPorMes}
                      </td>
                      <td className="px-4 py-3 tabular-nums">{fmtDate(r.vigenteDesde)}</td>
                      <td className="px-4 py-3 tabular-nums">{fmtDate(r.vigenteHasta)}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={r.activo ? "success" : "secondary"}>
                          {r.activo ? "Activa" : "Inactiva"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void onToggle(r)}
                            disabled={busy}
                          >
                            {r.activo ? "Desactivar" : "Activar"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setDelTarget(r);
                              setDelOpen(true);
                            }}
                            disabled={busy}
                          >
                            Eliminar
                          </Button>
                        </div>
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
        title="Eliminar regla de cobertura"
        description={
          delTarget ? (
            <span>
              Vas a eliminar la regla de <b>{delTarget.ordenesPorMes}</b>{" "}
              órdenes/mes vigente desde {fmtDate(delTarget.vigenteDesde)}. Esta
              acción no se puede deshacer.
            </span>
          ) : undefined
        }
        confirmLabel="Eliminar"
        variant="error"
        loading={busy}
        onConfirm={onDelete}
      />
    </div>
  );
}
