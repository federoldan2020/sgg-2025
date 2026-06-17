"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui-kit/ConfirmDialog";
import { Money } from "@/components/ui-kit/Money";
import { KpiGrid } from "@/components/ui-kit/KpiGrid";
import { api, getErrorMessage } from "@/servicios/api";
import type {
  CoseguroCfg,
  Colateral,
  Parentesco,
  PadronLite,
  PrecioResumen,
} from "./types";

type Props = {
  afiliadoId: string;
  padrones: PadronLite[];
  cfg: CoseguroCfg;
  setCfg: React.Dispatch<React.SetStateAction<CoseguroCfg>>;
  colaterales: Colateral[];
  parentescos: Parentesco[];
  precio: PrecioResumen | null;
  busy: boolean;
  setBusy: (b: boolean) => void;
  notify: (kind: "success" | "error", msg: string) => void;
  refresh: () => Promise<void>;
};

function edadDesde(fechaNac?: string | null): number | null {
  if (!fechaNac) return null;
  const d = new Date(fechaNac);
  if (Number.isNaN(d.getTime())) return null;
  const hoy = new Date();
  let edad = hoy.getFullYear() - d.getFullYear();
  const m = hoy.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < d.getDate())) edad--;
  return edad;
}

function toISODate(d?: string | null) {
  if (!d) return "";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toISOString().slice(0, 10);
}

type ColateralForm = {
  id?: string | number;
  parentescoId: string | number;
  nombre: string;
  dni: string;
  fechaNacimiento: string;
  esColateral: boolean;
  esEstudiante: boolean;
  esDiscapacitado: boolean;
  tieneAportes: boolean;
  activo: boolean;
};

function formVacio(parentescoDefault: string | number): ColateralForm {
  return {
    parentescoId: parentescoDefault,
    nombre: "",
    dni: "",
    fechaNacimiento: "",
    esColateral: true,
    esEstudiante: false,
    esDiscapacitado: false,
    tieneAportes: false,
    activo: true,
  };
}

function formDe(c: Colateral): ColateralForm {
  return {
    id: c.id,
    parentescoId: c.parentescoId,
    nombre: c.nombre ?? "",
    dni: c.dni ?? "",
    fechaNacimiento: toISODate(c.fechaNacimiento),
    esColateral: c.esColateral ?? true,
    esEstudiante: !!c.esEstudiante,
    esDiscapacitado: !!c.esDiscapacitado,
    tieneAportes: !!c.tieneAportes,
    activo: c.activo,
  };
}

