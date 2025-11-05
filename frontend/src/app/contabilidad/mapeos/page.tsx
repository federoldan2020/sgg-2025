/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import { api, getErrorMessage } from "@/servicios/api";
import AutocompleteCuenta from "@/components/AutocompleteCuenta";

type Mapeo = {
  id: string;
  origen: string;
  conceptoCodigo?: string | null;
  metodoPago?: string | null;
  debeCodigo: string;
  haberCodigo: string;
  descripcion?: string | null;
  activo: boolean;
};

type Paginado<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
};

const ORIGENES = [
  "comprobante_tercero",
  "orden_pago_tercero",
  "pago_caja",
  "cierre_caja",
] as const;

const ROLES = [
  "(genérico)",
  "PROVEEDOR",
  "PRESTADOR",
  "AFILIADO",
  "OTRO",
] as const;

const PRESETS: Record<(typeof ORIGENES)[number], string[]> = {
  comprobante_tercero: [
    "neto",
    "iva",
    "exento",
    "no_gravado",
    "percep_iva",
    "ret_iva",
    "ret_gan",
    "percep_iibb",
    "ret_iibb",
    "imp_municipal",
    "imp_interno",
    "gasto_admin",
    "otros",
    "cxp",
  ],
  orden_pago_tercero: [
    "cxp",
    "mp_efectivo",
    "mp_transferencia",
    "mp_cheque",
    "mp_otro",
  ],
  pago_caja: ["ingreso", "egreso"],
  cierre_caja: ["sobrante", "faltante"],
};

