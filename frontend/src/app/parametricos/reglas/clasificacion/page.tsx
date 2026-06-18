"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { ConfirmDialog } from "@/components/ui-kit/ConfirmDialog";
import {
  listarReglasClasificacion,
  crearReglaClasificacion,
  actualizarReglaClasificacion,
  toggleReglaClasificacion,
  eliminarReglaClasificacion,
  reordenarReglasClasificacion,
  type ReglaClasificacion,
  type ClasifResultado,
} from "@/servicios/coseguroAdmin";
import { api, getErrorMessage } from "@/servicios/api";

type Parentesco = { id: string; codigo: number; nombre: string };

function badgeForResultado(r: ClasifResultado) {
  if (r === "GF") return { variant: "success" as const, label: "GF" };
  if (r === "J38") return { variant: "medical" as const, label: "J38" };
  return { variant: "error" as const, label: "Sin cobertura" };
}

function tribool(v: boolean | null | undefined): string {
  if (v === true) return "Sí";
  if (v === false) return "No";
  return "—";
}

function tritoSelect(v: boolean | null | undefined): "" | "true" | "false" {
  if (v === true) return "true";
  if (v === false) return "false";
  return "";
}
function selectToTribool(s: string): boolean | null {
  if (s === "true") return true;
  if (s === "false") return false;
  return null;
}

type Form = {
  parentescoCodigo: string;
  sexoTitular: "" | "M" | "F" | "X";
  edadDesde: string;
  edadHasta: string;
  requiereEstudiante: "" | "true" | "false";
  requiereAportes: "" | "true" | "false";
  requiereDiscapacidad: "" | "true" | "false";
  resultado: ClasifResultado;
  prioridad: string;
  vigenteDesde: string;
  vigenteHasta: string;
  descripcion: string;
  activo: boolean;
};

const formVacio = (proximaPrio: number): Form => ({
  parentescoCodigo: "",
  sexoTitular: "",
  edadDesde: "",
  edadHasta: "",
  requiereEstudiante: "",
  requiereAportes: "",
  requiereDiscapacidad: "",
  resultado: "J38",
  prioridad: String(proximaPrio),
  vigenteDesde: new Date().toISOString().slice(0, 10),
  vigenteHasta: "",
  descripcion: "",
  activo: true,
});

const formDe = (r: ReglaClasificacion): Form => ({
  parentescoCodigo: r.parentesco?.codigo != null ? String(r.parentesco.codigo) : "",
  sexoTitular: (r.sexoTitular ?? "") as Form["sexoTitular"],
  edadDesde: r.edadDesde != null ? String(r.edadDesde) : "",
  edadHasta: r.edadHasta != null ? String(r.edadHasta) : "",
  requiereEstudiante: tritoSelect(r.requiereEstudiante),
  requiereAportes: tritoSelect(r.requiereAportes),
  requiereDiscapacidad: tritoSelect(r.requiereDiscapacidad),
  resultado: r.resultado,
  prioridad: String(r.prioridad),
  vigenteDesde: r.vigenteDesde.slice(0, 10),
  vigenteHasta: r.vigenteHasta?.slice(0, 10) ?? "",
  descripcion: r.descripcion ?? "",
  activo: r.activo,
});

