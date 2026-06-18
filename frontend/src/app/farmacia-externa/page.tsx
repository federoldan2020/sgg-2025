"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui-kit/ConfirmDialog";
import {
  getFarmaciaSesion,
  clearFarmaciaSesion,
  getMe,
  buscarAfiliadoPorDni,
  consumirOrden,
  listarMisConsumos,
  anularConsumoPropio,
  type AfiliadoBuscado,
  type ConsumoPropio,
  type FarmaciaSesion,
} from "@/servicios/farmaciaExterna";

function fmtPeriodo(p: string) {
  if (!/^\d{6}$/.test(p)) return p;
  return `${p.slice(4, 6)}/${p.slice(0, 4)}`;
}
function periodoActual() {
  const d = new Date();
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default function FarmaciaExternaHome() {
  const router = useRouter();
  const [sesion, setSesion] = useState<FarmaciaSesion | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "success" | "error"; msg: string } | null>(null);

  // Búsqueda
  const [dni, setDni] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [encontrado, setEncontrado] = useState<AfiliadoBuscado | null>(null);
  const [busqError, setBusqError] = useState<string | null>(null);

  // Consumir
  const [integranteSel, setIntegranteSel] = useState<string>("");
  const [observacion, setObservacion] = useState("");
  const [monto, setMonto] = useState("");
  const [consumiendo, setConsumiendo] = useState(false);

  // Mis consumos
  const [periodo] = useState(periodoActual());
  const [consumos, setConsumos] = useState<ConsumoPropio[]>([]);
  const [cargandoConsumos, setCargandoConsumos] = useState(false);

  // Anulación
  const [anularOpen, setAnularOpen] = useState(false);
  const [anularTarget, setAnularTarget] = useState<ConsumoPropio | null>(null);
  const [anulando, setAnulando] = useState(false);

  const notify = (kind: "success" | "error", msg: string) => {
    setToast({ kind, msg });
    window.setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    const s = getFarmaciaSesion();
    if (!s) {
      router.replace("/farmacia-externa/login");
      return;
    }
    setSesion(s);
    void getMe()
      .catch(() => {
        clearFarmaciaSesion();
        router.replace("/farmacia-externa/login");
      })
      .then(async () => {
        // cargar mis consumos del mes
        try {
          setCargandoConsumos(true);
          setConsumos(await listarMisConsumos(periodo));
        } catch (e) {
          setBootError(e instanceof Error ? e.message : "Error cargando consumos");
        } finally {
          setCargandoConsumos(false);
        }
      });
  }, [router, periodo]);

  const logout = () => {
    clearFarmaciaSesion();
    router.replace("/farmacia-externa/login");
  };

  const buscar = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!/^\d{6,12}$/.test(dni.trim())) {
      setBusqError("DNI inválido");
      return;
    }
    try {
      setBuscando(true);
      setBusqError(null);
      setEncontrado(null);
      setIntegranteSel("");
      setObservacion("");
      setMonto("");
      const af = await buscarAfiliadoPorDni(dni);
      setEncontrado(af);
    } catch (e) {
      setBusqError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setBuscando(false);
    }
  };

  const consumir = async () => {
    if (!encontrado) return;
    try {
      setConsumiendo(true);
      const m = monto.trim() ? Number(monto) : null;
      if (m != null && Number.isNaN(m)) {
        notify("error", "Monto inválido");
        return;
      }
      await consumirOrden({
        dni: encontrado.titular.dni,
        integranteId: integranteSel || null,
        observacion: observacion.trim() || null,
        monto: m,
      });
      notify("success", "Orden consumida");
      // Refrescar afiliado y mis consumos
      const [af, cs] = await Promise.all([
        buscarAfiliadoPorDni(encontrado.titular.dni),
        listarMisConsumos(periodo),
      ]);
      setEncontrado(af);
      setConsumos(cs);
      setObservacion("");
      setMonto("");
    } catch (e) {
      notify("error", e instanceof Error ? e.message : "Error al consumir");
    } finally {
      setConsumiendo(false);
    }
  };

  const onAnular = async (motivo?: string) => {
    if (!anularTarget || !motivo) return;
    try {
      setAnulando(true);
      await anularConsumoPropio(anularTarget.id, motivo);
      notify("success", "Consumo anulado");
      setAnularOpen(false);
      setAnularTarget(null);
      setConsumos(await listarMisConsumos(periodo));
    } catch (e) {
      notify("error", e instanceof Error ? e.message : "Error al anular");
    } finally {
      setAnulando(false);
    }
  };

  if (!sesion) {
    return (
      <div className="py-12 text-center text-sm text-neutral-500">
        Redirigiendo…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Banner sesión */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-neutral-900">
            {sesion.nombre}
          </div>
          <div className="text-xs text-neutral-500">
            Código <span className="font-mono">{sesion.codigo}</span>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={logout}>
          Cerrar sesión
        </Button>
      </div>

      {toast && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            toast.kind === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {toast.msg}
        </div>
      )}

      {bootError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {bootError}
        </div>
      )}

      {/* Búsqueda */}
      <Card>
        <CardContent className="py-5">
          <h2 className="mb-4 text-sm font-semibold text-neutral-900">
            Buscar afiliado por DNI
          </h2>
          <form onSubmit={buscar} className="flex gap-2">
            <Input
              value={dni}
              onChange={(e) => setDni(e.target.value.replace(/\D/g, ""))}
              placeholder="Sin puntos"
              autoFocus
            />
            <Button type="submit" disabled={buscando}>
              {buscando ? "Buscando…" : "Buscar"}
            </Button>
          </form>
          {busqError && (
            <div className="mt-2 text-sm text-red-700">{busqError}</div>
          )}
        </CardContent>
      </Card>

      {/* Resultado de búsqueda */}
      {encontrado && (
        <Card>
          <CardContent className="space-y-5 py-5">
            <div>
              <div className="text-xs text-neutral-500">Titular</div>
              <div className="text-base font-semibold text-neutral-900">
                {encontrado.titular.apellido}, {encontrado.titular.nombre}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                <span>DNI {encontrado.titular.dni}</span>
                <Badge variant={encontrado.titular.coseguroActivo ? "success" : "error"}>
                  Coseguro {encontrado.titular.coseguroActivo ? "activo" : "baja"}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <KpiCell label="Cupo del mes" value={String(encontrado.saldoOrdenes.cupo)} />
              <KpiCell
                label="Consumidas"
                value={String(encontrado.saldoOrdenes.consumidas)}
              />
              <KpiCell
                label="Disponibles"
                value={String(encontrado.saldoOrdenes.disponibles)}
                warning={encontrado.saldoOrdenes.disponibles === 0}
              />
            </div>

            <div className="rounded-lg border border-neutral-200 p-3 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-neutral-600">
                Registrar consumo
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-600">
                  ¿Quién consumió?
                </label>
                <select
                  className="h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm"
                  value={integranteSel}
                  onChange={(e) => setIntegranteSel(e.target.value)}
                >
                  <option value="">Titular</option>
                  {encontrado.grupo.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nombre}
                      {g.parentesco ? ` · ${g.parentesco.descripcion}` : ""}
                      {g.dni ? ` · DNI ${g.dni}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-600">
                    Observación (opcional)
                  </label>
                  <Input
                    value={observacion}
                    onChange={(e) => setObservacion(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-600">
                    Monto (opcional)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                  />
                </div>
              </div>

              <Button
                onClick={() => void consumir()}
                disabled={
                  consumiendo ||
                  !encontrado.titular.coseguroActivo ||
                  encontrado.saldoOrdenes.disponibles === 0
                }
                className="w-full"
              >
                {consumiendo ? "Registrando…" : "Registrar orden"}
              </Button>

              {!encontrado.titular.coseguroActivo && (
                <div className="text-xs text-red-700">
                  El titular no tiene coseguro activo — no puede consumir órdenes.
                </div>
              )}
              {encontrado.saldoOrdenes.disponibles === 0 && (
                <div className="text-xs text-amber-700">
                  Cupo del mes agotado. El reset es el día 1 del mes próximo.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mis consumos */}
      <Card>
        <CardContent className="py-5">
          <h2 className="mb-4 text-sm font-semibold text-neutral-900">
            Mis consumos del período {fmtPeriodo(periodo)}
          </h2>
          {cargandoConsumos ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : consumos.length === 0 ? (
            <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center text-sm text-neutral-500">
              Aún no registraste consumos este mes.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-neutral-200">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-xs uppercase text-neutral-600">
                  <tr>
                    <th className="px-3 py-2 text-left">Fecha</th>
                    <th className="px-3 py-2 text-left">Afiliado</th>
                    <th className="px-3 py-2 text-left">Quién</th>
                    <th className="px-3 py-2 text-right">Monto</th>
                    <th className="px-3 py-2 text-center">Estado</th>
                    <th className="px-3 py-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {consumos.map((c) => (
                    <tr key={c.id} className="hover:bg-neutral-50">
                      <td className="px-3 py-2 tabular-nums">
                        {c.consumidaEn.slice(0, 16).replace("T", " ")}
                      </td>
                      <td className="px-3 py-2">
                        {c.afiliado.apellido}, {c.afiliado.nombre}
                        <div className="text-xs text-neutral-500 tabular-nums">
                          DNI {c.afiliado.dni}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {c.integrante ? c.integrante.nombre : "Titular"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {c.monto != null
                          ? c.monto.toLocaleString("es-AR", {
                              style: "currency",
                              currency: "ARS",
                            })
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {c.anuladaEn ? (
                          <Badge variant="error">Anulada</Badge>
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
                              setAnularTarget(c);
                              setAnularOpen(true);
                            }}
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
        open={anularOpen}
        onOpenChange={setAnularOpen}
        title="Anular consumo"
        description={
          anularTarget ? (
            <span>
              Vas a anular el consumo de{" "}
              <b>
                {anularTarget.afiliado.apellido}, {anularTarget.afiliado.nombre}
              </b>{" "}
              ({anularTarget.consumidaEn.slice(0, 10)}). Quedará registrado para
              auditoría.
            </span>
          ) : undefined
        }
        confirmLabel="Anular"
        variant="error"
        requireReason
        reasonPlaceholder="Ej: cargado por error, devolución del afiliado, etc."
        loading={anulando}
        onConfirm={onAnular}
      />
    </div>
  );
}

function KpiCell({
  label,
  value,
  warning,
}: {
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3 text-center">
      <div className="text-xs text-neutral-500">{label}</div>
      <div
        className={`mt-1 text-2xl font-semibold tabular-nums ${
          warning ? "text-amber-700" : "text-neutral-900"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