export function TabCobertura({
  afiliadoId,
  padrones,
  cfg,
  setCfg,
  colaterales,
  parentescos,
  precio,
  busy,
  setBusy,
  notify,
  refresh,
}: Props) {
  // Modal alta/edición
  const [modalOpen, setModalOpen] = React.useState(false);
  const [isNew, setIsNew] = React.useState(true);
  const [form, setForm] = React.useState<ColateralForm>(
    formVacio(parentescos[0]?.id ?? ""),
  );

  // Confirmación de eliminación
  const [delOpen, setDelOpen] = React.useState(false);
  const [delTarget, setDelTarget] = React.useState<Colateral | null>(null);

  const padronesActivos = React.useMemo(
    () => padrones.filter((p) => p.activo !== false),
    [padrones],
  );

  const abrirNuevo = () => {
    setIsNew(true);
    setForm(formVacio(parentescos[0]?.id ?? ""));
    setModalOpen(true);
  };

  const abrirEditar = (c: Colateral) => {
    setIsNew(false);
    setForm(formDe(c));
    setModalOpen(true);
  };

  const guardarCfg = async () => {
    setBusy(true);
    try {
      if (cfg.estado === "activo") {
        if (!cfg.padronCoseguroId) {
          throw new Error("Seleccioná padrón de imputación para J22.");
        }
        if (!cfg.padronColatId) {
          throw new Error("Seleccioná padrón de imputación para J38.");
        }
        await api(`/coseguro/afiliados/${afiliadoId}/alta`, {
          method: "POST",
          body: JSON.stringify({ padronId: Number(cfg.padronCoseguroId) }),
        });
        await api(`/colaterales/afiliados/${afiliadoId}/imputacion`, {
          method: "POST",
          body: JSON.stringify({ padronId: Number(cfg.padronColatId) }),
        });
      } else {
        await api(`/coseguro/afiliados/${afiliadoId}/baja`, { method: "POST" });
      }
      await refresh();
      notify("success", "Configuración guardada");
    } catch (e) {
      notify("error", getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const guardarColat = async () => {
    setBusy(true);
    try {
      const body = {
        parentescoId: form.parentescoId ? Number(form.parentescoId) : undefined,
        nombre: form.nombre.trim(),
        dni: form.dni.trim() || undefined,
        fechaNacimiento: form.fechaNacimiento || undefined,
        activo: form.activo,
        esColateral: form.esColateral,
        esEstudiante: form.esEstudiante,
        esDiscapacitado: form.esDiscapacitado,
        tieneAportes: form.tieneAportes,
      };
      if (isNew) {
        await api(`/colaterales/afiliados/${afiliadoId}/colaterales`, {
          method: "POST",
          body: JSON.stringify(body),
        });
        notify("success", "Integrante agregado");
      } else {
        await api(
          `/colaterales/afiliados/${afiliadoId}/colaterales/${form.id}`,
          { method: "PATCH", body: JSON.stringify(body) },
        );
        notify("success", "Integrante actualizado");
      }
      setModalOpen(false);
      await refresh();
    } catch (e) {
      notify("error", getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const confirmarEliminar = (c: Colateral) => {
    setDelTarget(c);
    setDelOpen(true);
  };

  const ejecutarEliminar = async () => {
    if (!delTarget) return;
    setBusy(true);
    try {
      await api(
        `/colaterales/afiliados/${afiliadoId}/colaterales/${delTarget.id}`,
        { method: "DELETE" },
      );
      notify("success", "Integrante eliminado");
      setDelOpen(false);
      setDelTarget(null);
      await refresh();
    } catch (e) {
      notify("error", getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const kpis = [
    {
      label: "Coseguro (J22)",
      value: Number(precio?.coseguro ?? 0),
      isMoney: true,
    },
    {
      label: "Colaterales (J38)",
      value: Number(precio?.colaterales ?? 0),
      isMoney: true,
    },
    {
      label: "Total mensual",
      value: Number(precio?.total ?? 0),
      isMoney: true,
    },
  ];

  return (
    <div className="space-y-6">
      {/* ===== Configuración ===== */}
      <Card>
        <CardHeader>
          <CardTitle>Configuración del coseguro</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-neutral-600">
                Estado
              </span>
              <Badge
                variant={
                  cfg.estado === "activo"
                    ? "success"
                    : cfg.estado === "baja"
                      ? "error"
                      : "secondary"
                }
              >
                {cfg.estado.toUpperCase()}
              </Badge>
            </div>
            <label className="inline-flex items-center gap-2 text-sm">
              <Checkbox
                checked={cfg.estado === "activo"}
                onCheckedChange={(v) =>
                  setCfg((c) => ({ ...c, estado: v ? "activo" : "baja" }))
                }
              />
              <span>Activar coseguro</span>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-600">
                Imputación J22 (coseguro)
              </label>
              <select
                className="h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-900 hover:border-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-medical-500 disabled:cursor-not-allowed disabled:opacity-50"
                value={String(cfg.padronCoseguroId ?? "")}
                onChange={(e) =>
                  setCfg((c) => ({
                    ...c,
                    padronCoseguroId: e.target.value
                      ? Number(e.target.value)
                      : null,
                  }))
                }
                disabled={cfg.estado !== "activo" || busy}
              >
                <option value="">— Seleccionar padrón —</option>
                {padronesActivos.map((p) => (
                  <option key={String(p.id)} value={String(p.id)}>
                    {p.padron}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-600">
                Imputación J38 (colaterales)
              </label>
              <select
                className="h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-900 hover:border-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-medical-500 disabled:cursor-not-allowed disabled:opacity-50"
                value={String(cfg.padronColatId ?? "")}
                onChange={(e) =>
                  setCfg((c) => ({
                    ...c,
                    padronColatId: e.target.value
                      ? Number(e.target.value)
                      : null,
                  }))
                }
                disabled={cfg.estado !== "activo" || busy}
              >
                <option value="">— Seleccionar padrón —</option>
                {padronesActivos.map((p) => (
                  <option key={String(p.id)} value={String(p.id)}>
                    {p.padron}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => void refresh()}
              disabled={busy}
            >
              Refrescar precio
            </Button>
            <Button onClick={() => void guardarCfg()} disabled={busy}>
              {busy ? "Guardando…" : "Guardar configuración"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ===== KPIs de precio ===== */}
      <KpiGrid items={kpis} className="lg:grid-cols-3" />

      {/* ===== Grupo familiar ===== */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <div className="space-y-1">
            <CardTitle>Grupo familiar</CardTitle>
            <div className="text-xs text-neutral-500">
              {colaterales.length} integrante{colaterales.length === 1 ? "" : "s"}
              {" · "}
              {colaterales.filter((c) => c.esColateral !== false).length} con J38
            </div>
          </div>
          <Button
            onClick={abrirNuevo}
            disabled={cfg.estado !== "activo" || busy}
          >
            + Agregar integrante
          </Button>
        </CardHeader>
        <CardContent>
          {colaterales.length === 0 ? (
            <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center text-sm text-neutral-500">
              Sin integrantes en el grupo familiar.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-neutral-200">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-xs uppercase text-neutral-600">
                  <tr>
                    <th className="px-3 py-2 text-left">Parentesco</th>
                    <th className="px-3 py-2 text-left">Nombre</th>
                    <th className="px-3 py-2 text-left">DNI</th>
                    <th className="px-3 py-2 text-center">Edad</th>
                    <th className="px-3 py-2 text-left">Flags</th>
                    <th className="px-3 py-2 text-center">Rol</th>
                    <th className="px-3 py-2 text-center">Activo</th>
                    <th className="px-3 py-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {colaterales.map((c) => {
                    const parentesco =
                      c.parentescoNombre ??
                      parentescos.find(
                        (p) => String(p.id) === String(c.parentescoId),
                      )?.nombre ??
                      String(c.parentescoId);
                    const edad = edadDesde(c.fechaNacimiento);
                    const flags: string[] = [];
                    if (c.esEstudiante) flags.push("Estudiante");
                    if (c.esDiscapacitado) flags.push("Discapacidad");
                    if (c.tieneAportes) flags.push("Con aportes");
                    return (
                      <tr key={String(c.id)} className="hover:bg-neutral-50">
                        <td className="px-3 py-2">{parentesco}</td>
                        <td className="px-3 py-2 font-medium text-neutral-900">
                          {c.nombre}
                        </td>
                        <td className="px-3 py-2 text-neutral-600">
                          {c.dni || "—"}
                        </td>
                        <td className="px-3 py-2 text-center tabular-nums">
                          {edad ?? "—"}
                        </td>
                        <td className="px-3 py-2">
                          {flags.length === 0 ? (
                            <span className="text-neutral-400">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {flags.map((f) => (
                                <Badge key={f} variant="secondary">
                                  {f}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <Badge
                            variant={c.esColateral !== false ? "medical" : "secondary"}
                          >
                            {c.esColateral !== false ? "J38" : "GF"}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <Badge variant={c.activo ? "success" : "secondary"}>
                            {c.activo ? "Sí" : "No"}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="inline-flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => abrirEditar(c)}
                              disabled={busy}
                            >
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => confirmarEliminar(c)}
                              disabled={busy}
                            >
                              Eliminar
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== Modal alta/edición integrante ===== */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent maxWidth={520}>
          <DialogHeader>
            <DialogTitle>
              {isNew ? "Agregar integrante" : "Editar integrante"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-600">
                Parentesco
              </label>
              <select
                className="h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm"
                value={String(form.parentescoId ?? "")}
                onChange={(e) =>
                  setForm((f) => ({ ...f, parentescoId: e.target.value }))
                }
              >
                {parentescos.map((p) => (
                  <option key={String(p.id)} value={String(p.id)}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-600">
                Nombre completo
              </label>
              <Input
                placeholder="Apellido, Nombre"
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-600">
                  DNI (opcional)
                </label>
                <Input
                  maxLength={20}
                  placeholder="Sin puntos"
                  value={form.dni}
                  onChange={(e) => setForm((f) => ({ ...f, dni: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-600">
                  Fecha de nacimiento
                </label>
                <Input
                  type="date"
                  value={form.fechaNacimiento}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, fechaNacimiento: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-neutral-600">
                Condición
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="inline-flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.esEstudiante}
                    onCheckedChange={(v) =>
                      setForm((f) => ({ ...f, esEstudiante: !!v }))
                    }
                  />
                  <span>Estudiante (21–26)</span>
                </label>
                <label className="inline-flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.esDiscapacitado}
                    onCheckedChange={(v) =>
                      setForm((f) => ({ ...f, esDiscapacitado: !!v }))
                    }
                  />
                  <span>Discapacidad</span>
                </label>
                <label className="inline-flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.tieneAportes}
                    onCheckedChange={(v) =>
                      setForm((f) => ({ ...f, tieneAportes: !!v }))
                    }
                  />
                  <span>Tiene aportes (ANSES)</span>
                </label>
              </div>
            </div>

            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-neutral-600">
                Estado
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="inline-flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.esColateral}
                    onCheckedChange={(v) =>
                      setForm((f) => ({ ...f, esColateral: !!v }))
                    }
                  />
                  <span>Participa en J38 (es colateral)</span>
                </label>
                <label className="inline-flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.activo}
                    onCheckedChange={(v) =>
                      setForm((f) => ({ ...f, activo: !!v }))
                    }
                  />
                  <span>Activo</span>
                </label>
              </div>
              <div className="text-xs text-neutral-500">
                Marcar &ldquo;Participa en J38&rdquo; cobra el adicional. La
                clasificación del operario prevalece sobre cualquier sugerencia
                automática.
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setModalOpen(false)}
              disabled={busy}
            >
              Cancelar
            </Button>
            <Button onClick={() => void guardarColat()} disabled={busy}>
              {busy ? "Guardando…" : isNew ? "Agregar" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Confirmar eliminación ===== */}
      <ConfirmDialog
        open={delOpen}
        onOpenChange={setDelOpen}
        title="Eliminar integrante"
        description={
          delTarget ? (
            <span>
              Vas a eliminar a <b>{delTarget.nombre}</b> del grupo familiar.
              Esta acción no se puede deshacer.
            </span>
          ) : undefined
        }
        confirmLabel="Eliminar"
        variant="error"
        loading={busy}
        onConfirm={ejecutarEliminar}
      />
    </div>
  );
}

// Suprimimos warnings de Money sin uso (se queda disponible si lo necesitamos).
void Money;
