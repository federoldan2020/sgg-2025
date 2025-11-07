/* eslint-disable @next/next/no-html-link-for-pages */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, getErrorMessage } from "@/servicios/api";

type Rol = "PROVEEDOR" | "PRESTADOR" | "AFILIADO" | "OTRO";
type TipoContacto = "EMAIL" | "TELEFONO" | "WHATSAPP" | "WEB" | "OTRO";
type TipoCuentaBancaria = "CBU" | "ALIAS" | "CVU" | "CCI" | "OTRO";

type TerceroView = {
  id: string;
  nombre: string;
  fantasia?: string | null;
  codigo?: string | null;
  cuit?: string | null;
  iibb?: string | null;
  condIva?:
    | "INSCRIPTO"
    | "MONOTRIBUTO"
    | "EXENTO"
    | "CONSUMIDOR_FINAL"
    | "NO_RESPONSABLE"
    | null;
  tipoPersona?: "FISICA" | "JURIDICA" | "OTRO" | null;
  activo: boolean;
  notas?: string | null;
  roles: { rol: Rol }[];
  direcciones: Array<{
    id: string;
    etiqueta?: string | null;
    calle?: string | null;
    numero?: string | null;
    piso?: string | null;
    dpto?: string | null;
    ciudad?: string | null;
    provincia?: string | null;
    cp?: string | null;
    pais?: string | null;
    principal: boolean;
  }>;
  contactos: Array<{
    id: string;
    tipo: TipoContacto;
    valor: string;
    etiqueta?: string | null;
    principal: boolean;
  }>;
  bancos: Array<{
    id: string;
    banco?: string | null;
    tipo: TipoCuentaBancaria;
    numero: string;
    titular?: string | null;
    cuitTitular?: string | null;
  }>;
};

type CuentaLite = {
  id: string;
  rol: Rol;
  activo: boolean;
  saldoInicial?: number | null;
  saldoActual?: number | null;
};

const fmtMoney = (n?: number | null) =>
  Number(n ?? 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  });