export default function MapeosPage() {
  // Filtros/paginado
  const [q, setQ] = useState("");
  const [origenFilter, setOrigenFilter] = useState<
    (typeof ORIGENES)[number] | ""
  >("");
  const [activoFilter, setActivoFilter] = useState<"" | "true" | "false">("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Listado
  const [lista, setLista] = useState<Paginado<Mapeo>>({
    items: [],
    total: 0,
    page: 1,
    pageSize: 20,
    pages: 1,
  });
  const [loadingList, setLoadingList] = useState(false);

  // Alta rápida
  const [origen, setOrigen] = useState<(typeof ORIGENES)[number]>(
    "comprobante_tercero"
  );
  const [presetConcepto, setPresetConcepto] = useState("");
  const [rolSuffix, setRolSuffix] =
    useState<(typeof ROLES)[number]>("(genérico)");
  const [conceptoManual, setConceptoManual] = useState("");
  const [metodo, setMetodo] = useState("");
  const [debe, setDebe] = useState("");
  const [haber, setHaber] = useState("");
  const [desc, setDesc] = useState("");

  // Edición inline
  const [editId, setEditId] = useState<string | null>(null);
  const [editDebe, setEditDebe] = useState("");
  const [editHaber, setEditHaber] = useState("");
  const [editDesc, setEditDesc] = useState("");

  // Asistente presets (intuitivo para contador)
  const [asistRol, setAsistRol] =
    useState<(typeof ROLES)[number]>("(genérico)");
  const [cuentaPuente, setCuentaPuente] = useState("19999.000");
  const [cuentaCxP, setCuentaCxP] = useState("21101.000");
  const [ctaGasto, setCtaGasto] = useState("51101.000");
  const [ctaIVACred, setCtaIVACred] = useState("11109.000");
  const [ctaExento, setCtaExento] = useState("51101.000");
  const [ctaNoGrav, setCtaNoGrav] = useState("51101.000");
  const [ctaOtros, setCtaOtros] = useState("51900.000");
  const [ctaGastoAdm, setCtaGastoAdm] = useState("51910.000");
  const [ctaImpInt, setCtaImpInt] = useState("51920.000");
  const [ctaImpMun, setCtaImpMun] = useState("51930.000");
  const [ctaPercepIVA, setCtaPercepIVA] = useState("11110.000");
  const [ctaRetIVA, setCtaRetIVA] = useState("21110.000");
  const [ctaRetGan, setCtaRetGan] = useState("21111.000");
  const [ctaPercepIIBB, setCtaPercepIIBB] = useState("11111.000");
  const [ctaRetIIBB, setCtaRetIIBB] = useState("21112.000");
  const [ctaEfvo, setCtaEfvo] = useState("10101.001");
  const [ctaTransf, setCtaTransf] = useState("11201.000");
  const [ctaCheque, setCtaCheque] = useState("11301.000");
  const [ctaOtroMP, setCtaOtroMP] = useState("11999.000");

  const [msg, setMsg] = useState<string | null>(null);

  const conceptoConstruido = useMemo(() => {
    const base = (presetConcepto || conceptoManual).trim();
    if (!base) return null;
    const r = rolSuffix !== "(genérico)" ? rolSuffix : "";
    return r ? `${base}_${r}` : base;
  }, [presetConcepto, conceptoManual, rolSuffix]);

  const cargar = async () => {
    try {
      setLoadingList(true);
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (origenFilter) params.set("origen", origenFilter);
      if (activoFilter) params.set("activo", activoFilter);
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      const data = await api<Paginado<Mapeo>>(
        `/contabilidad/mapeos?${params.toString()}`
      );
      setLista(data);
      setMsg(null);
    } catch (e) {
      setMsg(getErrorMessage(e));
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    void cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, origenFilter, activoFilter, page, pageSize]);

  const crear = async () => {
    try {
      if (!debe.trim() || !haber.trim()) {
        throw new Error("Debe y Haber son obligatorios.");
      }
      await api("/contabilidad/mapeos/create", {
        method: "POST",
        body: JSON.stringify({
          origen,
          conceptoCodigo: conceptoConstruido,
          metodoPago: metodo.trim() || null,
          debeCodigo: debe.trim(),
          haberCodigo: haber.trim(),
          descripcion: desc.trim() || null,
        }),
      });
      setPresetConcepto("");
      setRolSuffix("(genérico)");
      setConceptoManual("");
      setMetodo("");
      setDebe("");
      setHaber("");
      setDesc("");
      setPage(1);
      await cargar();
      setMsg("Mapeo creado.");
    } catch (e) {
      setMsg(getErrorMessage(e));
    }
  };

  const toggle = async (id: string, activo: boolean) => {
    try {
      await api(`/contabilidad/mapeos/${id}/toggle`, {
        method: "PATCH",
        body: JSON.stringify({ activo: !activo }),
      });
      await cargar();
    } catch (e) {
      setMsg(getErrorMessage(e));
    }
  };

  const eliminar = async (id: string) => {
    if (!confirm("¿Eliminar mapeo?")) return;
    try {
      await api(`/contabilidad/mapeos/${id}`, { method: "DELETE" });
      await cargar();
      setMsg("Mapeo eliminado.");
    } catch (e) {
      setMsg(getErrorMessage(e));
    }
  };

  const comenzarEditar = (m: Mapeo) => {
    setEditId(m.id);
    setEditDebe(m.debeCodigo);
    setEditHaber(m.haberCodigo);
    setEditDesc(m.descripcion ?? "");
  };

  const guardarEdicion = async () => {
    if (!editId) return;
    try {
      await api(`/contabilidad/mapeos/${editId}`, {
        method: "PUT",
        body: JSON.stringify({
          debeCodigo: editDebe.trim(),
          haberCodigo: editHaber.trim(),
          descripcion: editDesc.trim() || null,
        }),
      });
      setEditId(null);
      await cargar();
      setMsg("Mapeo actualizado.");
    } catch (e) {
      setMsg(getErrorMessage(e));
    }
  };

  const crearPresetsTerceros = async () => {
    try {
      const rol = asistRol !== "(genérico)" ? asistRol : null;
      await api("/contabilidad/mapeos/seed-terceros", {
        method: "POST",
        body: JSON.stringify({
          rol,
          cuentas: {
            puente: cuentaPuente,
            cxp: cuentaCxP,
            gasto: ctaGasto,
            ivaCredito: ctaIVACred,
            exento: ctaExento,
            noGravado: ctaNoGrav,
            otros: ctaOtros,
            gastoAdmin: ctaGastoAdm,
            impInterno: ctaImpInt,
            impMunicipal: ctaImpMun,
            percepIVA: ctaPercepIVA,
            retIVA: ctaRetIVA,
            retGan: ctaRetGan,
            percepIIBB: ctaPercepIIBB,
            retIIBB: ctaRetIIBB,
            mp_efectivo: ctaEfvo,
            mp_transferencia: ctaTransf,
            mp_cheque: ctaCheque,
            mp_otro: ctaOtroMP,
          },
        }),
      });
      await cargar();
      setMsg("Presets creados para terceros/OP.");
    } catch (e) {
      setMsg(getErrorMessage(e));
    }
  };

  const Hint = ({ children }: { children: React.ReactNode }) => (
    <div style={{ fontSize: 12, opacity: 0.85, lineHeight: 1.35 }}>
      {children}
    </div>
  );

  return (
    <main style={{ padding: 24, display: "grid", gap: 16, maxWidth: 1200 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h1 style={{ margin: 0 }}>Mapeos contables</h1>
      </header>

      {/* Asistente para contador: presets por terceros */}
      <section
        style={{
          border: "1px solid #e9e9e9",
          borderRadius: 12,
          padding: 12,
          display: "grid",
          gap: 10,
        }}
      >
        <h3 style={{ margin: 0 }}>Asistente (Terceros)</h3>
        <Hint>
          Para <b>comprobantes de terceros</b>: cada componente (neto, IVA,
          exento, etc.) debita su cuenta y acredita <code>puente</code>. Además
          se crea una línea <b>CxP</b>
          que debita <code>puente</code> y acredita <code>CxP</code> por el
          total. Para <b>órdenes de pago</b>: se debita <code>CxP</code> por lo
          aplicado y se acredita el medio de pago (efectivo/banco/cheque),
          usando la misma <code>puente</code>.
        </Hint>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr 1fr",
            gap: 8,
          }}
        >
          <div>
            <label>Rol (sufijo opcional)</label>
            <select
              value={asistRol}
              onChange={(e) => setAsistRol(e.target.value as any)}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Puente</label>
            <input
              value={cuentaPuente}
              onChange={(e) => setCuentaPuente(e.target.value)}
            />
            <Hint>Cuenta puente para cuadrar (misma en comp/OP)</Hint>
          </div>
          <div>
            <label>CxP</label>
            <input
              value={cuentaCxP}
              onChange={(e) => setCuentaCxP(e.target.value)}
            />
          </div>
          <div>
            <label>Gasto/Neto</label>
            <input
              value={ctaGasto}
              onChange={(e) => setCtaGasto(e.target.value)}
            />
          </div>

          <div>
            <label>IVA Crédito</label>
            <input
              value={ctaIVACred}
              onChange={(e) => setCtaIVACred(e.target.value)}
            />
          </div>
          <div>
            <label>Exento</label>
            <input
              value={ctaExento}
              onChange={(e) => setCtaExento(e.target.value)}
            />
          </div>
          <div>
            <label>No Gravado</label>
            <input
              value={ctaNoGrav}
              onChange={(e) => setCtaNoGrav(e.target.value)}
            />
          </div>
          <div>
            <label>Otros Imp.</label>
            <input
              value={ctaOtros}
              onChange={(e) => setCtaOtros(e.target.value)}
            />
          </div>

          <div>
            <label>Gasto Admin</label>
            <input
              value={ctaGastoAdm}
              onChange={(e) => setCtaGastoAdm(e.target.value)}
            />
          </div>
          <div>
            <label>Imp. Interno</label>
            <input
              value={ctaImpInt}
              onChange={(e) => setCtaImpInt(e.target.value)}
            />
          </div>
          <div>
            <label>Imp. Municipal</label>
            <input
              value={ctaImpMun}
              onChange={(e) => setCtaImpMun(e.target.value)}
            />
          </div>
          <div>
            <label>Percep. IVA</label>
            <input
              value={ctaPercepIVA}
              onChange={(e) => setCtaPercepIVA(e.target.value)}
            />
          </div>

          <div>
            <label>Ret. IVA</label>
            <input
              value={ctaRetIVA}
              onChange={(e) => setCtaRetIVA(e.target.value)}
            />
          </div>
          <div>
            <label>Ret. Ganancias</label>
            <input
              value={ctaRetGan}
              onChange={(e) => setCtaRetGan(e.target.value)}
            />
          </div>
          <div>
            <label>Percep. IIBB</label>
            <input
              value={ctaPercepIIBB}
              onChange={(e) => setCtaPercepIIBB(e.target.value)}
            />
          </div>
          <div>
            <label>Ret. IIBB</label>
            <input
              value={ctaRetIIBB}
              onChange={(e) => setCtaRetIIBB(e.target.value)}
            />
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4,1fr)",
            gap: 8,
          }}
        >
          <div>
            <label>Medio: Efectivo</label>
            <input
              value={ctaEfvo}
              onChange={(e) => setCtaEfvo(e.target.value)}
            />
          </div>
          <div>
            <label>Medio: Transferencia</label>
            <input
              value={ctaTransf}
              onChange={(e) => setCtaTransf(e.target.value)}
            />
          </div>
          <div>
            <label>Medio: Cheque</label>
            <input
              value={ctaCheque}
              onChange={(e) => setCtaCheque(e.target.value)}
            />
          </div>
          <div>
            <label>Medio: Otro</label>
            <input
              value={ctaOtroMP}
              onChange={(e) => setCtaOtroMP(e.target.value)}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={crearPresetsTerceros}>
            Crear presets para terceros/OP
          </button>
          <button
            onClick={async () => {
              try {
                await api("/contabilidad/mapeos/seed-cierre", {
                  method: "POST",
                });
                await cargar();
                setMsg("Seed de mapeos de cierre (efectivo) aplicado.");
              } catch (e) {
                setMsg(getErrorMessage(e));
              }
            }}
          >
            Seed cierre (efectivo)
          </button>
        </div>
      </section>

      {/* Alta manual rápida */}
      <section
        style={{
          display: "grid",
          gap: 10,
          border: "1px solid #eee",
          borderRadius: 12,
          padding: 12,
        }}
      >
        <h3 style={{ margin: 0 }}>Nuevo mapeo (manual)</h3>
        <div
          style={{
            display: "grid",
            gap: 8,
            gridTemplateColumns: "1fr 1fr 1fr 2fr 2fr 2fr",
            alignItems: "end",
          }}
        >
          <div>
            <label>Origen</label>
            <select
              value={origen}
              onChange={(e) => {
                setOrigen(e.target.value as any);
                setPresetConcepto("");
                setRolSuffix("(genérico)");
              }}
            >
              {ORIGENES.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label>Concepto</label>
            <div style={{ display: "grid", gap: 6 }}>
              <select
                value={presetConcepto}
                onChange={(e) => {
                  setPresetConcepto(e.target.value);
                  setConceptoManual("");
                }}
              >
                <option value="">(manual)</option>
                {PRESETS[origen].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <input
                placeholder="Si elegís manual, escribí aquí"
                value={conceptoManual}
                onChange={(e) => {
                  setPresetConcepto("");
                  setConceptoManual(e.target.value);
                }}
              />
            </div>
          </div>

          <div>
            <label>Rol (sufijo)</label>
            <select
              value={rolSuffix}
              onChange={(e) => setRolSuffix(e.target.value as any)}
              title="Si elegís un rol, se guardará como concepto_ROL (ej. neto_PROVEEDOR)"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <AutocompleteCuenta
            label="Debe (cuenta código)"
            value={debe}
            onChange={setDebe}
          />
          <AutocompleteCuenta
            label="Haber (cuenta código)"
            value={haber}
            onChange={setHaber}
          />
          <div>
            <label>Método (opcional)</label>
            <input
              value={metodo}
              onChange={(e) => setMetodo(e.target.value)}
              placeholder="efectivo / transferencia / cheque / mp"
            />
          </div>
        </div>

        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 4fr", gap: 8 }}
        >
          <div>
            <label>Descripción (opcional)</label>
            <input value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ opacity: 0.8 }}>
              Guardará concepto:&nbsp;
              <code>{conceptoConstruido ?? "— (completá concepto)"}</code>
            </span>
            <button onClick={crear} disabled={!debe.trim() || !haber.trim()}>
              Guardar
            </button>
          </div>
        </div>
      </section>

      {/* Listado con filtros/paginación/edición */}
      <section
        style={{
          border: "1px solid #eee",
          borderRadius: 12,
          padding: 12,
          overflowX: "auto",
        }}
      >
        {/* Filtros */}
        <div
          style={{
            display: "grid",
            gap: 8,
            gridTemplateColumns: "1fr 220px 180px 120px 120px",
            alignItems: "end",
            marginBottom: 8,
          }}
        >
          <div>
            <label>Búsqueda</label>
            <input
              value={q}
              onChange={(e) => {
                setPage(1);
                setQ(e.target.value);
              }}
              placeholder="texto libre (cuentas, descripción, origen, método...)"
            />
          </div>
          <div>
            <label>Origen</label>
            <select
              value={origenFilter}
              onChange={(e) => {
                setPage(1);
                setOrigenFilter(e.target.value as any);
              }}
            >
              <option value="">(todos)</option>
              {ORIGENES.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Estado</label>
            <select
              value={activoFilter}
              onChange={(e) => {
                setPage(1);
                setActivoFilter(e.target.value as any);
              }}
            >
              <option value="">(todos)</option>
              <option value="true">Activos</option>
              <option value="false">Inactivos</option>
            </select>
          </div>
          <div>
            <label>Page</label>
            <input
              type="number"
              min={1}
              value={page}
              onChange={(e) =>
                setPage(Math.max(1, Number(e.target.value || "1")))
              }
            />
          </div>
          <div>
            <label>Page size</label>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Origen</th>
              <th style={{ textAlign: "left" }}>Concepto</th>
              <th style={{ textAlign: "left" }}>Método</th>
              <th style={{ textAlign: "left" }}>Debe</th>
              <th style={{ textAlign: "left" }}>Haber</th>
              <th style={{ textAlign: "left" }}>Descripción</th>
              <th style={{ textAlign: "left" }}>Estado</th>
              <th style={{ textAlign: "left" }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loadingList ? (
              <tr>
                <td colSpan={8} style={{ padding: 12 }}>
                  Cargando…
                </td>
              </tr>
            ) : lista.items.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 12 }}>
                  Sin resultados.
                </td>
              </tr>
            ) : (
              lista.items.map((m) => (
                <tr key={m.id} style={{ borderTop: "1px solid #eee" }}>
                  <td>{m.origen}</td>
                  <td>{m.conceptoCodigo ?? "—"}</td>
                  <td>{m.metodoPago ?? "—"}</td>
                  <td>
                    {editId === m.id ? (
                      <AutocompleteCuenta
                        label=""
                        value={editDebe}
                        onChange={setEditDebe}
                      />
                    ) : (
                      <code>{m.debeCodigo}</code>
                    )}
                  </td>
                  <td>
                    {editId === m.id ? (
                      <AutocompleteCuenta
                        label=""
                        value={editHaber}
                        onChange={setEditHaber}
                      />
                    ) : (
                      <code>{m.haberCodigo}</code>
                    )}
                  </td>
                  <td>
                    {editId === m.id ? (
                      <input
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                      />
                    ) : m.descripcion ? (
                      <span>{m.descripcion}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    <span
                      style={{
                        padding: "2px 6px",
                        borderRadius: 6,
                        background: m.activo ? "#e6ffe6" : "#f7f7f7",
                        border: "1px solid #e0e0e0",
                      }}
                    >
                      {m.activo ? "activo" : "inactivo"}
                    </span>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {editId === m.id ? (
                      <>
                        <button onClick={guardarEdicion}>Guardar</button>
                        <button
                          style={{ marginLeft: 6 }}
                          onClick={() => setEditId(null)}
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => comenzarEditar(m)}>
                          Editar
                        </button>
                        <button
                          style={{ marginLeft: 6 }}
                          onClick={() => toggle(m.id, m.activo)}
                        >
                          {m.activo ? "Desactivar" : "Activar"}
                        </button>
                        <button
                          style={{ marginLeft: 6, color: "crimson" }}
                          onClick={() => eliminar(m.id)}
                        >
                          Eliminar
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            justifyContent: "flex-end",
            marginTop: 8,
          }}
        >
          <span style={{ opacity: 0.7 }}>
            {lista.total} resultado{lista.total === 1 ? "" : "s"}
          </span>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            ←
          </button>
          <span>
            {page} / {lista.pages || 1}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(lista.pages || 1, p + 1))}
            disabled={page >= (lista.pages || 1)}
          >
            →
          </button>
        </div>
      </section>

      {msg && (
        <p
          style={{
            color: msg.toLowerCase().includes("error") ? "crimson" : "#127d2b",
          }}
        >
          {msg}
        </p>
      )}
    </main>
  );
}
