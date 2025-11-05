"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, getErrorMessage, ORG } from "@/servicios/api";

/* ===== Tipos ===== */
type RolTercero = "PROVEEDOR" | "PRESTADOR" | "AFILIADO" | "OTRO";
type TipoComprobante =
  | "FACTURA"
  | "PRESTACION"
  | "NOTA_CREDITO"
  | "NOTA_DEBITO";
type ClaseAFIP = "A" | "B" | "C" | "M" | "X" | "";

type Linea = {
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  alicuotaIVA?: number | null;
};

type ImpAdicTipo =
  | "PERCEPCION_IIBB"
  | "RETENCION_IIBB"
  | "PERCEPCION_IVA"
  | "RETENCION_IVA"
  | "IMP_MUNICIPAL"
  | "IMP_INTERNO"
  | "GASTO_ADMINISTRATIVO"
  | "OTRO";

type ImpAdic = {
  tipo: ImpAdicTipo;
  detalle?: string;
  alicuota?: number | null;
  importe: number;
};

type TerceroSearchItem = {
  id: string;
  nombre: string;
  fantasia?: string | null;
  cuit?: string | null;
  codigo?: string | null;
  activo: boolean;
  roles: RolTercero[];
};

/* ===== Helpers ===== */
const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);

function useDebounced<T>(value: T, delay = 300) {
  const [deb, setDeb] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDeb(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return deb;
}

/* ===== Page ===== */
export default function NuevoComprobantePage() {
  const API = process.env.NEXT_PUBLIC_API_URL;

  // Cabecera
  const [organizacionId, setOrg] = useState(ORG);
  const [rol, setRol] = useState<RolTercero>("PROVEEDOR");
  const [terceroSel, setTerceroSel] = useState<TerceroSearchItem | null>(null);

  const [tipo, setTipo] = useState<TipoComprobante>("FACTURA");
  const [clase, setClase] = useState<ClaseAFIP>("");
  const [puntoVenta, setPV] = useState<number | "">("");
  const [numero, setNumero] = useState<number | "">("");
  const [fecha, setFecha] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [vencimiento, setVenc] = useState<string>("");
  const [moneda, setMoneda] = useState("ARS");
  const [cuitEmisor, setCuitEmisor] = useState<string>("");
  const [observaciones, setObs] = useState<string>("");

  // Líneas + impuestos
  const [lineas, setLineas] = useState<Linea[]>([
    {
      descripcion: "Item 1",
      cantidad: 1,
      precioUnitario: 10000,
      alicuotaIVA: 21,
    },
  ]);
  const [impuestos, setImpuestos] = useState<ImpAdic[]>([]);

  // Estado
  const [posting, setPosting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  /* ===== Autocomplete Terceros ===== */
  const [q, setQ] = useState("");
  const debQ = useDebounced(q, 300);
  const [items, setItems] = useState<TerceroSearchItem[]>([]);
  const [open, setOpen] = useState(false);
  const acWrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const fetchIt = async () => {
      const term = debQ.trim();
      if (!term) {
        setItems([]);
        return;
      }
      try {
        const url = `/terceros/buscar?q=${encodeURIComponent(term)}${
          rol ? `&rol=${encodeURIComponent(rol)}` : ""
        }&limit=20`;
        const rows = await api<TerceroSearchItem[]>(url);
        setItems(rows);
      } catch {
        // Silencioso para no molestar al usuario
      }
    };
    void fetchIt();
  }, [debQ, rol]);

  // Cerrar dropdown al hacer click afuera
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!acWrapRef.current) return;
      if (!acWrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const onAutoKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") setOpen(false);
  };

  const pick = (t: TerceroSearchItem) => {
    setTerceroSel(t);
    setQ(`${t.nombre}${t.cuit ? " · " + t.cuit : ""}`);
    setOpen(false);

    // autoadaptar rol si no coincide
    if (!t.roles.includes(rol)) {
      const nuevo = t.roles[0] ?? "OTRO";
      setRol(nuevo);
      setMsg(`El tercero no tiene rol ${rol}. Se usará el rol ${nuevo}.`);
    } else {
      setMsg(null);
    }
  };

  const limpiarTercero = () => {
    setTerceroSel(null);
    setQ("");
  };

  /* ===== Líneas / Impuestos ===== */
  const addLinea = () =>
    setLineas((x) => [
      ...x,
      { descripcion: "", cantidad: 1, precioUnitario: 0, alicuotaIVA: 21 },
    ]);
  const delLinea = (i: number) =>
    setLineas((x) => x.filter((_, idx) => idx !== i));
  const updLinea = (i: number, patch: Partial<Linea>) =>
    setLineas((x) =>
      x.map((row, idx) => (idx === i ? { ...row, ...patch } : row))
    );

  const addImp = () =>
    setImpuestos((x) => [...x, { tipo: "GASTO_ADMINISTRATIVO", importe: 0 }]);
  const delImp = (i: number) =>
    setImpuestos((x) => x.filter((_, idx) => idx !== i));
  const updImp = (i: number, patch: Partial<ImpAdic>) =>
    setImpuestos((x) =>
      x.map((row, idx) => (idx === i ? { ...row, ...patch } : row))
    );

  /* ===== Totales ===== */
  const totales = useMemo(() => {
    let netoGrav21 = 0,
      netoGrav105 = 0,
      netoGrav27 = 0,
      netoNoGrav = 0,
      netoExento = 0,
      iva21 = 0,
      iva105 = 0,
      iva27 = 0;

    for (const l of lineas) {
      const cant = Number(l.cantidad || 0);
      const pu = Number(l.precioUnitario || 0);
      const base = cant * pu;
      const ali = l.alicuotaIVA ?? null;

      if (ali == null) {
        netoNoGrav += base;
      } else if (ali === 0) {
        netoExento += base;
      } else if (ali === 21) {
        netoGrav21 += base;
        iva21 += base * 0.21;
      } else if (ali === 10.5) {
        netoGrav105 += base;
        iva105 += base * 0.105;
      } else if (ali === 27) {
        netoGrav27 += base;
        iva27 += base * 0.27;
      } else {
        netoNoGrav += base;
      }
    }

    const otros = impuestos.reduce(
      (acc, it) => acc + Number(it.importe || 0),
      0
    );

    const total =
      netoGrav21 +
      netoGrav105 +
      netoGrav27 +
      netoNoGrav +
      netoExento +
      iva21 +
      iva105 +
      iva27 +
      otros;

    return {
      netoGrav21,
      netoGrav105,
      netoGrav27,
      netoNoGrav,
      netoExento,
      iva21,
      iva105,
      iva27,
      otros,
      total,
    };
  }, [lineas, impuestos]);

  /* ===== Submit ===== */
  const canSubmit =
    !!organizacionId &&
    !!terceroSel &&
    !!rol &&
    !!tipo &&
    !!fecha &&
    lineas.length > 0 &&
    lineas.every((l) => l.descripcion.trim().length > 0);

  const submit = async () => {
    try {
      setPosting(true);
      setMsg(null);

      if (!canSubmit)
        throw new Error(
          "Completá los datos mínimos y al menos una línea válida."
        );

      const payload = {
        organizacionId,
        terceroId: BigInt(terceroSel!.id).toString(),
        rol,
        tipo,
        clase: clase || null,
        puntoVenta: puntoVenta === "" ? null : Number(puntoVenta),
        numero: numero === "" ? null : Number(numero),
        fecha,
        vencimiento: vencimiento || null,
        moneda,
        cuitEmisor: cuitEmisor || null,
        observaciones: observaciones || null,
        lineas: lineas.map((l) => ({
          descripcion: l.descripcion,
          cantidad: Number(l.cantidad || 0),
          precioUnitario: Number(l.precioUnitario || 0),
          alicuotaIVA: l.alicuotaIVA == null ? null : Number(l.alicuotaIVA),
        })),
        impuestos: impuestos.map((it) => ({
          tipo: it.tipo,
          detalle: it.detalle || null,
          alicuota: it.alicuota == null ? null : Number(it.alicuota),
          importe: Number(it.importe || 0),
        })),
      };

      const res = await fetch(`${API}/terceros/comprobantes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Organizacion-ID": ORG,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(await res.text());
      const r = await res.json();
      setMsg(
        `Comprobante creado exitosamente (ID: ${r.id}). Total: $${fmt(
          Number(r.total ?? 0)
        )}`
      );
    } catch (e) {
      setMsg(`Error: ${getErrorMessage(e)}`);
    } finally {
      setPosting(false);
    }
  };

  /* ===== Render ===== */
  return (
    <div className="page-container">
      {/* Header de página */}
      <div className="page-header">
        <div className="page-title-section">
          <h1 className="page-title">Nuevo Comprobante</h1>
          <p className="page-subtitle">
            Registra facturas, prestaciones y notas de crédito/débito
          </p>
        </div>
      </div>

      {/* Mensaje de estado global */}
      {msg && (
        <div
          className={`alert ${
            msg.includes("Error") ? "alert-error" : "alert-success"
          }`}
        >
          <div className="alert-content">
            <div className="alert-icon">
              {msg.includes("Error") ? (
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
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              ) : (
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
                  <polyline points="20,6 9,17 4,12" />
                </svg>
              )}
            </div>
            <div className="alert-text">{msg}</div>
          </div>
        </div>
      )}

      <div className="page-content">
        {/* CABECERA DEL COMPROBANTE */}
        <div className="form-section">
          <div className="form-section-header">
            <h2 className="form-section-title">Información General</h2>
            <p className="form-section-subtitle">
              Datos básicos del comprobante
            </p>
          </div>

          <div className="form-grid form-grid-4">
            <div className="form-group">
              <label className="form-label">Organización</label>
              <input
                className="form-input"
                value={organizacionId}
                onChange={(e) => setOrg(e.target.value)}
                placeholder="ID de organización"
              />
            </div>

            {/* Autocomplete tercero */}
            <div className="form-group form-group-span-2" ref={acWrapRef}>
              <label className="form-label">
                Tercero
                {terceroSel && (
                  <span className="form-label-info">
                    · {terceroSel.roles.join(", ")}
                  </span>
                )}
              </label>
              <div className="autocomplete-container">
                <input
                  ref={inputRef}
                  className="form-input"
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setOpen(Boolean(e.target.value.trim()));
                    if (!e.target.value) setTerceroSel(null);
                  }}
                  onFocus={() => setOpen(Boolean(q.trim()))}
                  onKeyDown={onAutoKeyDown}
                  placeholder="Buscar por CUIT o nombre..."
                  aria-autocomplete="list"
                  aria-expanded={open}
                />
                {terceroSel && (
                  <button
                    type="button"
                    onClick={limpiarTercero}
                    className="autocomplete-clear"
                    title="Limpiar selección"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}

                {open && (items.length > 0 || q.trim()) && (
                  <div className="autocomplete-dropdown">
                    {items.map((t) => (
                      <div
                        key={t.id}
                        className="autocomplete-item"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => pick(t)}
                      >
                        <div className="autocomplete-item-main">
                          <div className="autocomplete-item-name">
                            {t.nombre}
                          </div>
                          {t.fantasia && (
                            <div className="autocomplete-item-fantasia">
                              ({t.fantasia})
                            </div>
                          )}
                          {t.cuit && (
                            <div className="autocomplete-item-cuit">
                              CUIT: {t.cuit}
                            </div>
                          )}
                        </div>
                        <div className="autocomplete-item-roles">
                          {t.roles.map((r) => (
                            <span key={r} className="role-badge">
                              {r}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                    {!items.length && q.trim() && (
                      <div className="autocomplete-empty">
                        Sin resultados para &quot;{q}&quot;
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Rol</label>
              <select
                className="form-select"
                value={rol}
                onChange={(e) => {
                  const next = e.target.value as RolTercero;
                  setRol(next);
                  if (terceroSel && !terceroSel.roles.includes(next)) {
                    setMsg(
                      `El tercero seleccionado no tiene rol ${next}. Roles disponibles: ${terceroSel.roles.join(
                        ", "
                      )}.`
                    );
                  } else {
                    setMsg(null);
                  }
                }}
              >
                <option value="PROVEEDOR">Proveedor</option>
                <option value="PRESTADOR">Prestador</option>
                <option value="AFILIADO">Afiliado</option>
                <option value="OTRO">Otro</option>
              </select>
            </div>
          </div>

          <div className="form-grid form-grid-4">
            <div className="form-group">
              <label className="form-label">Tipo de Comprobante</label>
              <select
                className="form-select"
                value={tipo}
                onChange={(e) => setTipo(e.target.value as TipoComprobante)}
              >
                <option value="FACTURA">Factura</option>
                <option value="PRESTACION">Prestación</option>
                <option value="NOTA_CREDITO">Nota de Crédito</option>
                <option value="NOTA_DEBITO">Nota de Débito</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Clase AFIP</label>
              <select
                className="form-select"
                value={clase}
                onChange={(e) => setClase(e.target.value as ClaseAFIP)}
              >
                <option value="">(Ninguna)</option>
                <option value="A">Clase A</option>
                <option value="B">Clase B</option>
                <option value="C">Clase C</option>
                <option value="M">Clase M</option>
                <option value="X">Clase X</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Punto de Venta</label>
              <input
                className="form-input"
                type="number"
                value={puntoVenta}
                onChange={(e) =>
                  setPV(e.target.value === "" ? "" : Number(e.target.value))
                }
                placeholder="Ej: 0001"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Número</label>
              <input
                className="form-input"
                type="number"
                value={numero}
                onChange={(e) =>
                  setNumero(e.target.value === "" ? "" : Number(e.target.value))
                }
                placeholder="Ej: 00001234"
              />
            </div>
          </div>

          <div className="form-grid form-grid-5">
            <div className="form-group">
              <label className="form-label">Fecha</label>
              <input
                className="form-input"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Vencimiento</label>
              <input
                className="form-input"
                type="date"
                value={vencimiento}
                onChange={(e) => setVenc(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Moneda</label>
              <input
                className="form-input"
                value={moneda}
                onChange={(e) => setMoneda(e.target.value)}
                placeholder="ARS"
              />
            </div>

            <div className="form-group">
              <label className="form-label">CUIT Emisor</label>
              <input
                className="form-input"
                value={cuitEmisor}
                onChange={(e) => setCuitEmisor(e.target.value)}
                placeholder="20-12345678-9"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Observaciones</label>
              <input
                className="form-input"
                value={observaciones}
                onChange={(e) => setObs(e.target.value)}
                placeholder="Notas adicionales..."
              />
            </div>
          </div>
        </div>

        {/* LÍNEAS */}
        <div className="form-section">
          <div className="form-section-header">
            <div>
              <h2 className="form-section-title">Líneas de Detalle</h2>
              <p className="form-section-subtitle">Items del comprobante</p>
            </div>
            <button
              className="btn btn-primary"
              onClick={addLinea}
              type="button"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Agregar Línea
            </button>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Descripción</th>
                  <th className="table-col-numeric">Cantidad</th>
                  <th className="table-col-numeric">Precio Unitario</th>
                  <th className="table-col-center">Alícuota IVA</th>
                  <th className="table-col-numeric">Subtotal</th>
                  <th className="table-col-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {lineas.map((l, i) => (
                  <tr key={i}>
                    <td>
                      <input
                        className="table-input"
                        value={l.descripcion}
                        onChange={(e) =>
                          updLinea(i, { descripcion: e.target.value })
                        }
                        placeholder="Descripción del item..."
                      />
                    </td>
                    <td>
                      <input
                        className="table-input table-input-numeric"
                        type="number"
                        step="0.01"
                        min={0}
                        value={l.cantidad}
                        onChange={(e) =>
                          updLinea(i, { cantidad: Number(e.target.value) })
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="table-input table-input-numeric"
                        type="number"
                        step="0.01"
                        min={0}
                        value={l.precioUnitario}
                        onChange={(e) =>
                          updLinea(i, {
                            precioUnitario: Number(e.target.value),
                          })
                        }
                      />
                    </td>
                    <td>
                      <select
                        className="table-select"
                        value={String(l.alicuotaIVA ?? "")}
                        onChange={(e) =>
                          updLinea(i, {
                            alicuotaIVA:
                              e.target.value === ""
                                ? null
                                : Number(e.target.value),
                          })
                        }
                      >
                        <option value="">(No gravado)</option>
                        <option value="0">0% (Exento)</option>
                        <option value="10.5">10.5%</option>
                        <option value="21">21%</option>
                        <option value="27">27%</option>
                      </select>
                    </td>
                    <td className="table-col-numeric table-col-calculated">
                      $
                      {fmt(
                        Number(l.cantidad || 0) * Number(l.precioUnitario || 0)
                      )}
                    </td>
                    <td className="table-col-center">
                      <button
                        className="btn-icon btn-icon-danger"
                        onClick={() => delLinea(i)}
                        title="Eliminar línea"
                        type="button"
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="3,6 5,6 21,6" />
                          <path d="m19,6v14a2,2 0,0 1,-2,2H7a2,2 0,0 1,-2,-2V6m3,0V4a2,2 0,0 1,2,-2h4a2,2 0,0 1,2,2v2" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* IMPUESTOS ADICIONALES */}
        <div className="form-section">
          <div className="form-section-header">
            <div>
              <h2 className="form-section-title">Impuestos y Percepciones</h2>
              <p className="form-section-subtitle">Conceptos adicionales</p>
            </div>
            <button
              className="btn btn-secondary"
              onClick={addImp}
              type="button"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Agregar Concepto
            </button>
          </div>

          {impuestos.length > 0 && (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Detalle</th>
                    <th className="table-col-numeric">Alícuota (%)</th>
                    <th className="table-col-numeric">Importe</th>
                    <th className="table-col-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {impuestos.map((it, i) => (
                    <tr key={i}>
                      <td>
                        <select
                          className="table-select"
                          value={it.tipo}
                          onChange={(e) =>
                            updImp(i, { tipo: e.target.value as ImpAdicTipo })
                          }
                        >
                          <option value="PERCEPCION_IIBB">
                            Percepción IIBB
                          </option>
                          <option value="RETENCION_IIBB">Retención IIBB</option>
                          <option value="PERCEPCION_IVA">Percepción IVA</option>
                          <option value="RETENCION_IVA">Retención IVA</option>
                          <option value="IMP_MUNICIPAL">
                            Impuesto Municipal
                          </option>
                          <option value="IMP_INTERNO">Impuesto Interno</option>
                          <option value="GASTO_ADMINISTRATIVO">
                            Gasto Administrativo
                          </option>
                          <option value="OTRO">Otro</option>
                        </select>
                      </td>
                      <td>
                        <input
                          className="table-input"
                          value={it.detalle || ""}
                          onChange={(e) =>
                            updImp(i, { detalle: e.target.value })
                          }
                          placeholder="Descripción..."
                        />
                      </td>
                      <td>
                        <input
                          className="table-input table-input-numeric"
                          type="number"
                          step="0.01"
                          value={it.alicuota ?? ""}
                          onChange={(e) =>
                            updImp(i, {
                              alicuota:
                                e.target.value === ""
                                  ? null
                                  : Number(e.target.value),
                            })
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="table-input table-input-numeric"
                          type="number"
                          step="0.01"
                          min={0}
                          value={it.importe}
                          onChange={(e) =>
                            updImp(i, { importe: Number(e.target.value) })
                          }
                        />
                      </td>
                      <td className="table-col-center">
                        <button
                          className="btn-icon btn-icon-danger"
                          onClick={() => delImp(i)}
                          title="Eliminar concepto"
                          type="button"
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="3,6 5,6 21,6" />
                            <path d="m19,6v14a2,2 0,0 1,-2,2H7a2,2 0,0 1,-2,-2V6m3,0V4a2,2 0,0 1,2,-2h4a2,2 0,0 1,2,2v2" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {impuestos.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon">📊</div>
              <div className="empty-state-title">Sin conceptos adicionales</div>
              <div className="empty-state-text">
                Agrega percepciones, retenciones o gastos administrativos según
                corresponda
              </div>
            </div>
          )}
        </div>

        {/* RESUMEN Y TOTALES */}
        <div className="totals-section">
          <div className="totals-grid">
            <div className="totals-group">
              <h3 className="totals-group-title">Importes Netos</h3>
              <div className="totals-items">
                <div className="total-item">
                  <span className="total-label">Neto gravado 21%</span>
                  <span className="total-value">
                    ${fmt(totales.netoGrav21)}
                  </span>
                </div>
                <div className="total-item">
                  <span className="total-label">Neto gravado 10.5%</span>
                  <span className="total-value">
                    ${fmt(totales.netoGrav105)}
                  </span>
                </div>
                <div className="total-item">
                  <span className="total-label">Neto gravado 27%</span>
                  <span className="total-value">
                    ${fmt(totales.netoGrav27)}
                  </span>
                </div>
                <div className="total-item">
                  <span className="total-label">No gravado</span>
                  <span className="total-value">
                    ${fmt(totales.netoNoGrav)}
                  </span>
                </div>
                <div className="total-item">
                  <span className="total-label">Exento</span>
                  <span className="total-value">
                    ${fmt(totales.netoExento)}
                  </span>
                </div>
              </div>
            </div>

            <div className="totals-group">
              <h3 className="totals-group-title">Impuestos</h3>
              <div className="totals-items">
                <div className="total-item">
                  <span className="total-label">IVA 21%</span>
                  <span className="total-value">${fmt(totales.iva21)}</span>
                </div>
                <div className="total-item">
                  <span className="total-label">IVA 10.5%</span>
                  <span className="total-value">${fmt(totales.iva105)}</span>
                </div>
                <div className="total-item">
                  <span className="total-label">IVA 27%</span>
                  <span className="total-value">${fmt(totales.iva27)}</span>
                </div>
                <div className="total-item">
                  <span className="total-label">Otros conceptos</span>
                  <span className="total-value">${fmt(totales.otros)}</span>
                </div>
              </div>
            </div>

            <div className="totals-summary">
              <div className="total-final">
                <span className="total-final-label">Total General</span>
                <span className="total-final-value">${fmt(totales.total)}</span>
              </div>

              <div className="submit-section">
                <button
                  className={`btn btn-lg ${
                    canSubmit ? "btn-success" : "btn-disabled"
                  }`}
                  onClick={submit}
                  disabled={posting || !canSubmit}
                  type="button"
                >
                  {posting ? (
                    <>
                      <svg
                        className="spinner"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </svg>
                      Procesando...
                    </>
                  ) : (
                    <>
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
                        <polyline points="20,6 9,17 4,12" />
                      </svg>
                      Crear Comprobante
                    </>
                  )}
                </button>

                {!canSubmit && (
                  <div className="submit-help">
                    {!terceroSel
                      ? "Selecciona un tercero"
                      : lineas.length === 0
                      ? "Agrega al menos una línea"
                      : !lineas.every((l) => l.descripcion.trim())
                      ? "Completa todas las descripciones"
                      : "Completa los campos requeridos"}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
