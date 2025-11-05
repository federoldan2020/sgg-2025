/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api, getErrorMessage } from "@/servicios/api";
import { fecha10, num } from "@/utiles/formatos";

/** ===== Tipos locales ===== */
type IdLike = string | number | bigint;

type Parentesco = {
  id: IdLike;
  codigo: number;
  descripcion?: string | null;
  nombre?: string | null;
};

type ReglaPrecioColateralRow = {
  id: IdLike;
  organizacionId: string;
  parentescoId: IdLike;
  cantidadDesde: number;
  cantidadHasta: number | null;
  vigenteDesde: string;
  vigenteHasta: string | null;
  precioTotal: number;
  activo: boolean;
  parentesco?: {
    id: IdLike;
    codigo: number;
    descripcion?: string | null;
    nombre?: string | null;
  };
};

type Editable = {
  id?: IdLike;
  parentescoId: string;
  cantidadDesde: string;
  cantidadHasta: string;
  vigenteDesde: string;
  vigenteHasta: string;
  precioTotal: string;
  activo?: boolean;
};

type Publicacion = {
  id: IdLike;
  estado: "draft" | "publicada" | "cancelada";
  comentario?: string | null;
  creadoAt?: string;
  publicadoAt?: string | null;
};

/** ===== Helpers ===== */
const onlyInt = (v: string) => v.replace(/\D+/g, "");
const normalizeDecimal = (v: string) =>
  v
    .trim()
    .replace(",", ".")
    .replace(/[^\d.]/g, "")
    .replace(/(\..*)\./g, "$1");

const parentescoLabel = (p?: {
  descripcion?: string | null;
  nombre?: string | null;
  codigo?: number;
}) =>
  (p?.descripcion && p.descripcion.trim()) ||
  (p?.nombre && p.nombre.trim()) ||
  (p?.codigo != null ? `(cód. ${p.codigo})` : "—");

/** ===== Inputs con estado local ===== */
function usePropToLocal(value: string) {
  const [local, setLocal] = useState<string>(value ?? "");
  const prevProp = useRef<string>(value ?? "");
  useEffect(() => {
    if (prevProp.current !== value) {
      prevProp.current = value ?? "";
      setLocal(value ?? "");
    }
  }, [value]);
  return [local, setLocal] as const;
}

function IntInput({
  value,
  onCommit,
  placeholder,
}: {
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
}) {
  const [local, setLocal] = usePropToLocal(value);
  return (
    <input
      type="text"
      inputMode="numeric"
      className="filter-select"
      placeholder={placeholder}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => onCommit(onlyInt(local))}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        else if (e.key === "Escape") {
          setLocal(value);
          (e.currentTarget as HTMLInputElement).blur();
        }
      }}
    />
  );
}

function MoneyInput({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (v: string) => void;
}) {
  const [local, setLocal] = usePropToLocal(value);
  return (
    <input
      type="text"
      inputMode="decimal"
      className="filter-select"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => onCommit(normalizeDecimal(local))}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        else if (e.key === "Escape") {
          setLocal(value);
          (e.currentTarget as HTMLInputElement).blur();
        }
      }}
    />
  );
}

