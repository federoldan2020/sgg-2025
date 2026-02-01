"use client";

import { useEffect, useMemo, useState } from "react";
import { api, getErrorMessage } from "@/servicios/api";
import { formatearFechaArgentina } from "@/utiles/formatos";

type AfiliadoSuggest = {
  id: string;
  dni: string;
  display: string;
};

type Parentesco = { id: string | number; codigo?: number | null; nombre: string };

type Colateral = {
  id: string | number;
  parentescoId?: string | number | null;
  parentescoNombre?: string | null;
  parentesco?: { id?: string | number; codigo?: number | null; descripcion?: string | null };
  nombre: string;
  dni?: string | null;
  fechaNacimiento?: string | null;
  activo: boolean;
  esColateral?: boolean;
};

function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const h = setTimeout(() => setV(value), ms);
    return () => clearTimeout(h);
  }, [value, ms]);
  return v;
}

const formatFecha = (v?: string | null) => {
  if (!v) return "—";
  return formatearFechaArgentina(v) || v;
};

// Convierte fecha ISO o Date a formato YYYY-MM-DD para input date
const fechaParaInput = (v?: string | null | Date): string => {
  if (!v) return "";
  if (v instanceof Date) {
    return v.toISOString().slice(0, 10);
  }
  // Si es string ISO (YYYY-MM-DD) o formato DD/MM/YYYY
  if (typeof v === "string") {
    // Si ya está en formato YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      return v;
    }
    // Si está en formato DD/MM/YYYY, convertir
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) {
      const [d, m, y] = v.split("/");
      return `${y}-${m}-${d}`;
    }
    // Intentar parsear como ISO
    try {
      const d = new Date(v);
      if (!isNaN(d.getTime())) {
        return d.toISOString().slice(0, 10);
      }
    } catch {
      // Ignorar
    }
  }
  return "";
};

