/* eslint-disable @next/next/no-html-link-for-pages */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, getErrorMessage } from "@/servicios/api";

/** ======================= Tipos esperados del backend ======================= */
type EstadoCoseguro = "activo" | "baja" | "ninguno";

type AfiliadoLite = {
  id: string | number;
  dni?: string | number | null;
  apellido?: string | null;
  nombre?: string | null;
};

type PadronLite = { id: string | number; padron: string; activo?: boolean };

/** Objeto “config” del coseguro vinculado al afiliado */
type CoseguroCfg = {
  estado: EstadoCoseguro;
  fechaAlta?: string | null;
  fechaBaja?: string | null;
  padronCoseguroId?: string | number | null; // imputación J22
  padronColatId?: string | number | null; // imputación J38 (se lee de /colaterales/config)
};

/** Colateral */
type Colateral = {
  id: string | number;
  parentescoId: string | number;
  parentescoNombre?: string | null;
  nombre: string;
  dni?: string | null;
  fechaNacimiento?: string | null;
  activo: boolean;
  esColateral?: boolean; // participa en J38
};

/** Resumen de precios */
type PrecioResumen = {
  coseguro?: number | string | null;
  colaterales?: number | string | null;
  total?: number | string | null;
  reglas?: any[];
};

/** Catálogo de parentescos */
type Parentesco = { id: string | number; nombre: string };

/** ======================= Helpers UI ======================= */
function displayNombre(a?: string | null, n?: string | null) {
  const A = (a ?? "").trim();
  const N = (n ?? "").trim();
  if (A && N) return `${A}, ${N}`;
  if (A || N) return (A || N)!;
  return "(sin nombre)";
}

function fmtMoney(v?: number | string | null) {
  if (v == null || v === "") return "—";
  const num = Number(v);
  if (Number.isNaN(num)) return String(v);
  return num.toLocaleString("es-AR", { minimumFractionDigits: 2 });
}

function toISODate(d?: string | Date | null) {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toISOString().slice(0, 10);
}