/** ===== Page ===== */
export default function ReglasColateralesPage() {
  const [lista, setLista] = useState<ReglaPrecioColateralRow[]>([]);
  const [parentescos, setParentescos] = useState<Parentesco[]>([]);

  const [form, setForm] = useState<Editable>({
    parentescoId: "",
    cantidadDesde: "1",
    cantidadHasta: "",
    vigenteDesde: "",
    vigenteHasta: "",
    precioTotal: "0",
  });

  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState<Editable | null>(null);

  /** ===== Publicación (nuevo) ===== */
  const [pub, setPub] = useState<Publicacion | null>(null);
  const [pubComentario, setPubComentario] = useState("");
  const [pubBusy, setPubBusy] = useState(false);

  /** Carga */
  const cargar = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const [datos, cats] = await Promise.all([
        api<ReglaPrecioColateralRow[]>("/colaterales/reglas"),
        api<Parentesco[]>("/colaterales/parentescos"),
      ]);

      setLista(datos ?? []);
      setParentescos(cats ?? []);

      setForm((f) => ({
        ...f,
        parentescoId:
          f.parentescoId === "" && (cats?.length ?? 0) > 0
            ? String(cats![0].id)
            : f.parentescoId,
      }));
    } catch (e) {
      setMsg(`ERROR:${getErrorMessage(e)}`);
    } finally {
      setLoading(false);
    }
  };

  // (Opcional) cargar publicación abierta si tenés GET /publicaciones/abierta
  const cargarPublicacion = async () => {
    try {
      // const abierta = await api<Publicacion | null>("/publicaciones/abierta");
      // setPub(abierta ?? null);
      // setPubComentario(abierta?.comentario ?? "");
    } catch {
      /* noop */
    }
  };

  useEffect(() => {
    void cargar();
    void cargarPublicacion();
  }, []);

  /** Helpers */
  const limpiarForm = () =>
    setForm({
      parentescoId: parentescos[0]?.id ? String(parentescos[0].id) : "",
      cantidadDesde: "1",
      cantidadHasta: "",
      vigenteDesde: "",
      vigenteHasta: "",
      precioTotal: "0",
    });

  const validar = (r: Editable) => {
    if (!r.parentescoId) return "Seleccioná un parentesco";
    if (!r.cantidadDesde || Number(r.cantidadDesde) <= 0)
      return "Cantidad desde debe ser mayor a 0";
    if (r.cantidadHasta) {
      if (Number(r.cantidadHasta) < Number(r.cantidadDesde))
        return "Cantidad hasta no puede ser menor a desde";
    }
    if (!r.vigenteDesde) return "Vigente desde es obligatorio";
    if (r.vigenteHasta && r.vigenteHasta < r.vigenteDesde)
      return "Vigente hasta no puede ser menor a vigente desde";
    if (r.precioTotal === "" || Number(r.precioTotal) < 0)
      return "Precio total inválido";
    return null;
  };

  /** Acciones reglas */
  const crear = async () => {
    const err = validar(form);
    if (err) return setMsg(`ERROR:${err}`);

    try {
      setBusy(true);
      await api("/colaterales/reglas", {
        method: "POST",
        body: JSON.stringify({
          parentescoId: Number(form.parentescoId),
          cantidadDesde: Number(form.cantidadDesde),
          cantidadHasta: form.cantidadHasta ? Number(form.cantidadHasta) : null,
          vigenteDesde: form.vigenteDesde,
          vigenteHasta: form.vigenteHasta || undefined,
          precioTotal: Number(form.precioTotal),
        }),
      });
      await cargar();
      limpiarForm();
      setMsg("SUCCESS:Regla creada");
    } catch (e) {
      setMsg(`ERROR:${getErrorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (id: IdLike, activo: boolean) => {
    try {
      setBusy(true);
      await api(`/colaterales/reglas/${id}/estado`, {
        method: "PATCH",
        body: JSON.stringify({ activo: !activo }),
      });
      await cargar();
    } catch (e) {
      setMsg(`ERROR:${getErrorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const borrar = async (id: IdLike) => {
    if (!confirm("¿Eliminar esta regla?")) return;
    try {
      setBusy(true);
      await api(`/colaterales/reglas/${id}`, { method: "DELETE" });
      await cargar();
      setMsg("SUCCESS:Regla eliminada");
    } catch (e) {
      setMsg(`ERROR:${getErrorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const abrirEditar = (r: ReglaPrecioColateralRow) => {
    const pid = r.parentesco?.id ?? r.parentescoId;
    setEditRow({
      id: r.id,
      parentescoId: String(pid),
      cantidadDesde: String(r.cantidadDesde ?? ""),
      cantidadHasta: r.cantidadHasta != null ? String(r.cantidadHasta) : "",
      vigenteDesde: fecha10(r.vigenteDesde),
      vigenteHasta: fecha10(r.vigenteHasta) || "",
      precioTotal: String(r.precioTotal ?? 0),
      activo: r.activo,
    });
    setEditOpen(true);
  };

  const guardarEdicion = async () => {
    if (!editRow || !editRow.id) return;
    const err = validar(editRow);
    if (err) return setMsg(`ERROR:${err}`);

    try {
      setBusy(true);
      await api(`/colaterales/reglas/${editRow.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          parentescoId: Number(editRow.parentescoId),
          cantidadDesde: Number(editRow.cantidadDesde),
          cantidadHasta: editRow.cantidadHasta
            ? Number(editRow.cantidadHasta)
            : null,
          vigenteDesde: editRow.vigenteDesde,
          vigenteHasta: editRow.vigenteHasta || null,
          precioTotal: Number(editRow.precioTotal),
        }),
      });
      setEditOpen(false);
      setEditRow(null);
      await cargar();
      setMsg("SUCCESS:Regla actualizada");
    } catch (e) {
      setMsg(`ERROR:${getErrorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const duplicar = (r: ReglaPrecioColateralRow) => {
    const pid = r.parentesco?.id ?? r.parentescoId;
    setForm({
      parentescoId: String(pid),
      cantidadDesde: String(r.cantidadDesde ?? 1),
      cantidadHasta: r.cantidadHasta != null ? String(r.cantidadHasta) : "",
      vigenteDesde: fecha10(r.vigenteDesde) || "",
      vigenteHasta: fecha10(r.vigenteHasta) || "",
      precioTotal: String(r.precioTotal ?? 0),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /** ===== Acciones publicación (nuevo) ===== */
  const abrirPublicacion = async () => {
    setPubBusy(true);
    setMsg(null);
    try {
      const abierta = await api<Publicacion>("/publicaciones/abierta", {
        method: "POST",
      });
      setPub(abierta);
      setPubComentario(abierta?.comentario ?? "");
      setMsg("SUCCESS:Publicación abierta.");
    } catch (e) {
      setMsg(`ERROR:${getErrorMessage(e)}`);
    } finally {
      setPubBusy(false);
    }
  };

  const publicarCambios = async () => {
    setPubBusy(true);
    setMsg(null);
    try {
      // si no hay publicación abierta, la creo primero
      let pubId = pub?.id;
      if (!pubId) {
        const nueva = await api<Publicacion>("/publicaciones/abierta", {
          method: "POST",
        });
        pubId = nueva.id;
        setPub(nueva);
      }

      await api(`/publicaciones/${pubId}/publicar`, {
        method: "POST",
        body: JSON.stringify({
          comentario: pubComentario || undefined,
        }),
      });

      setMsg(
        "SUCCESS:Publicación encolada. Se recalculará J38 y se propagará al padrón."
      );
    } catch (e) {
      setMsg(`ERROR:${getErrorMessage(e)}`);
    } finally {
      setPubBusy(false);
    }
  };

  /** Orden */
  const sorted = useMemo(() => {
    return [...lista].sort((a, b) => {
      const ca =
        Number(a?.parentesco?.codigo ?? 0) - Number(b?.parentesco?.codigo ?? 0);
      if (ca !== 0) return ca;
      const da = (a.cantidadDesde ?? 0) - (b.cantidadDesde ?? 0);
      if (da !== 0) return da;
      const ha =
        (a.cantidadHasta ?? Number.POSITIVE_INFINITY) -
        (b.cantidadHasta ?? Number.POSITIVE_INFINITY);
      if (ha !== 0) return ha;
      return String(a.id).localeCompare(String(b.id));
    });
  }, [lista]);

  /** UI helpers */
  const Field = (props: React.PropsWithChildren<{ label: string }>) => (
    <div>
      <label
        className="filter-label"
        style={{ display: "block", fontSize: 12, color: "#666" }}
      >
        {props.label}
      </label>
      {props.children}
    </div>
  );

  return (
    <div className="page-container">
      <div className="page-header" style={{ gap: 12 }}>
        <div className="page-title-section">
          <h1 className="page-title">Reglas por Colaterales (J38)</h1>
          <p className="page-subtitle">
            Definí precios por tramo de cantidad y parentesco. La vigencia
            determina qué regla aplica al calcular J38.
          </p>
        </div>

        {/* ===== Bloque Publicación (nuevo) ===== */}
        <div className="page-actions" style={{ marginLeft: "auto" }}>
          <div
            className="card"
            style={{
              padding: 12,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span className="feature-badge">
              {pub
                ? `Publicación abierta #${String(pub.id)}`
                : "Sin publicación abierta"}
            </span>

            <input
              className="filter-select"
              style={{ minWidth: 240 }}
              placeholder="Comentario de publicación (opcional)"
              value={pubComentario}
              onChange={(e) => setPubComentario(e.target.value)}
            />

            {!pub ? (
              <button
                className="btn btn-secondary"
                onClick={() => void abrirPublicacion()}
                disabled={pubBusy || busy}
              >
                {pubBusy ? "Abriendo…" : "Abrir publicación"}
              </button>
            ) : null}

            <button
              className="btn btn-primary"
              onClick={() => void publicarCambios()}
              disabled={pubBusy || busy}
              title="Aplicar reglas vigentes: recalcular J38 y propagar a padrón"
            >
              {pubBusy ? "Publicando…" : "Publicar cambios"}
            </button>
          </div>
        </div>
      </div>

      {msg && (
        <div
          className={`alert ${
            msg.startsWith("SUCCESS:")
              ? "alert-success"
              : msg.startsWith("ERROR:")
              ? "alert-error"
              : "alert-warning"
          }`}
        >
          <div className="alert-content">
            <div className="alert-icon">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                {msg.startsWith("SUCCESS:") ? (
                  <polyline points="16 12 11 17 8 14" />
                ) : msg.startsWith("ERROR:") ? (
                  <>
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </>
                ) : (
                  <line x1="12" y1="8" x2="12" y2="12" />
                )}
              </svg>
            </div>
            <div className="alert-text">
              {msg.replace(/^(SUCCESS:|ERROR:)/, "")}
            </div>
          </div>
        </div>
      )}

      {/* ===== Form alta ===== */}
      <section className="card" style={{ padding: 16, marginBottom: 16 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
            gap: 12,
            alignItems: "end",
          }}
        >
          <Field label="Parentesco">
            <select
              className="filter-select"
              value={form.parentescoId}
              onChange={(e) =>
                setForm((f) => ({ ...f, parentescoId: e.target.value }))
              }
              disabled={parentescos.length === 0}
            >
              <option value="" disabled>
                {parentescos.length === 0
                  ? "Cargando…"
                  : "Seleccionar parentesco…"}
              </option>
              {parentescos.map((p) => (
                <option key={String(p.id)} value={String(p.id)}>
                  {parentescoLabel(p)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Cantidad desde">
            <IntInput
              value={form.cantidadDesde}
              onCommit={(v) => setForm((f) => ({ ...f, cantidadDesde: v }))}
            />
          </Field>

          <Field label="Cantidad hasta (vacío = ∞)">
            <IntInput
              value={form.cantidadHasta}
              placeholder="∞"
              onCommit={(v) => setForm((f) => ({ ...f, cantidadHasta: v }))}
            />
          </Field>

          <Field label="Vigente desde">
            <input
              type="date"
              className="filter-select"
              value={form.vigenteDesde}
              onChange={(e) =>
                setForm((f) => ({ ...f, vigenteDesde: e.target.value }))
              }
            />
          </Field>

          <Field label="Vigente hasta (opcional)">
            <input
              type="date"
              className="filter-select"
              value={form.vigenteHasta}
              onChange={(e) =>
                setForm((f) => ({ ...f, vigenteHasta: e.target.value }))
              }
            />
          </Field>

          <Field label="Precio total del tramo">
            <MoneyInput
              value={form.precioTotal}
              onCommit={(v) => setForm((f) => ({ ...f, precioTotal: v }))}
            />
          </Field>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            marginTop: 12,
          }}
        >
          <button
            className="btn btn-secondary"
            onClick={limpiarForm}
            disabled={busy}
          >
            Limpiar
          </button>
          <button
            className="btn btn-primary"
            onClick={() => void crear()}
            disabled={busy}
          >
            {busy ? "Guardando…" : "Crear regla"}
          </button>
        </div>
      </section>

      {/* ===== Lista ===== */}
      <section className="card" style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0, marginBottom: 8 }}>Reglas</h3>

        {loading ? (
          <div className="loading-state" style={{ padding: 16 }}>
            <div className="loading-icon">
              <svg
                className="spinner"
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            </div>
            <div className="loading-text">Cargando reglas…</div>
          </div>
        ) : (
          <div
            className="table-container"
            style={{
              border: "1px solid #eee",
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
            <table
              className="data-table"
              style={{
                width: "100%",
                fontSize: 13,
                borderCollapse: "collapse",
              }}
            >
              <thead>
                <tr>
                  <th style={{ padding: 8 }}>Parentesco</th>
                  <th style={{ padding: 8 }}>Tramo</th>
                  <th style={{ padding: 8 }}>Vigencia</th>
                  <th style={{ padding: 8 }}>Precio</th>
                  <th style={{ padding: 8 }} className="table-col-center">
                    Activo
                  </th>
                  <th style={{ padding: 8 }} className="table-col-center">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: 12, color: "#666" }}>
                      Sin reglas
                    </td>
                  </tr>
                ) : (
                  sorted.map((r) => (
                    <tr
                      key={String(r.id)}
                      style={{ borderTop: "1px solid #eee" }}
                    >
                      <td style={{ padding: 8 }}>
                        {parentescoLabel(r.parentesco)}
                      </td>
                      <td style={{ padding: 8 }}>
                        {r.cantidadDesde}..{r.cantidadHasta ?? "∞"}
                      </td>
                      <td style={{ padding: 8 }}>
                        {fecha10(r.vigenteDesde)} →{" "}
                        {fecha10(r.vigenteHasta) || "∞"}
                      </td>
                      <td style={{ padding: 8 }}>${num(r.precioTotal)}</td>
                      <td style={{ padding: 8 }} className="table-col-center">
                        <span
                          className={`feature-badge ${
                            r.activo ? "feature-yes" : "feature-no"
                          }`}
                        >
                          {r.activo ? "Sí" : "No"}
                        </span>
                      </td>
                      <td style={{ padding: 8 }} className="table-col-center">
                        <div
                          className="btn-group"
                          style={{ display: "inline-flex", gap: 8 }}
                        >
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => abrirEditar(r)}
                            disabled={busy}
                          >
                            Editar
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => duplicar(r)}
                            disabled={busy}
                          >
                            Duplicar
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => void toggle(r.id, r.activo)}
                            disabled={busy}
                          >
                            {r.activo ? "Desactivar" : "Activar"}
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => void borrar(r.id)}
                            disabled={busy}
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ===== Modal edición ===== */}
      {editOpen && editRow && (
        <div
          role="dialog"
          aria-modal="true"
          className="modal-backdrop"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "grid",
            placeItems: "center",
            zIndex: 1000,
          }}
          onClick={() => !busy && setEditOpen(false)}
        >
          <div
            className="modal"
            style={{
              background: "#fff",
              borderRadius: 12,
              minWidth: 520,
              maxWidth: 680,
              padding: 16,
              boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: 0, marginBottom: 8 }}>Editar regla</h3>

            <div className="alert" style={{ marginBottom: 12 }}>
              <div className="alert-content">
                <div className="alert-icon">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <circle cx="12" cy="16" r="1" />
                  </svg>
                </div>
                <div className="alert-text">
                  Si hay superposición de vigencias, aplicará la de mayor{" "}
                  <b>vigenteDesde</b>.
                </div>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
                gap: 12,
                alignItems: "end",
              }}
            >
              <Field label="Parentesco">
                <select
                  className="filter-select"
                  value={editRow.parentescoId}
                  onChange={(e) =>
                    setEditRow(
                      (r) => r && { ...r, parentescoId: e.target.value }
                    )
                  }
                  disabled={parentescos.length === 0}
                >
                  <option value="" disabled>
                    {parentescos.length === 0
                      ? "Cargando…"
                      : "Seleccionar parentesco…"}
                  </option>
                  {parentescos.map((p) => (
                    <option key={String(p.id)} value={String(p.id)}>
                      {parentescoLabel(p)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Cantidad desde">
                <IntInput
                  value={editRow.cantidadDesde}
                  onCommit={(v) =>
                    setEditRow((r) => r && { ...r, cantidadDesde: v })
                  }
                />
              </Field>

              <Field label="Cantidad hasta (vacío = ∞)">
                <IntInput
                  value={editRow.cantidadHasta}
                  onCommit={(v) =>
                    setEditRow((r) => r && { ...r, cantidadHasta: v })
                  }
                />
              </Field>

              <Field label="Vigente desde">
                <input
                  type="date"
                  className="filter-select"
                  value={editRow.vigenteDesde}
                  onChange={(e) =>
                    setEditRow(
                      (r) => r && { ...r, vigenteDesde: e.target.value }
                    )
                  }
                />
              </Field>

              <Field label="Vigente hasta (opcional)">
                <input
                  type="date"
                  className="filter-select"
                  value={editRow.vigenteHasta}
                  onChange={(e) =>
                    setEditRow(
                      (r) => r && { ...r, vigenteHasta: e.target.value }
                    )
                  }
                />
              </Field>

              <Field label="Precio total del tramo">
                <MoneyInput
                  value={editRow.precioTotal}
                  onCommit={(v) =>
                    setEditRow((r) => r && { ...r, precioTotal: v })
                  }
                />
              </Field>

              <div>
                <label
                  className="filter-label"
                  style={{ display: "block", fontSize: 12, color: "#666" }}
                >
                  Estado
                </label>
                <span
                  className={`feature-badge ${
                    editRow.activo ? "feature-yes" : "feature-no"
                  }`}
                >
                  {editRow.activo ? "Activo" : "Inactivo"}
                </span>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                marginTop: 16,
              }}
            >
              <button
                className="btn btn-secondary"
                onClick={() => setEditOpen(false)}
                disabled={busy}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={() => void guardarEdicion()}
                disabled={busy}
              >
                {busy ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