export default function TerceroViewPage() {
  const router = useRouter();
  const { tercerosId } = useParams<{ tercerosId: string }>();
  const id = tercerosId;

  const [data, setData] = useState<TerceroView | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // cuentas
  const [cuentas, setCuentas] = useState<CuentaLite[] | null>(null);
  const [loadingCtas, setLoadingCtas] = useState(false);

  const hasRole = useMemo(() => {
    const set = new Set((data?.roles ?? []).map((r) => r.rol));
    return (r: Rol) => set.has(r);
  }, [data]);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setMsg(null);
    try {
      const r = await api<TerceroView>(
        `/terceros/by-id/${encodeURIComponent(id)}`
      );
      setData(r);
    } catch (e) {
      setMsg(getErrorMessage(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const loadCuentas = async () => {
    if (!data?.id) return;
    setLoadingCtas(true);
    setMsg(null);
    try {
      const res = await api<{
        tercero: { id: string; nombre: string };
        cuentas: CuentaLite[];
      }>(
        `/cuentas-tercero/por-tercero?terceroId=${encodeURIComponent(data.id)}`
      );
      setCuentas(res.cuentas ?? []);
    } catch (e) {
      setMsg(getErrorMessage(e));
    } finally {
      setLoadingCtas(false);
    }
  };

  const toggleActivo = async () => {
    if (!data) return;
    try {
      await api(`/terceros/by-id/${encodeURIComponent(data.id)}/toggle`, {
        method: "PATCH",
        body: JSON.stringify({ activo: !data.activo }),
      });
      await load();
    } catch (e) {
      alert(getErrorMessage(e));
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div className="page-title-section">
          <div className="breadcrumb-nav">
            <button
              onClick={() => router.back()}
              className="back-button"
              title="Volver"
            >
              ← Volver
            </button>
            <span style={{ opacity: 0.5, margin: "0 8px" }}>/</span>
            <Link href="/terceros" className="breadcrumb-link">
              Terceros
            </Link>
          </div>
          <h1 className="page-title">{data ? data.nombre : "Tercero"}</h1>
          <p className="page-subtitle">
            {data?.fantasia ? `(${data.fantasia})` : null}
          </p>
        </div>
        <div className="page-actions" style={{ display: "flex", gap: 8 }}>
          {data && (
            <>
              <a
                className="btn btn-secondary"
                href={`/terceros/${data.id}`}
                title="Editar"
              >
                Editar
              </a>
              <button
                className={`btn ${data.activo ? "btn-danger" : "btn-primary"}`}
                onClick={toggleActivo}
              >
                {data.activo ? "Desactivar" : "Activar"}
              </button>
            </>
          )}
        </div>
      </div>

      {msg && (
        <div className="alert alert-error">
          <div className="alert-content">
            <div className="alert-text">{msg}</div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading-state">Cargando…</div>
      ) : !data ? (
        <div className="empty-state">
          <div className="empty-state-title">No encontrado</div>
          <div className="empty-state-text">
            El tercero no existe o no es accesible.
          </div>
        </div>
      ) : (
        <div className="page-content" style={{ display: "grid", gap: 16 }}>
          {/* Resumen */}
          <section className="card">
            <div className="card-body">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr 1fr 1fr",
                  gap: 12,
                }}
              >
                <div>
                  <div className="muted">CUIT</div>
                  <div>{data.cuit || "—"}</div>
                </div>
                <div>
                  <div className="muted">Condición IVA</div>
                  <div>{data.condIva || "—"}</div>
                </div>
                <div>
                  <div className="muted">Tipo de persona</div>
                  <div>{data.tipoPersona || "—"}</div>
                </div>
                <div>
                  <div className="muted">Estado</div>
                  <div>
                    <span
                      className={`estado-badge ${
                        data.activo ? "estado-activo" : "estado-inactivo"
                      }`}
                    >
                      {data.activo ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <div className="muted">Roles</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {(data.roles ?? []).map((r, i) => (
                    <span
                      key={i}
                      className={`rol-badge ${
                        r.rol === "PROVEEDOR"
                          ? "rol-proveedor"
                          : r.rol === "PRESTADOR"
                          ? "rol-prestador"
                          : r.rol === "AFILIADO"
                          ? "rol-afiliado"
                          : "rol-otro"
                      }`}
                    >
                      {r.rol}
                    </span>
                  ))}
                </div>
              </div>

              {data.codigo && (
                <div style={{ marginTop: 12 }}>
                  <div className="muted">Código</div>
                  <div>
                    <code>{data.codigo}</code>
                  </div>
                </div>
              )}

              {data.notas && (
                <div style={{ marginTop: 12 }}>
                  <div className="muted">Notas</div>
                  <div style={{ whiteSpace: "pre-wrap" }}>{data.notas}</div>
                </div>
              )}
            </div>
          </section>

          {/* Cuentas */}
          <section className="card">
            <div
              className="card-header"
              style={{ display: "flex", justifyContent: "space-between" }}
            >
              <h2 className="card-title">Cuentas</h2>
              <button
                className="btn btn-secondary"
                onClick={() => void loadCuentas()}
              >
                {loadingCtas ? "Cargando…" : "Actualizar"}
              </button>
            </div>
            <div className="card-body">
              {loadingCtas ? (
                <div className="loading-state">Cargando cuentas…</div>
              ) : !cuentas ? (
                <div className="muted">
                  Pulsa “Actualizar” para ver las cuentas del tercero.
                </div>
              ) : cuentas.length === 0 ? (
                <div className="empty-state small">
                  <div className="empty-state-text">
                    Sin cuentas para este tercero.
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))",
                    gap: 12,
                  }}
                >
                  {cuentas.map((c) => (
                    <a
                      key={c.id}
                      href={`/finanzas/cuentas/${c.id}`}
                      className="cuenta-card"
                    >
                      <div className="cuenta-header">
                        <div className="cuenta-rol">{c.rol}</div>
                        <div
                          className={`cuenta-estado ${c.activo ? "ok" : "off"}`}
                        >
                          {c.activo ? "Activa" : "Inactiva"}
                        </div>
                      </div>
                      <div className="cuenta-body">
                        <div className="cuenta-line">
                          <span>Saldo actual</span>
                          <strong>{fmtMoney(c.saldoActual)}</strong>
                        </div>
                        <div className="cuenta-line">
                          <span>Saldo inicial</span>
                          <span>{fmtMoney(c.saldoInicial)}</span>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Direcciones */}
          <section className="card">
            <div className="card-header">
              <h2 className="card-title">Direcciones</h2>
            </div>
            <div className="card-body">
              {data.direcciones.length === 0 ? (
                <div className="muted">No hay direcciones.</div>
              ) : (
                <ul className="list">
                  {data.direcciones.map((d) => (
                    <li key={d.id}>
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                        }}
                      >
                        <strong>{d.etiqueta || "—"}</strong>
                        {d.principal && (
                          <span className="badge">Principal</span>
                        )}
                      </div>
                      <div className="muted">
                        {[d.calle, d.numero].filter(Boolean).join(" ") || "—"}
                        {d.piso ? `, Piso ${d.piso}` : ""}
                        {d.dpto ? `, Dto ${d.dpto}` : ""}
                        {d.ciudad ? ` · ${d.ciudad}` : ""}
                        {d.provincia ? `, ${d.provincia}` : ""}
                        {d.cp ? ` (${d.cp})` : ""}
                        {d.pais ? ` · ${d.pais}` : ""}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* Contactos */}
          <section className="card">
            <div className="card-header">
              <h2 className="card-title">Contactos</h2>
            </div>
            <div className="card-body">
              {data.contactos.length === 0 ? (
                <div className="muted">No hay contactos.</div>
              ) : (
                <ul className="list">
                  {data.contactos.map((c) => (
                    <li
                      key={c.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <div>
                        <strong>{c.tipo.toLowerCase()}</strong>
                        {c.principal && (
                          <span className="badge" style={{ marginLeft: 8 }}>
                            Principal
                          </span>
                        )}
                        {c.etiqueta ? (
                          <span style={{ marginLeft: 8 }} className="muted">
                            ({c.etiqueta})
                          </span>
                        ) : null}
                        <div>{c.valor}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* Bancos */}
          <section className="card">
            <div className="card-header">
              <h2 className="card-title">Datos bancarios</h2>
            </div>
            <div className="card-body">
              {data.bancos.length === 0 ? (
                <div className="muted">
                  No hay cuentas bancarias registradas.
                </div>
              ) : (
                <ul className="list">
                  {data.bancos.map((b) => (
                    <li key={b.id}>
                      <div>
                        <strong>{b.tipo}</strong>
                        {b.banco ? ` · ${b.banco}` : ""}
                      </div>
                      <div className="muted">N°: {b.numero}</div>
                      {(b.titular || b.cuitTitular) && (
                        <div className="muted">
                          Titular: {b.titular || "—"}
                          {b.cuitTitular ? ` · CUIT ${b.cuitTitular}` : ""}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* Acciones inferiores */}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <a
              className="btn btn-secondary"
              href={`/terceros/${data.id}`}
              title="Editar"
            >
              Editar
            </a>
            <Link className="btn" href="/terceros">
              Volver al listado
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