export default function ReglasClasificacionPage() {
  const [items, setItems] = useState<ReglaClasificacion[]>([]);
  const [parentescos, setParentescos] = useState<Parentesco[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ kind: "success" | "error"; msg: string } | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [isNew, setIsNew] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(formVacio(10));

  const [delOpen, setDelOpen] = useState(false);
  const [delTarget, setDelTarget] = useState<ReglaClasificacion | null>(null);

  const notify = (kind: "success" | "error", msg: string) => {
    setToast({ kind, msg });
    window.setTimeout(() => setToast(null), 4000);
  };

  const refresh = async () => {
    try {
      setLoading(true);
      const [rs, ps] = await Promise.all([
        listarReglasClasificacion(),
        api<Parentesco[]>(`/colaterales/parentescos`).catch(() => [] as Parentesco[]),
      ]);
      setItems(rs);
      setParentescos(ps);
    } catch (e) {
      notify("error", getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const proximaPrio = useMemo(() => {
    if (items.length === 0) return 10;
    return Math.max(...items.map((r) => r.prioridad)) + 1;
  }, [items]);

  const abrirNueva = () => {
    setIsNew(true);
    setEditId(null);
    setForm(formVacio(proximaPrio));
    setModalOpen(true);
  };
  const abrirEditar = (r: ReglaClasificacion) => {
    setIsNew(false);
    setEditId(r.id);
    setForm(formDe(r));
    setModalOpen(true);
  };

  const onGuardar = async () => {
    const prio = Number(form.prioridad);
    if (!Number.isInteger(prio)) {
      notify("error", "prioridad debe ser entero");
      return;
    }
    const body = {
      parentescoCodigo: form.parentescoCodigo === "" ? null : Number(form.parentescoCodigo),
      sexoTitular: form.sexoTitular === "" ? null : (form.sexoTitular as "M" | "F" | "X"),
      edadDesde: form.edadDesde === "" ? null : Number(form.edadDesde),
      edadHasta: form.edadHasta === "" ? null : Number(form.edadHasta),
      requiereEstudiante: selectToTribool(form.requiereEstudiante),
      requiereAportes: selectToTribool(form.requiereAportes),
      requiereDiscapacidad: selectToTribool(form.requiereDiscapacidad),
      resultado: form.resultado,
      prioridad: prio,
      vigenteHasta: form.vigenteHasta || null,
      descripcion: form.descripcion || null,
      activo: form.activo,
    };
    try {
      setBusy(true);
      if (isNew) {
        await crearReglaClasificacion({
          ...body,
          vigenteDesde: form.vigenteDesde,
        });
        notify("success", "Regla creada");
      } else if (editId) {
        await actualizarReglaClasificacion(editId, body);
        notify("success", "Regla actualizada");
      }
      setModalOpen(false);
      await refresh();
    } catch (e) {
      notify("error", getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const onToggle = async (r: ReglaClasificacion) => {
    try {
      setBusy(true);
      await toggleReglaClasificacion(r.id, !r.activo);
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
      await eliminarReglaClasificacion(delTarget.id);
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

  /** Sube o baja una regla en la lista (intercambia prioridad con la vecina). */
  const onMover = async (r: ReglaClasificacion, dir: "up" | "down") => {
    const ordenadas = [...items].sort((a, b) => a.prioridad - b.prioridad);
    const idx = ordenadas.findIndex((x) => x.id === r.id);
    if (idx < 0) return;
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= ordenadas.length) return;
    const otra = ordenadas[swapIdx];
    try {
      setBusy(true);
      await reordenarReglasClasificacion([
        { id: r.id, prioridad: otra.prioridad },
        { id: otra.id, prioridad: r.prioridad },
      ]);
      await refresh();
    } catch (e) {
      notify("error", getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Reglas de clasificación"
        subtitle="Sugerencias de clasificación (GF / J38 / Sin cobertura) de cada integrante. El operario sigue siendo quien decide en la ficha."
      >
        <Button onClick={abrirNueva}>+ Nueva regla</Button>
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

      <Card className="py-0">
        <CardContent className="px-0 py-0">
          {loading ? (
            <div className="space-y-3 p-6">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center text-sm text-neutral-500">
              No hay reglas de clasificación cargadas.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase text-neutral-600">
                  <tr>
                    <th className="px-3 py-3 text-right">Prio</th>
                    <th className="px-3 py-3 text-left">Parentesco</th>
                    <th className="px-3 py-3 text-left">Sexo tit.</th>
                    <th className="px-3 py-3 text-left">Edad</th>
                    <th className="px-3 py-3 text-left">Estud.</th>
                    <th className="px-3 py-3 text-left">Aportes</th>
                    <th className="px-3 py-3 text-left">Discap.</th>
                    <th className="px-3 py-3 text-center">Resultado</th>
                    <th className="px-3 py-3 text-left">Descripción</th>
                    <th className="px-3 py-3 text-center">Estado</th>
                    <th className="px-3 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {items
                    .sort((a, b) => a.prioridad - b.prioridad)
                    .map((r, idx, arr) => {
                      const b = badgeForResultado(r.resultado);
                      const edad =
                        r.edadDesde != null || r.edadHasta != null
                          ? `${r.edadDesde ?? "—"} – ${r.edadHasta ?? "—"}`
                          : "—";
                      return (
                        <tr key={r.id} className="hover:bg-neutral-50">
                          <td className="px-3 py-2 text-right font-mono text-xs">
                            {r.prioridad}
                          </td>
                          <td className="px-3 py-2 text-neutral-700">
                            {r.parentesco
                              ? `${r.parentesco.codigo} · ${r.parentesco.descripcion}`
                              : <span className="text-neutral-400">cualquier</span>}
                          </td>
                          <td className="px-3 py-2 text-neutral-600">
                            {r.sexoTitular ?? "—"}
                          </td>
                          <td className="px-3 py-2 text-neutral-600 tabular-nums">
                            {edad}
                          </td>
                          <td className="px-3 py-2 text-neutral-600">
                            {tribool(r.requiereEstudiante)}
                          </td>
                          <td className="px-3 py-2 text-neutral-600">
                            {tribool(r.requiereAportes)}
                          </td>
                          <td className="px-3 py-2 text-neutral-600">
                            {tribool(r.requiereDiscapacidad)}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <Badge variant={b.variant}>{b.label}</Badge>
                          </td>
                          <td className="px-3 py-2 text-neutral-600 max-w-xs truncate">
                            {r.descripcion ?? "—"}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <Badge variant={r.activo ? "success" : "secondary"}>
                              {r.activo ? "Activa" : "Inactiva"}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="inline-flex gap-0.5">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => void onMover(r, "up")}
                                disabled={busy || idx === 0}
                                title="Subir prioridad"
                              >
                                ↑
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => void onMover(r, "down")}
                                disabled={busy || idx === arr.length - 1}
                                title="Bajar prioridad"
                              >
                                ↓
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => abrirEditar(r)}
                                disabled={busy}
                              >
                                Editar
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => void onToggle(r)}
                                disabled={busy}
                              >
                                {r.activo ? "Pausar" : "Activar"}
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
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal alta/edición */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent maxWidth={620}>
          <DialogHeader>
            <DialogTitle>{isNew ? "Nueva regla" : "Editar regla"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-600">Prioridad</label>
                <Input
                  type="number"
                  value={form.prioridad}
                  onChange={(e) => setForm((f) => ({ ...f, prioridad: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-neutral-600">
                  Parentesco (vacío = cualquiera)
                </label>
                <select
                  className="h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm"
                  value={form.parentescoCodigo}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, parentescoCodigo: e.target.value }))
                  }
                >
                  <option value="">— cualquiera —</option>
                  {parentescos.map((p) => (
                    <option key={p.id} value={String(p.codigo)}>
                      {p.codigo} · {p.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-600">
                  Sexo titular
                </label>
                <select
                  className="h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm"
                  value={form.sexoTitular}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      sexoTitular: e.target.value as Form["sexoTitular"],
                    }))
                  }
                >
                  <option value="">cualquiera</option>
                  <option value="M">M</option>
                  <option value="F">F</option>
                  <option value="X">X</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-600">
                  Edad desde
                </label>
                <Input
                  type="number"
                  value={form.edadDesde}
                  onChange={(e) => setForm((f) => ({ ...f, edadDesde: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-600">
                  Edad hasta
                </label>
                <Input
                  type="number"
                  value={form.edadHasta}
                  onChange={(e) => setForm((f) => ({ ...f, edadHasta: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {(
                [
                  ["requiereEstudiante", "Requiere estudiante"],
                  ["requiereAportes", "Requiere con aportes"],
                  ["requiereDiscapacidad", "Requiere discapacidad"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-600">{label}</label>
                  <select
                    className="h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm"
                    value={form[key]}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        [key]: e.target.value as "" | "true" | "false",
                      }))
                    }
                  >
                    <option value="">no importa</option>
                    <option value="true">debe ser Sí</option>
                    <option value="false">debe ser No</option>
                  </select>
                </div>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-600">Resultado</label>
                <select
                  className="h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm"
                  value={form.resultado}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, resultado: e.target.value as ClasifResultado }))
                  }
                >
                  <option value="GF">GF (grupo familiar)</option>
                  <option value="J38">J38 (colateral)</option>
                  <option value="SIN_COBERTURA">SIN_COBERTURA</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-600">
                  Vigente desde
                </label>
                <Input
                  type="date"
                  value={form.vigenteDesde}
                  disabled={!isNew}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, vigenteDesde: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-600">
                  Vigente hasta
                </label>
                <Input
                  type="date"
                  value={form.vigenteHasta}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, vigenteHasta: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-600">
                Descripción (visible en la UI cuando esta regla matchee)
              </label>
              <Input
                value={form.descripcion}
                onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
              />
            </div>

            <label className="inline-flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.activo}
                onCheckedChange={(v) => setForm((f) => ({ ...f, activo: !!v }))}
              />
              <span>Activa</span>
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button onClick={() => void onGuardar()} disabled={busy}>
              {busy ? "Guardando…" : isNew ? "Crear" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={delOpen}
        onOpenChange={setDelOpen}
        title="Eliminar regla"
        description={
          delTarget ? (
            <span>
              Vas a eliminar la regla de prioridad <b>{delTarget.prioridad}</b>.
              No se puede deshacer.
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