export default function AfiliadosFamiliaresPage() {
  const [afiliado, setAfiliado] = useState<AfiliadoSuggest | null>(null);
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 250);
  const [sugerencias, setSugerencias] = useState<AfiliadoSuggest[]>([]);
  const [buscando, setBuscando] = useState(false);

  const [parentescos, setParentescos] = useState<Parentesco[]>([]);
  const [colaterales, setColaterales] = useState<Colateral[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [editColat, setEditColat] = useState<{
    open: boolean;
    row?: Partial<Colateral>;
    isNew?: boolean;
  }>({ open: false });

  useEffect(() => {
    let active = true;
    api<Parentesco[]>(`/colaterales/parentescos`, { method: "GET" })
      .then((r) => active && setParentescos(r ?? []))
      .catch(() => {
        /* opcional */
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (dq.trim().length < 2) {
      setSugerencias([]);
      return;
    }
    setBuscando(true);
    api<AfiliadoSuggest[]>(
      `/afiliados/suggest?q=${encodeURIComponent(dq)}`,
      { method: "GET" }
    )
      .then((r) => setSugerencias(r ?? []))
      .finally(() => setBuscando(false));
  }, [dq]);

  const recargarFamilia = async (afiliadoId: string) => {
    try {
      setLoading(true);
      const familia = await api<Colateral[]>(
        `/colaterales/afiliados/${afiliadoId}/colaterales?soloActivos=false`,
        { method: "GET" }
      );
      setColaterales(familia ?? []);
    } catch (e) {
      setMsg(`ERROR:${getErrorMessage(e)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!afiliado?.id) {
      setColaterales([]);
      return;
    }
    void recargarFamilia(String(afiliado.id));
  }, [afiliado?.id]);

  const parentescoNombre = (c: Colateral) => {
    if (c.parentescoNombre) return c.parentescoNombre;
    if (c.parentesco?.descripcion) return c.parentesco.descripcion;
    const cat = parentescos.find((p) => String(p.id) === String(c.parentescoId));
    return cat?.nombre ?? c.parentesco?.codigo ?? c.parentescoId ?? "—";
  };

  const abrirNuevoColat = () => {
    setEditColat({
      open: true,
      isNew: true,
      row: {
        parentescoId: parentescos[0]?.id ?? "",
        nombre: "",
        dni: "",
        fechaNacimiento: "",
        activo: true,
        esColateral: true,
      },
    });
  };

  const abrirEditarColat = (row: Colateral) => {
    setEditColat({
      open: true,
      isNew: false,
      row: {
        ...row,
        parentescoId: row.parentescoId ?? row.parentesco?.id ?? "",
        fechaNacimiento: fechaParaInput(row.fechaNacimiento),
      },
    });
  };

  const cerrarModalColat = () => setEditColat({ open: false });

  const guardarColat = async () => {
    if (!afiliado?.id) return;
    const r = editColat.row ?? {};
    if (!r.nombre?.toString().trim()) {
      setMsg("ERROR:El nombre es obligatorio.");
      return;
    }
    if (!r.parentescoId) {
      setMsg("ERROR:Seleccioná un parentesco.");
      return;
    }

    try {
      setBusy(true);
      const payload = {
        parentescoId: Number(r.parentescoId),
        nombre: r.nombre.toString().trim(),
        dni: (r.dni ?? "").toString().trim(),
        fechaNacimiento: r.fechaNacimiento || undefined,
        activo: r.activo ?? true,
        esColateral: r.esColateral ?? true,
      };

      if (editColat.isNew) {
        await api(`/colaterales/afiliados/${afiliado.id}/colaterales`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setMsg("SUCCESS:Familiar agregado");
      } else if (r.id != null) {
        await api(`/colaterales/afiliados/${afiliado.id}/colaterales/${r.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setMsg("SUCCESS:Familiar actualizado");
      }

      cerrarModalColat();
      await recargarFamilia(String(afiliado.id));
    } catch (e) {
      setMsg(`ERROR:${getErrorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const darDeBajaColat = async (id: string | number, nombre: string) => {
    if (!afiliado?.id) return;
    if (!confirm(`¿Dar de baja a ${nombre} del grupo familiar?`)) return;
    try {
      setBusy(true);
      await api(`/colaterales/afiliados/${afiliado.id}/colaterales/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ activo: false }),
      });
      setMsg("SUCCESS:Familiar dado de baja");
      await recargarFamilia(String(afiliado.id));
    } catch (e) {
      setMsg(`ERROR:${getErrorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const reactivarColat = async (id: string | number, nombre: string) => {
    if (!afiliado?.id) return;
    if (!confirm(`¿Reactivar a ${nombre} en el grupo familiar?`)) return;
    try {
      setBusy(true);
      await api(`/colaterales/afiliados/${afiliado.id}/colaterales/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ activo: true }),
      });
      setMsg("SUCCESS:Familiar reactivado");
      await recargarFamilia(String(afiliado.id));
    } catch (e) {
      setMsg(`ERROR:${getErrorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const eliminarColat = async (id: string | number) => {
    if (!afiliado?.id) return;
    if (!confirm("¿Eliminar permanentemente este familiar? Esta acción no se puede deshacer.")) return;
    try {
      setBusy(true);
      await api(`/colaterales/afiliados/${afiliado.id}/colaterales/${id}`, {
        method: "DELETE",
      });
      setMsg("SUCCESS:Familiar eliminado");
      await recargarFamilia(String(afiliado.id));
    } catch (e) {
      setMsg(`ERROR:${getErrorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const seleccionLabel = useMemo(() => {
    if (!afiliado) return "Buscá afiliado por DNI, nombre o padrón…";
    return `${afiliado.display} (DNI ${afiliado.dni})`;
  }, [afiliado]);

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title-section">
          <h1 className="page-title">ABM familiares</h1>
          <p className="page-subtitle">Gestión del grupo familiar de afiliados.</p>
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
          style={{ marginBottom: 16 }}
        >
          {msg.replace(/^SUCCESS:|^ERROR:/, "")}
        </div>
      )}

      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <label className="filter-label" style={{ display: "block", marginBottom: 8 }}>
          Afiliado
        </label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            className="filter-select"
            style={{ minWidth: 280, flex: 1 }}
            value={q}
            placeholder={seleccionLabel}
            onChange={(e) => setQ(e.target.value)}
          />
          {afiliado && (
            <button
              className="btn btn-secondary"
              onClick={() => {
                setAfiliado(null);
                setQ("");
                setSugerencias([]);
              }}
            >
              Cambiar afiliado
            </button>
          )}
        </div>

        {buscando && (
          <div className="no-data" style={{ marginTop: 8 }}>
            Buscando afiliados...
          </div>
        )}

        {!buscando && sugerencias.length > 0 && (
          <div
            className="table-container"
            style={{ marginTop: 12, border: "1px solid #eee", borderRadius: 8 }}
          >
            <table className="data-table" style={{ width: "100%" }}>
              <tbody>
                {sugerencias.map((s) => (
                  <tr
                    key={s.id}
                    style={{ cursor: "pointer" }}
                    onClick={() => {
                      setAfiliado(s);
                      setQ("");
                      setSugerencias([]);
                    }}
                  >
                    <td style={{ padding: 10, fontWeight: 600 }}>{s.display}</td>
                    <td style={{ padding: 10, color: "#666" }}>DNI {s.dni}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!afiliado && (
        <div className="card" style={{ padding: 16 }}>
          <div className="no-data">Seleccioná un afiliado para administrar el grupo familiar.</div>
        </div>
      )}

      {afiliado && (
        <div className="card" style={{ padding: 16 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>{afiliado.display}</div>
              <div style={{ fontSize: 12, color: "#666" }}>DNI {afiliado.dni}</div>
            </div>
            <button className="btn btn-primary" onClick={abrirNuevoColat} disabled={busy}>
              Agregar familiar
            </button>
          </div>

          <div
            className="table-container"
            style={{ border: "1px solid #eee", borderRadius: 10, overflow: "hidden" }}
          >
            <table
              className="data-table"
              style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}
            >
              <thead>
                <tr>
                  <th style={{ padding: 8 }}>Parentesco</th>
                  <th style={{ padding: 8 }}>Nombre</th>
                  <th style={{ padding: 8 }}>DNI</th>
                  <th style={{ padding: 8 }}>Fecha nac.</th>
                  <th style={{ padding: 8 }} className="table-col-center">
                    J38
                  </th>
                  <th style={{ padding: 8 }} className="table-col-center">
                    Activo
                  </th>
                  <th style={{ padding: 8 }} className="table-col-center">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 12, color: "#666" }}>
                      Cargando...
                    </td>
                  </tr>
                ) : colaterales.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 12, color: "#666" }}>
                      Sin familiares cargados
                    </td>
                  </tr>
                ) : (
                  colaterales.map((c) => {
                    const participaJ38 = c.esColateral ?? true;
                    return (
                      <tr key={String(c.id)} style={{ borderTop: "1px solid #eee" }}>
                        <td style={{ padding: 8 }}>{parentescoNombre(c)}</td>
                        <td style={{ padding: 8 }}>{c.nombre}</td>
                        <td style={{ padding: 8 }}>{(c.dni ?? "").toString() || "—"}</td>
                        <td style={{ padding: 8 }}>{formatFecha(c.fechaNacimiento)}</td>
                        <td style={{ padding: 8 }} className="table-col-center">
                          <span
                            className={`feature-badge ${
                              participaJ38 ? "feature-yes" : "feature-no"
                            }`}
                          >
                            {participaJ38 ? "Sí" : "No"}
                          </span>
                        </td>
                        <td style={{ padding: 8 }} className="table-col-center">
                          <span
                            className={`feature-badge ${
                              c.activo ? "feature-yes" : "feature-no"
                            }`}
                          >
                            {c.activo ? "Sí" : "No"}
                          </span>
                        </td>
                        <td style={{ padding: 8 }} className="table-col-center">
                          <div style={{ display: "inline-flex", gap: 8, flexWrap: "wrap" }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => abrirEditarColat(c)}
                              disabled={busy}
                            >
                              Editar
                            </button>
                            {c.activo ? (
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => void darDeBajaColat(c.id, c.nombre)}
                                disabled={busy}
                                title="Dar de baja del grupo familiar"
                              >
                                Dar de baja
                              </button>
                            ) : (
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => void reactivarColat(c.id, c.nombre)}
                                disabled={busy}
                                title="Reactivar en el grupo familiar"
                              >
                                Reactivar
                              </button>
                            )}
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => void eliminarColat(c.id)}
                              disabled={busy}
                              title="Eliminar permanentemente"
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editColat.open && (
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
          onClick={() => !busy && cerrarModalColat()}
        >
          <div
            className="modal"
            style={{
              background: "#fff",
              borderRadius: 12,
              minWidth: 420,
              maxWidth: 560,
              padding: 16,
              boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: 0, marginBottom: 8 }}>
              {editColat.isNew ? "Agregar familiar" : "Editar familiar"}
            </h3>

            <div className="alert alert-warning" style={{ marginBottom: 12 }}>
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
                  Marcá <b>Participa en J38</b> si este integrante es colateral
                  del coseguro. Podés desmarcarlo para mantenerlo en el grupo
                  familiar sin impactar el J38.
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <label className="filter-label" style={{ display: "block", fontSize: 12 }}>
                  Parentesco
                </label>
                {parentescos.length > 0 ? (
                  <select
                    className="filter-select"
                    value={String(editColat.row?.parentescoId ?? "")}
                    onChange={(e) =>
                      setEditColat((s) => ({
                        ...s,
                        row: { ...s.row, parentescoId: e.target.value },
                      }))
                    }
                  >
                    {parentescos.map((p) => (
                      <option key={String(p.id)} value={String(p.id)}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="filter-select"
                    placeholder="ID de parentesco"
                    value={String(editColat.row?.parentescoId ?? "")}
                    onChange={(e) =>
                      setEditColat((s) => ({
                        ...s,
                        row: { ...s.row, parentescoId: e.target.value },
                      }))
                    }
                  />
                )}
              </div>

              <div>
                <label className="filter-label" style={{ display: "block", fontSize: 12 }}>
                  Nombre
                </label>
                <input
                  className="filter-select"
                  placeholder="Nombre completo"
                  value={String(editColat.row?.nombre ?? "")}
                  onChange={(e) =>
                    setEditColat((s) => ({
                      ...s,
                      row: { ...s.row, nombre: e.target.value },
                    }))
                  }
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="filter-label" style={{ display: "block", fontSize: 12 }}>
                    DNI
                  </label>
                  <input
                    className="filter-select"
                    placeholder="DNI (opcional)"
                    value={String(editColat.row?.dni ?? "")}
                    onChange={(e) =>
                      setEditColat((s) => ({
                        ...s,
                        row: { ...s.row, dni: e.target.value },
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="filter-label" style={{ display: "block", fontSize: 12 }}>
                    Fecha nac.
                  </label>
                  <input
                    className="filter-select"
                    type="date"
                    value={String(editColat.row?.fechaNacimiento ?? "")}
                    onChange={(e) =>
                      setEditColat((s) => ({
                        ...s,
                        row: { ...s.row, fechaNacimiento: e.target.value },
                      }))
                    }
                  />
                </div>
              </div>

              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={Boolean(editColat.row?.esColateral ?? true)}
                    onChange={(e) =>
                      setEditColat((s) => ({
                        ...s,
                        row: { ...s.row, esColateral: e.target.checked },
                      }))
                    }
                  />
                  <span>Participa en J38</span>
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={Boolean(editColat.row?.activo ?? true)}
                    onChange={(e) =>
                      setEditColat((s) => ({
                        ...s,
                        row: { ...s.row, activo: e.target.checked },
                      }))
                    }
                  />
                  <span>Activo</span>
                </label>
              </div>
            </div>

            <div
              style={{
                marginTop: 16,
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
              }}
            >
              <button className="btn btn-secondary" onClick={cerrarModalColat} disabled={busy}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={guardarColat} disabled={busy}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
