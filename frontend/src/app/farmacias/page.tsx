"use client";

import { useEffect, useState } from "react";
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
  listarFarmacias,
  crearFarmacia,
  actualizarFarmacia,
  resetPasswordFarmacia,
  eliminarFarmacia,
  type Farmacia,
} from "@/servicios/farmacias";
import { getErrorMessage } from "@/servicios/api";

type Form = {
  codigo: string;
  nombre: string;
  cuit: string;
  direccion: string;
  localidad: string;
  telefono: string;
  email: string;
  esInterna: boolean;
  usuario: string;
  password: string;
};
const formVacio = (): Form => ({
  codigo: "",
  nombre: "",
  cuit: "",
  direccion: "",
  localidad: "",
  telefono: "",
  email: "",
  esInterna: false,
  usuario: "",
  password: "",
});

export default function FarmaciasPage() {
  const [items, setItems] = useState<Farmacia[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ kind: "success" | "error"; msg: string } | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [isNew, setIsNew] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(formVacio());

  /** Password temporal mostrado tras alta o reset — visible una sola vez. */
  const [credDialog, setCredDialog] = useState<{
    farmacia: string;
    usuario: string;
    password: string;
  } | null>(null);

  const [delOpen, setDelOpen] = useState(false);
  const [delTarget, setDelTarget] = useState<Farmacia | null>(null);

  const notify = (kind: "success" | "error", msg: string) => {
    setToast({ kind, msg });
    window.setTimeout(() => setToast(null), 4000);
  };

  const refresh = async () => {
    try {
      setLoading(true);
      setItems(await listarFarmacias());
    } catch (e) {
      notify("error", getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const abrirNueva = () => {
    setIsNew(true);
    setEditId(null);
    setForm(formVacio());
    setModalOpen(true);
  };
  const abrirEditar = (f: Farmacia) => {
    setIsNew(false);
    setEditId(f.id);
    setForm({
      codigo: f.codigo,
      nombre: f.nombre,
      cuit: f.cuit ?? "",
      direccion: f.direccion ?? "",
      localidad: f.localidad ?? "",
      telefono: f.telefono ?? "",
      email: f.email ?? "",
      esInterna: f.esInterna,
      usuario: f.usuario ?? "",
      password: "",
    });
    setModalOpen(true);
  };

  const onGuardar = async () => {
    if (!form.codigo.trim() || !form.nombre.trim()) {
      notify("error", "código y nombre son obligatorios");
      return;
    }
    if (!form.esInterna && isNew && !form.usuario.trim()) {
      notify("error", "Las farmacias externas requieren usuario");
      return;
    }
    try {
      setBusy(true);
      if (isNew) {
        const res = await crearFarmacia({
          codigo: form.codigo.trim(),
          nombre: form.nombre.trim(),
          cuit: form.cuit.trim() || undefined,
          direccion: form.direccion.trim() || undefined,
          localidad: form.localidad.trim() || undefined,
          telefono: form.telefono.trim() || undefined,
          email: form.email.trim() || undefined,
          esInterna: form.esInterna,
          usuario: form.esInterna ? undefined : form.usuario.trim(),
          password:
            !form.esInterna && form.password.trim()
              ? form.password.trim()
              : undefined,
          activo: true,
        });
        notify("success", "Farmacia creada");
        if (!form.esInterna && res.passwordTemporal) {
          setCredDialog({
            farmacia: form.nombre,
            usuario: res.usuario ?? form.usuario,
            password: res.passwordTemporal,
          });
        }
      } else if (editId) {
        await actualizarFarmacia(editId, {
          nombre: form.nombre.trim(),
          cuit: form.cuit.trim(),
          direccion: form.direccion.trim(),
          localidad: form.localidad.trim(),
          telefono: form.telefono.trim(),
          email: form.email.trim(),
          usuario: form.usuario.trim() || undefined,
        });
        notify("success", "Farmacia actualizada");
      }
      setModalOpen(false);
      await refresh();
    } catch (e) {
      notify("error", getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const onResetPassword = async (f: Farmacia) => {
    try {
      setBusy(true);
      const res = await resetPasswordFarmacia(f.id);
      setCredDialog({
        farmacia: f.nombre,
        usuario: f.usuario ?? "",
        password: res.passwordTemporal,
      });
      notify("success", "Password reseteada — mostrá las credenciales a la farmacia");
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
      await eliminarFarmacia(delTarget.id);
      notify("success", "Farmacia desactivada");
      setDelOpen(false);
      setDelTarget(null);
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
        title="Farmacias"
        subtitle="Internas del gremio + externas adheridas con credenciales de acceso a la vista pública."
      >
        <Button onClick={abrirNueva}>+ Nueva farmacia</Button>
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
            <div className="space-y-2 p-6">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center text-sm text-neutral-500">
              No hay farmacias cargadas.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase text-neutral-600">
                  <tr>
                    <th className="px-3 py-3 text-left">Código</th>
                    <th className="px-3 py-3 text-left">Nombre</th>
                    <th className="px-3 py-3 text-left">Localidad</th>
                    <th className="px-3 py-3 text-left">Teléfono</th>
                    <th className="px-3 py-3 text-center">Tipo</th>
                    <th className="px-3 py-3 text-left">Usuario</th>
                    <th className="px-3 py-3 text-center">Estado</th>
                    <th className="px-3 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {items.map((f) => (
                    <tr key={f.id} className="hover:bg-neutral-50">
                      <td className="px-3 py-2 font-mono text-xs">{f.codigo}</td>
                      <td className="px-3 py-2 font-medium">{f.nombre}</td>
                      <td className="px-3 py-2 text-neutral-600">{f.localidad ?? "—"}</td>
                      <td className="px-3 py-2 text-neutral-600">{f.telefono ?? "—"}</td>
                      <td className="px-3 py-2 text-center">
                        <Badge variant={f.esInterna ? "medical" : "secondary"}>
                          {f.esInterna ? "Interna" : "Externa"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-neutral-600 font-mono text-xs">
                        {f.esInterna ? "—" : f.usuario ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Badge variant={f.activo ? "success" : "secondary"}>
                          {f.activo ? "Activa" : "Baja"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="inline-flex gap-0.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => abrirEditar(f)}
                            disabled={busy}
                          >
                            Editar
                          </Button>
                          {!f.esInterna && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => void onResetPassword(f)}
                              disabled={busy}
                              title="Genera una nueva contraseña temporal"
                            >
                              Reset pass
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setDelTarget(f);
                              setDelOpen(true);
                            }}
                            disabled={busy}
                          >
                            Baja
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

      {/* Alta/edición */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent maxWidth={580}>
          <DialogHeader>
            <DialogTitle>
              {isNew ? "Nueva farmacia" : "Editar farmacia"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-600">
                  Código *
                </label>
                <Input
                  value={form.codigo}
                  disabled={!isNew}
                  onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-600">Nombre *</label>
                <Input
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-600">CUIT</label>
                <Input
                  value={form.cuit}
                  onChange={(e) => setForm((f) => ({ ...f, cuit: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-600">
                  Localidad
                </label>
                <Input
                  value={form.localidad}
                  onChange={(e) => setForm((f) => ({ ...f, localidad: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-neutral-600">Dirección</label>
                <Input
                  value={form.direccion}
                  onChange={(e) => setForm((f) => ({ ...f, direccion: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-600">Teléfono</label>
                <Input
                  value={form.telefono}
                  onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-600">Email</label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
            </div>

            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 space-y-3">
              <label className="inline-flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.esInterna}
                  disabled={!isNew}
                  onCheckedChange={(v) =>
                    setForm((f) => ({ ...f, esInterna: !!v }))
                  }
                />
                <span>Es interna del gremio (sin login web)</span>
              </label>

              {!form.esInterna && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-neutral-600">
                      Usuario {isNew ? "*" : ""}
                    </label>
                    <Input
                      value={form.usuario}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, usuario: e.target.value }))
                      }
                    />
                  </div>
                  {isNew && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-neutral-600">
                        Password (opcional — si vacío se genera)
                      </label>
                      <Input
                        type="text"
                        value={form.password}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, password: e.target.value }))
                        }
                        placeholder="Mínimo 8 caracteres"
                      />
                    </div>
                  )}
                </div>
              )}
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
            <Button onClick={() => void onGuardar()} disabled={busy}>
              {busy ? "Guardando…" : isNew ? "Crear" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credenciales temporales tras alta/reset */}
      <Dialog
        open={credDialog != null}
        onOpenChange={(o) => {
          if (!o) setCredDialog(null);
        }}
      >
        <DialogContent maxWidth={460}>
          <DialogHeader>
            <DialogTitle>Credenciales generadas</DialogTitle>
          </DialogHeader>
          {credDialog && (
            <div className="space-y-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                ⚠ Anotá o copiá estos datos ahora. La contraseña{" "}
                <b>no se puede recuperar</b> después.
              </div>
              <div className="space-y-2 text-sm">
                <div>
                  <div className="text-xs text-neutral-500">Farmacia</div>
                  <div className="font-medium">{credDialog.farmacia}</div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500">Usuario</div>
                  <div className="font-mono text-base">{credDialog.usuario}</div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500">Contraseña</div>
                  <div className="font-mono text-base">{credDialog.password}</div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setCredDialog(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={delOpen}
        onOpenChange={setDelOpen}
        title="Dar de baja farmacia"
        description={
          delTarget ? (
            <span>
              Vas a dar de baja <b>{delTarget.nombre}</b>. Los consumos
              históricos se preservan. La farmacia no podrá loguearse hasta que
              la reactives.
            </span>
          ) : undefined
        }
        confirmLabel="Dar de baja"
        variant="error"
        loading={busy}
        onConfirm={onDelete}
      />
    </div>
  );
}