/** ======================= Page ======================= */
export default function CoseguroAfiliadoPage() {
  // ✅ Ruta: /coseguro/[afiliadoId]
  const { afiliadoId: afiliadoIdParam } = useParams<{ afiliadoId: string }>();
  const afiliadoId = Number(afiliadoIdParam);

  /** Datos base */
  const [afiliado, setAfiliado] = useState<AfiliadoLite | null>(null);
  const [padrones, setPadrones] = useState<PadronLite[]>([]);
  const [cfg, setCfg] = useState<CoseguroCfg>({
    estado: "ninguno",
    padronCoseguroId: null,
    padronColatId: null,
  });
  const [colaterales, setColaterales] = useState<Colateral[]>([]);
  const [parentescos, setParentescos] = useState<Parentesco[]>([]);
  const [precio, setPrecio] = useState<PrecioResumen | null>(null);

  /** UI state */
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  /** Alta/edición de colateral (modal simple inline) */
  const [editColat, setEditColat] = useState<{
    open: boolean;
    row?: Partial<Colateral>;
    isNew?: boolean;
  }>({ open: false });

  /** Carga inicial */
  useEffect(() => {
    if (!afiliadoId || Number.isNaN(afiliadoId)) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setMsg(null);
      try {
        // 1) Panel COSEGURO (afiliado + padrones + estado J22)
        const panel = await api<{
          afiliado: AfiliadoLite;
          padrones: PadronLite[];
          coseguro: {
            estado: "activo" | "baja" | null;
            fechaAlta?: string | null;
            fechaBaja?: string | null;
            padronCoseguroId?: string | number | null;
          } | null;
        }>(`/coseguro/afiliados/${afiliadoId}`, { method: "GET" });

        // 2) Lista COLATERALES
        const familia = await api<Colateral[]>(
          `/colaterales/afiliados/${afiliadoId}/colaterales`,
          { method: "GET" }
        );

        // 3) Parentescos
        let cats: Parentesco[] = [];
        try {
          cats = await api<Parentesco[]>(`/colaterales/parentescos`, {
            method: "GET",
          });
        } catch {
          /* opcional */
        }

        // 4) Imputación J38 (opcional si el endpoint aún no existe)
        let cfgColat: { padronColatId?: string | number | null } | null = null;
        try {
          cfgColat = await api<{ padronColatId?: string | number | null }>(
            `/colaterales/afiliados/${afiliadoId}/config`,
            { method: "GET" }
          );
        } catch {
          /* opcional */
        }

        // 5) Precio (KPIs totales)
        let pr: PrecioResumen | null = null;
        try {
          pr = await api<PrecioResumen>(
            `/colaterales/precio?afiliadoId=${encodeURIComponent(
              String(afiliadoId)
            )}`,
            { method: "GET" }
          );
        } catch {
          /* opcional */
        }

        if (cancelled) return;

        setAfiliado(panel.afiliado ?? null);
        setPadrones(panel.padrones ?? []);
        setCfg({
          estado: panel.coseguro?.estado ?? "ninguno",
          padronCoseguroId: panel.coseguro?.padronCoseguroId ?? null,
          padronColatId: cfgColat?.padronColatId ?? null, // <- leído de colaterales
        });
        setColaterales(familia ?? []);
        setParentescos(cats ?? []);
        setPrecio(pr ?? null);
      } catch (e) {
        if (!cancelled) setMsg(getErrorMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [afiliadoId]);

  /** Acciones */
  const refrescarPrecio = async () => {
    try {
      const pr = await api<PrecioResumen>(
        `/colaterales/precio?afiliadoId=${encodeURIComponent(
          String(afiliadoId)
        )}`,
        { method: "GET" }
      );
      setPrecio(pr ?? null);
    } catch {
      /* noop */
    }
  };

  const guardarCfg = async () => {
    setMsg(null);
    try {
      setBusy(true);

      if (cfg.estado === "activo") {
        if (!cfg.padronCoseguroId)
          throw new Error("Seleccioná padrón de imputación para J22.");
        if (!cfg.padronColatId)
          throw new Error("Seleccioná padrón de imputación para J38.");

        // Alta de coseguro (J22)
        await api(`/coseguro/afiliados/${afiliadoId}/alta`, {
          method: "POST",
          body: JSON.stringify({ padronId: Number(cfg.padronCoseguroId) }),
        });

        // Imputación de colaterales (J38) — endpoint nuevo del back
        await api(`/colaterales/afiliados/${afiliadoId}/imputacion`, {
          method: "POST",
          body: JSON.stringify({ padronId: Number(cfg.padronColatId) }),
        });
      } else {
        // Baja de coseguro (J22=0). Para J38, la política puede ser mantener imputación configurada.
        await api(`/coseguro/afiliados/${afiliadoId}/baja`, { method: "POST" });
      }

      // Refrescar panel (para traer padronCoseguroId actualizado)
      const panel = await api<any>(`/coseguro/afiliados/${afiliadoId}`, {
        method: "GET",
      });

      // Refrescar config de colaterales (padronColatId)
      let cfgColat: { padronColatId?: string | number | null } | null = null;
      try {
        cfgColat = await api<{ padronColatId?: string | number | null }>(
          `/colaterales/afiliados/${afiliadoId}/config`,
          { method: "GET" }
        );
      } catch {
        /* opcional */
      }

      setCfg({
        estado: panel?.coseguro?.estado ?? "ninguno",
        padronCoseguroId: panel?.coseguro?.padronCoseguroId ?? null,
        padronColatId: cfgColat?.padronColatId ?? null,
      });

      await refrescarPrecio();
      setMsg("SUCCESS:Configuración guardada");
    } catch (e) {
      setMsg(`ERROR:${getErrorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const toggleCoseguro = (next: boolean) => {
    const nuevoEstado: EstadoCoseguro = next ? "activo" : "baja";
    setCfg((c) => ({ ...c, estado: nuevoEstado }));
  };

  const abrirNuevoColat = () => {
    setEditColat({
      open: true,
      isNew: true,
      row: {
        activo: true,
        esColateral: true,
        dni: "",
        parentescoId: parentescos[0]?.id ?? "",
        nombre: "",
        fechaNacimiento: "",
      },
    });
  };

  const abrirEditarColat = (row: Colateral) => {
    setEditColat({ open: true, isNew: false, row: { ...row } });
  };

  const cerrarModalColat = () => setEditColat({ open: false });

  const recargarFamilia = async () => {
    const familia = await api<Colateral[]>(
      `/colaterales/afiliados/${afiliadoId}/colaterales`,
      { method: "GET" }
    );
    setColaterales(familia ?? []);
  };

  const guardarColat = async () => {
    if (!editColat.open || !editColat.row) return;
    const r = editColat.row;

    try {
      setBusy(true);
      if (editColat.isNew) {
        await api(`/colaterales/afiliados/${afiliadoId}/colaterales`, {
          method: "POST",
          body: JSON.stringify({
            parentescoId: r.parentescoId ? Number(r.parentescoId) : undefined,
            nombre: (r.nombre ?? "").trim(),
            dni: (r.dni ?? "").trim() || undefined,
            fechaNacimiento: r.fechaNacimiento || undefined,
            activo: typeof r.activo === "boolean" ? r.activo : true,
            esColateral: r.esColateral ?? true,
          }),
        });
        setMsg("SUCCESS:Colateral agregado");
      } else {
        await api(`/colaterales/afiliados/${afiliadoId}/colaterales/${r.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            parentescoId: r.parentescoId ? Number(r.parentescoId) : undefined,
            nombre: (r.nombre ?? "").trim(),
            dni: (r.dni ?? "").trim(),
            fechaNacimiento: r.fechaNacimiento || undefined,
            activo: typeof r.activo === "boolean" ? r.activo : undefined,
            esColateral: r.esColateral,
          }),
        });
        setMsg("SUCCESS:Colateral actualizado");
      }

      await recargarFamilia();
      await refrescarPrecio();
      cerrarModalColat();
    } catch (e) {
      setMsg(`ERROR:${getErrorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const eliminarColat = async (id: string | number) => {
    if (!confirm("¿Eliminar este colateral?")) return;
    try {
      setBusy(true);
      await api(`/colaterales/afiliados/${afiliadoId}/colaterales/${id}`, {
        method: "DELETE",
      });
      setMsg("SUCCESS:Colateral eliminado");
      await recargarFamilia();
      await refrescarPrecio();
    } catch (e) {
      setMsg(`ERROR:${getErrorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const nombreAfiliado = displayNombre(
    afiliado?.apellido ?? null,
    afiliado?.nombre ?? null
  );
  const dniAf = afiliado?.dni ? String(afiliado.dni) : "—";

  /** ======================= Render ======================= */
  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div className="page-title-section">
          <h1 className="page-title">Coseguro &amp; Colaterales</h1>
          <p className="page-subtitle">
            {nombreAfiliado} — DNI {dniAf}
          </p>
        </div>
        <div className="page-actions" style={{ display: "flex", gap: 8 }}>
          <a href="/afiliados" className="btn btn-secondary">
            ← Volver al listado
          </a>
        </div>
      </div>

      {/* Mensajes */}
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
                strokeLinecap="round"
                strokeLinejoin="round"
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

      {loading ? (
        <div className="loading-state" style={{ padding: 24 }}>
          <div className="loading-icon">
            <svg
              className="spinner"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          </div>
          <div className="loading-text">Cargando datos…</div>
        </div>
      ) : (
        <div className="page-content" style={{ display: "grid", gap: 16 }}>
          {/* Configuración de coseguro */}
          <section className="card" style={{ padding: 16 }}>
            <div style={{ display: "grid", gap: 10 }}>
              <div
                style={{
                  display: "flex",
                  gap: 16,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <label className="filter-label" style={{ color: "#666" }}>
                    Coseguro
                  </label>
                  <span
                    className={`status-badge ${
                      cfg.estado === "activo"
                        ? "status-active"
                        : cfg.estado === "baja"
                        ? "status-inactive"
                        : ""
                    }`}
                  >
                    {cfg.estado.toUpperCase()}
                  </span>
                </div>
                <label
                  className="checkbox-label"
                  style={{
                    display: "inline-flex",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={cfg.estado === "activo"}
                    onChange={(e) => toggleCoseguro(e.target.checked)}
                  />
                  <span>Activo</span>
                </label>
              </div>

              {/* Warning moderno */}
              <div className="alert alert-warning">
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
                    Activar/desactivar coseguro puede generar novedades J22/J38
                    para el período según el día de corte.
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
                  gap: 12,
                }}
              >
                <div>
                  <label
                    className="filter-label"
                    style={{ display: "block", fontSize: 12, color: "#666" }}
                  >
                    Imputación J22 (coseguro)
                  </label>
                  <select
                    className="filter-select"
                    value={String(cfg.padronCoseguroId ?? "")}
                    onChange={(e) =>
                      setCfg((c) => ({
                        ...c,
                        padronCoseguroId: e.target.value
                          ? Number(e.target.value)
                          : null,
                      }))
                    }
                    disabled={cfg.estado !== "activo"}
                  >
                    <option value="">— Seleccionar padrón —</option>
                    {padrones
                      .filter((p) => p.activo !== false)
                      .map((p) => (
                        <option key={String(p.id)} value={String(p.id)}>
                          {p.padron}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label
                    className="filter-label"
                    style={{ display: "block", fontSize: 12, color: "#666" }}
                  >
                    Imputación J38 (colaterales)
                  </label>
                  <select
                    className="filter-select"
                    value={String(cfg.padronColatId ?? "")}
                    onChange={(e) =>
                      setCfg((c) => ({
                        ...c,
                        padronColatId: e.target.value
                          ? Number(e.target.value)
                          : null,
                      }))
                    }
                    disabled={cfg.estado !== "activo"}
                  >
                    <option value="">— Seleccionar padrón —</option>
                    {padrones
                      .filter((p) => p.activo !== false)
                      .map((p) => (
                        <option key={String(p.id)} value={String(p.id)}>
                          {p.padron}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div
                style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}
              >
                <button
                  className="btn btn-secondary"
                  onClick={() => void refrescarPrecio()}
                  disabled={busy}
                >
                  Refrescar precio
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => void guardarCfg()}
                  disabled={busy}
                >
                  {busy ? "Guardando..." : "Guardar configuración"}
                </button>
              </div>
            </div>
          </section>

          {/* Resumen precios */}
          <section
            className="card"
            style={{
              padding: 16,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
              gap: 12,
            }}
          >
            <div
              className="kpi-card"
              style={{
                border: "1px solid #eee",
                borderRadius: 10,
                padding: 12,
              }}
            >
              <div style={{ fontSize: 12, color: "#666" }}>Coseguro (J22)</div>
              <div style={{ fontSize: 22, fontWeight: 600 }}>
                {fmtMoney(precio?.coseguro)}
              </div>
            </div>
            <div
              className="kpi-card"
              style={{
                border: "1px solid #eee",
                borderRadius: 10,
                padding: 12,
              }}
            >
              <div style={{ fontSize: 12, color: "#666" }}>
                Colaterales (J38)
              </div>
              <div style={{ fontSize: 22, fontWeight: 600 }}>
                {fmtMoney(precio?.colaterales)}
              </div>
            </div>
            <div
              className="kpi-card"
              style={{
                border: "1px solid #eee",
                borderRadius: 10,
                padding: 12,
              }}
            >
              <div style={{ fontSize: 12, color: "#666" }}>Total</div>
              <div style={{ fontSize: 22, fontWeight: 600 }}>
                {fmtMoney(precio?.total)}
              </div>
            </div>
          </section>

          {/* Colaterales */}
          <section className="card" style={{ padding: 16 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <h3 style={{ margin: 0 }}>Colaterales</h3>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => void refrescarPrecio()}
                  disabled={busy}
                >
                  Recalcular
                </button>
                <button
                  className="btn btn-primary"
                  onClick={abrirNuevoColat}
                  disabled={cfg.estado !== "activo" || busy}
                >
                  Agregar colateral
                </button>
              </div>
            </div>

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
                    <th style={{ padding: 8 }}>Nombre</th>
                    <th style={{ padding: 8 }}>DNI</th>
                    <th style={{ padding: 8 }}>Fecha Nac.</th>
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
                  {colaterales.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: 12, color: "#666" }}>
                        Sin colaterales
                      </td>
                    </tr>
                  ) : (
                    colaterales.map((c) => {
                      const participaJ38 = c.esColateral ?? true;
                      const parentesco =
                        c.parentescoNombre ??
                        parentescos.find(
                          (p) => String(p.id) === String(c.parentescoId)
                        )?.nombre ??
                        c.parentescoId;

                      return (
                        <tr
                          key={String(c.id)}
                          style={{ borderTop: "1px solid #eee" }}
                        >
                          <td style={{ padding: 8 }}>{parentesco}</td>
                          <td style={{ padding: 8 }}>{c.nombre}</td>
                          <td style={{ padding: 8 }}>
                            {(c.dni ?? "").toString() || "—"}
                          </td>
                          <td style={{ padding: 8 }}>
                            {toISODate(c.fechaNacimiento) || "—"}
                          </td>
                          <td
                            style={{ padding: 8 }}
                            className="table-col-center"
                          >
                            <span
                              className={`feature-badge ${
                                participaJ38 ? "feature-yes" : "feature-no"
                              }`}
                            >
                              {participaJ38 ? "Sí" : "No"}
                            </span>
                          </td>
                          <td
                            style={{ padding: 8 }}
                            className="table-col-center"
                          >
                            <span
                              className={`feature-badge ${
                                c.activo ? "feature-yes" : "feature-no"
                              }`}
                            >
                              {c.activo ? "Sí" : "No"}
                            </span>
                          </td>
                          <td
                            style={{ padding: 8 }}
                            className="table-col-center"
                          >
                            <div
                              className="btn-group"
                              style={{ display: "inline-flex", gap: 8 }}
                            >
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => abrirEditarColat(c)}
                                disabled={busy}
                              >
                                Editar
                              </button>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => void eliminarColat(c.id)}
                                disabled={busy}
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
          </section>
        </div>
      )}

      {/* ===== Modal Alta/Edición de Colateral ===== */}
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
              {editColat.isNew ? "Agregar colateral" : "Editar colateral"}
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
              {/* Parentesco */}
              <div>
                <label
                  className="filter-label"
                  style={{ display: "block", fontSize: 12, color: "#666" }}
                >
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

              {/* Nombre */}
              <div>
                <label
                  className="filter-label"
                  style={{ display: "block", fontSize: 12, color: "#666" }}
                >
                  Nombre
                </label>
                <input
                  className="filter-select"
                  placeholder="Nombre y apellido"
                  value={editColat.row?.nombre ?? ""}
                  onChange={(e) =>
                    setEditColat((s) => ({
                      ...s,
                      row: { ...s.row, nombre: e.target.value },
                    }))
                  }
                />
              </div>

              {/* DNI */}
              <div>
                <label
                  className="filter-label"
                  style={{ display: "block", fontSize: 12, color: "#666" }}
                >
                  DNI
                </label>
                <input
                  className="filter-select"
                  placeholder="Documento (opcional)"
                  maxLength={20}
                  value={editColat.row?.dni ?? ""}
                  onChange={(e) =>
                    setEditColat((s) => ({
                      ...s,
                      row: { ...s.row, dni: e.target.value },
                    }))
                  }
                />
                <div style={{ fontSize: 11, color: "#999", marginTop: 4 }}>
                  Si lo informás, no puede repetirse dentro del grupo familiar
                  del afiliado.
                </div>
              </div>

              {/* Fecha de nacimiento */}
              <div>
                <label
                  className="filter-label"
                  style={{ display: "block", fontSize: 12, color: "#666" }}
                >
                  Fecha de nacimiento
                </label>
                <input
                  type="date"
                  className="filter-select"
                  value={toISODate(editColat.row?.fechaNacimiento ?? "")}
                  onChange={(e) =>
                    setEditColat((s) => ({
                      ...s,
                      row: { ...s.row, fechaNacimiento: e.target.value },
                    }))
                  }
                />
              </div>

              {/* Participa J38 + Activo */}
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                <label
                  className="checkbox-label"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={editColat.row?.esColateral ?? true}
                    onChange={(e) =>
                      setEditColat((s) => ({
                        ...s,
                        row: { ...s.row, esColateral: e.target.checked },
                      }))
                    }
                  />
                  <span>Participa en J38</span>
                </label>

                <label
                  className="checkbox-label"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!!editColat.row?.activo}
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
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                marginTop: 16,
              }}
            >
              <button
                className="btn btn-secondary"
                onClick={cerrarModalColat}
                disabled={busy}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={() => void guardarColat()}
                disabled={busy}
              >
                {busy
                  ? "Guardando..."
                  : editColat.isNew
                  ? "Agregar"
                  : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
