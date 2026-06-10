/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api, getErrorMessage, ORG, openPdf, downloadPdf } from "@/servicios/api";
import { formatearFechaArgentina } from "@/utiles/formatos";
import {
  Search,
  CreditCard,
  FileText,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  Info,
  AlertCircle,
  Loader2,
  Download,
  Printer,
  Eye,
  RefreshCw,
  Building,
  Calendar,
  User,
  Users,
  DollarSign,
  Receipt,
} from "lucide-react";
import Swal from "sweetalert2";

/* ===== Tipos ===== */
type RolTercero = "PROVEEDOR" | "PRESTADOR" | "COMERCIO" | "AFILIADO" | "OTRO" | "REINTEGROS";
type MetodoPago = "transferencia" | "cheque" | "efectivo" | "otro";

type AfiliadoSuggest = {
  id: string;
  dni: string;
  apellido?: string | null;
  nombre?: string | null;
  display: string;
};

type Metodo = { metodo: MetodoPago; monto: number; ref?: string };
type Aplic = {
  comprobanteId: string;
  numero?: string | null;
  fecha?: string;
  total?: number;
  aplicadoPrevio?: number;
  saldo?: number;
  montoAplicado: number;
};

type TerceroLite = {
  id: string;
  nombre: string;
  fantasia?: string | null;
  cuit?: string | null;
  codigo?: string | null;
  activo: boolean;
};

type Pendiente = {
  id: string;
  tipo: string;
  clase?: string | null;
  numero?: string | null;
  fecha: string;
  total: number;
  aplicadoPrevio: number;
  saldo: number;
};

/* ===== Helper para formateo de números ===== */
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

/* ===== Autocomplete Tercero ===== */
function AutocompleteTercero({
  rol,
  onSelect,
  selectedTercero,
}: {
  rol: RolTercero;
  onSelect: (t: TerceroLite | null) => void;
  selectedTercero: TerceroLite | null;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<TerceroLite[]>([]);
  const debQ = useDebounced(q, 300);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedTercero) {
      const label = `${selectedTercero.nombre}${selectedTercero.fantasia ? ` (${selectedTercero.fantasia})` : ""
        }${selectedTercero.cuit ? ` · CUIT ${selectedTercero.cuit}` : ""}`;
      setQ(label);
    }
  }, [selectedTercero]);

  useEffect(() => {
    if (!debQ.trim()) {
      setItems([]);
      return;
    }
    setLoading(true);

    const fetchData = async () => {
      try {
        // El backend ahora busca en afiliados cuando el rol es AFILIADO
        const data = await api<TerceroLite[]>(
          `/terceros/buscar?q=${encodeURIComponent(debQ.trim())}&rol=${rol}&limit=20`
        );
        // Asegurar que siempre sea un array
        setItems(Array.isArray(data) ? data : []);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [debQ, rol]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const handleSelect = (t: TerceroLite) => {
    onSelect(t);
    const label = `${t.nombre}${t.fantasia ? ` (${t.fantasia})` : ""}${t.cuit ? ` · CUIT ${t.cuit}` : ""
      }`;
    setQ(label);
    setOpen(false);
  };

  const handleClear = () => {
    onSelect(null);
    setQ("");
    setOpen(false);
  };

  return (
    <div className="form-group" ref={wrapperRef}>
      <label className="form-label">
        <User size={16} />
        Tercero
        {selectedTercero && (
          <span className="form-label-info">
            · {selectedTercero.cuit || selectedTercero.id}
          </span>
        )}
      </label>
      <div className="autocomplete-container">
        <div className="form-input-group">
          <Search className="form-input-icon" size={16} />
          <input
            className="form-input form-input-with-icon"
            value={q}
            onFocus={() => setOpen(Boolean(debQ.trim()))}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(Boolean(e.target.value.trim()));
              if (!e.target.value) onSelect(null);
            }}
            placeholder={
              rol === "AFILIADO"
                ? "Buscar por nombre, DNI o padrón..."
                : "Buscar por CUIT o nombre..."
            }
          />
          {selectedTercero && (
            <button
              type="button"
              onClick={handleClear}
              className="form-input-clear"
              title="Limpiar selección"
            >
              ×
            </button>
          )}
        </div>

        {open && (loading || items.length > 0 || debQ.trim()) && (
          <div className="autocomplete-dropdown">
            {loading && (
              <div className="autocomplete-loading">
                <Loader2 className="spinner" size={16} />
                Buscando...
              </div>
            )}
            {!loading && Array.isArray(items) && items.length > 0 &&
              items.map((t) => (
                <div
                  key={t.id}
                  className="autocomplete-item"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(t)}
                >
                  <div className="tercero-info">
                    <div className="tercero-nombre">{t.nombre}</div>
                    {t.fantasia && (
                      <div className="tercero-fantasia">({t.fantasia})</div>
                    )}
                    {t.cuit && (
                      <div className="tercero-cuit">CUIT: {t.cuit}</div>
                    )}
                    {rol === "AFILIADO" && t.codigo?.startsWith("AFI-") && (
                      <div className="tercero-cuit">DNI: {t.cuit}</div>
                    )}
                  </div>
                  <div
                    className={`tercero-status ${t.activo ? "activo" : "inactivo"
                      }`}
                  >
                    {t.activo ? "Activo" : "Inactivo"}
                  </div>
                </div>
              ))}
            {!loading && items.length === 0 && debQ.trim() && (
              <div className="autocomplete-empty">
                Sin resultados para &quot;{debQ}&quot;
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ===== Autocomplete Afiliado (para REINTEGROS) ===== */
function AutocompleteAfiliado({
  onSelect,
  selectedAfiliado,
}: {
  onSelect: (a: AfiliadoSuggest | null) => void;
  selectedAfiliado: AfiliadoSuggest | null;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<AfiliadoSuggest[]>([]);
  const debQ = useDebounced(q, 300);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedAfiliado) {
      setQ(selectedAfiliado.display);
    }
  }, [selectedAfiliado]);

  useEffect(() => {
    if (!debQ.trim() || debQ.trim().length < 2) {
      setItems([]);
      return;
    }
    setLoading(true);

    const fetchData = async () => {
      try {
        const data = await api<AfiliadoSuggest[]>(
          `/afiliados/suggest?q=${encodeURIComponent(debQ.trim())}`
        );
        setItems(Array.isArray(data) ? data : []);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [debQ]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const handleSelect = (a: AfiliadoSuggest) => {
    onSelect(a);
    setQ(a.display);
    setOpen(false);
  };

  const handleClear = () => {
    onSelect(null);
    setQ("");
    setOpen(false);
  };

  return (
    <div className="form-group" ref={wrapperRef}>
      <label className="form-label">
        <User size={16} />
        Afiliado
        {selectedAfiliado && (
          <span className="form-label-info">
            · DNI {selectedAfiliado.dni}
          </span>
        )}
      </label>
      <div className="autocomplete-container">
        <div className="form-input-group">
          <Search className="form-input-icon" size={16} />
          <input
            className="form-input form-input-with-icon"
            value={q}
            onFocus={() => setOpen(Boolean(debQ.trim() && debQ.trim().length >= 2))}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(Boolean(e.target.value.trim().length >= 2));
              if (!e.target.value) onSelect(null);
            }}
            placeholder="Buscar por nombre, DNI o padrón..."
          />
          {selectedAfiliado && (
            <button
              type="button"
              onClick={handleClear}
              className="form-input-clear"
              title="Limpiar selección"
            >
              ×
            </button>
          )}
        </div>

        {open && (loading || items.length > 0 || debQ.trim().length >= 2) && (
          <div className="autocomplete-dropdown">
            {loading && (
              <div className="autocomplete-loading">
                <Loader2 className="spinner" size={16} />
                Buscando...
              </div>
            )}
            {!loading && Array.isArray(items) && items.length > 0 &&
              items.map((a) => (
                <div
                  key={a.id}
                  className="autocomplete-item"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(a)}
                >
                  <div className="tercero-info">
                    <div className="tercero-nombre">{a.display}</div>
                    <div className="tercero-cuit">DNI: {a.dni}</div>
                  </div>
                  <div className="tercero-status activo">Afiliado</div>
                </div>
              ))}
            {!loading && items.length === 0 && debQ.trim().length >= 2 && (
              <div className="autocomplete-empty">
                Sin resultados para &quot;{debQ}&quot;
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ===== Página Principal ===== */
export default function NuevaOrdenPagoPage() {
  const API = process.env.NEXT_PUBLIC_API_URL;

  const [organizacionId, setOrg] = useState(ORG);
  const [rol, setRol] = useState<RolTercero>("PROVEEDOR");
  const [fecha, setFecha] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [observaciones, setObs] = useState("");

  const [tercero, setTercero] = useState<TerceroLite | null>(null);
  const [afiliadoSeleccionado, setAfiliadoSeleccionado] = useState<AfiliadoSuggest | null>(null);

  const [metodos, setMetodos] = useState<Metodo[]>([
    { metodo: "transferencia", monto: 0 },
  ]);
  const [aplicaciones, setAplics] = useState<Aplic[]>([]);

  const [pendLoading, setPendLoading] = useState(false);
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  // Estado del comprobante generado
  const [compId, setCompId] = useState<string | null>(null);
  const [compNumero, setCompNumero] = useState<string | null>(null);
  const [compFilename, setCompFilename] = useState<string | null>(null);


  const totalMetodos = useMemo(
    () => metodos.reduce((a, m) => a + Number(m.monto || 0), 0),
    [metodos]
  );
  const totalAplic = useMemo(
    () => aplicaciones.reduce((a, ap) => a + Number(ap.montoAplicado || 0), 0),
    [aplicaciones]
  );

  const canSubmit =
    !!organizacionId &&
    ((rol === "REINTEGROS" && !!afiliadoSeleccionado) || (rol !== "REINTEGROS" && !!tercero)) &&
    pendientes.length > 0 &&
    metodos.length > 0 &&
    aplicaciones.length > 0 &&
    Math.round(totalMetodos * 100) === Math.round(totalAplic * 100) &&
    !posting;

  // Parse message type and content
  const parseMessage = (message: string | null) => {
    if (!message) return null;

    if (message.startsWith("SUCCESS:")) {
      return { type: "success", content: message.substring(8) };
    } else if (message.startsWith("ERROR:")) {
      return { type: "error", content: message.substring(6) };
    } else if (message.startsWith("INFO:")) {
      return { type: "info", content: message.substring(5) };
    } else {
      return {
        type:
          message.includes("Error") || message.includes("❌")
            ? "error"
            : "success",
        content: message.replace(/^(✅|❌)\s*/, ""),
      };
    }
  };

  const messageInfo = parseMessage(msg);

  // Cargar pendientes cuando hay tercero + rol, o afiliado para REINTEGROS
  useEffect(() => {
    const load = async () => {
      if (rol === "REINTEGROS") {
        if (!afiliadoSeleccionado) {
          setPendientes([]);
          setAplics([]);
          return;
        }
        setPendLoading(true);
        setMsg(null);
        try {
          // Buscar reintegros aprobados del afiliado
          const raw = await api<{ items: any[] }>(
            `/reintegros/solicitudes?afiliadoId=${afiliadoSeleccionado.id}&estado=APROBADO&pageSize=200`
          );

          // El endpoint devuelve { items: [], total, page, pageSize }
          const reintegros = (raw?.items ?? []).filter((r: any) => {
            // Excluir reintegros pagados (estado PAGADO)
            if (r.estado === 'PAGADO') return false;
            
            // Calcular saldo para verificar si está completamente pagado
            const montoReintegro =
              r.importeReintegro != null
                ? Number(r.importeReintegro)
                : r.importeAprobado != null
                  ? Number(r.importeAprobado)
                  : Number(r.importeTotal ?? 0);
            
            // Calcular total pagado (incluyendo todos los pagos, con o sin ordenPagoId)
            const totalPagado = (r.pagos ?? [])
              .reduce((acc: number, p: any) => acc + Number(p.monto ?? 0), 0);
            
            const saldo = Math.max(0, montoReintegro - totalPagado);
            
            // Excluir si:
            // 1. Tiene estado PAGADO
            // 2. Tiene pagos con ordenPagoId (ya fue pagado mediante orden de pago)
            // 3. El saldo es 0 o negativo
            if (r.estado === 'PAGADO') return false;
            const tienePagosConOrden = r.pagos && r.pagos.some((p: any) => p.ordenPagoId);
            if (tienePagosConOrden) return false;
            if (saldo <= 0.000001) return false;
            
            return true;
          });

          const data: Pendiente[] = reintegros.map((r: any) => {
            const montoReintegro =
              r.importeReintegro != null
                ? Number(r.importeReintegro)
                : r.importeAprobado != null
                  ? Number(r.importeAprobado)
                  : Number(r.importeTotal ?? 0);

            // Calcular total pagado (incluyendo todos los pagos)
            const totalPagado = (r.pagos ?? [])
              .reduce((acc: number, p: any) => acc + Number(p.monto ?? 0), 0);
            
            // Calcular aplicado previo solo desde pagos sin ordenPagoId (para mostrar en la UI)
            const aplicadoPrevio = (r.pagos ?? [])
              .filter((p: any) => !p.ordenPagoId)
              .reduce((acc: number, p: any) => acc + Number(p.monto ?? 0), 0);

            const saldo = Math.max(0, montoReintegro - totalPagado);

            return {
              id: `REINTEGRO-${r.id}`,
              tipo: "PRESTACION",
              clase: null,
              numero: `REINT-${r.id}`,
              fecha: r.fechaFactura || r.fechaPresentacion || new Date().toISOString(),
              total: montoReintegro,
              aplicadoPrevio,
              saldo,
            };
          });

          setPendientes(data.filter((p) => p.saldo > 0.000001));
          setAplics((prev) =>
            prev.filter((ap) => data.some((p) => p.id === ap.comprobanteId))
          );
        } catch (e) {
          setMsg(`ERROR:Error al cargar reintegros: ${getErrorMessage(e)}`);
          setPendientes([]);
        } finally {
          setPendLoading(false);
        }
      } else {
        if (!tercero) {
          setPendientes([]);
          setAplics([]);
          return;
        }
        setPendLoading(true);
        setMsg(null);
        try {
          const raw = await api<any[]>(
            `/terceros/comprobantes/pendientes?terceroId=${tercero.id}&rol=${rol}&limit=200`
          );
          const data: Pendiente[] = (raw ?? []).map((p) => ({
            id: String(p.id),
            tipo: p.tipo,
            clase: p.clase ?? null,
            numero: p.numero ?? null,
            fecha: p.fecha,
            total: Number(p.total ?? 0),
            aplicadoPrevio: Number(p.aplicadoPrevio ?? 0),
            saldo: Number(p.saldo ?? 0),
          }));
          setPendientes(data);
          setAplics((prev) =>
            prev.filter((ap) => data.some((p) => p.id === ap.comprobanteId))
          );
        } catch (e) {
          setMsg(`ERROR:Error al cargar pendientes: ${getErrorMessage(e)}`);
          setPendientes([]);
        } finally {
          setPendLoading(false);
        }
      }
    };
    void load();
  }, [tercero, rol, afiliadoSeleccionado]);

  /* ===== UI helpers ===== */
  const addMetodo = () =>
    setMetodos((x) => [...x, { metodo: "efectivo", monto: 0 }]);
  const delMetodo = (i: number) =>
    setMetodos((x) => x.filter((_, idx) => idx !== i));
  const updMetodo = (i: number, patch: Partial<Metodo>) =>
    setMetodos((x) =>
      x.map((row, idx) => (idx === i ? { ...row, ...patch } : row))
    );

  const pickPendiente = (p: Pendiente) => {
    if (aplicaciones.some((a) => a.comprobanteId === p.id)) return;
    setAplics((x) => [
      ...x,
      {
        comprobanteId: p.id,
        numero: p.numero ?? null,
        fecha: p.fecha,
        total: Number(p.total ?? 0),
        aplicadoPrevio: Number(p.aplicadoPrevio ?? 0),
        saldo: Number(p.saldo ?? 0),
        montoAplicado: Number(p.saldo ?? 0),
      },
    ]);
  };

  const delAplic = (i: number) =>
    setAplics((x) => x.filter((_, idx) => idx !== i));
  const updAplic = (i: number, patch: Partial<Aplic>) =>
    setAplics((x) =>
      x.map((row, idx) => {
        if (idx !== i) return row;
        const next = { ...row, ...patch };
        const max = Number(row.saldo ?? 0);
        if (next.montoAplicado > max) next.montoAplicado = max;
        if (next.montoAplicado < 0) next.montoAplicado = 0;
        return next;
      })
    );

  const resetAll = () => {
    setMsg(null);
    setCompId(null);
    setCompNumero(null);
    setCompFilename(null);
    setOrg(ORG);
    setRol("PROVEEDOR");
    setFecha(new Date().toISOString().slice(0, 10));
    setObs("");
    setTercero(null);
    setAfiliadoSeleccionado(null);
    setMetodos([{ metodo: "transferencia", monto: 0 }]);
    setAplics([]);
    setPendientes([]);
  };

  const submit = async () => {
    try {
      setPosting(true);
      setMsg(null);

      if (!organizacionId) throw new Error("Falta organización");
      if (!rol) throw new Error("Seleccioná rol");

      let terceroIdFinal: string;
      let rolFinal: RolTercero;

      if (rol === "REINTEGROS") {
        if (!afiliadoSeleccionado) throw new Error("Seleccioná un afiliado");
        // Obtener o crear el tercero del afiliado
        // El backend crea automáticamente el tercero cuando buscamos por código exacto AFI-{id}
        const codigo = `AFI-${afiliadoSeleccionado.id}`;
        const tercerosRes = await api<TerceroLite[]>(
          `/terceros/buscar?q=${encodeURIComponent(codigo)}&rol=AFILIADO&limit=10`
        );

        // Buscar el que tenga exactamente ese código
        const terceroEncontrado = Array.isArray(tercerosRes)
          ? tercerosRes.find((t) => t.codigo === codigo)
          : null;

        if (!terceroEncontrado) {
          throw new Error(`No se pudo obtener o crear el tercero del afiliado. Código: ${codigo}`);
        }

        terceroIdFinal = terceroEncontrado.id;
        rolFinal = "AFILIADO";
      } else {
        if (!tercero) throw new Error("Seleccioná un tercero");
        terceroIdFinal = tercero.id;
        rolFinal = rol;
      }

      if (pendientes.length === 0)
        throw new Error(
          rol === "REINTEGROS"
            ? "No hay reintegros aprobados para este afiliado."
            : "No hay comprobantes pendientes para este tercero/rol."
        );
      if (metodos.length === 0)
        throw new Error("Agregá al menos un método de pago");
      if (aplicaciones.length === 0)
        throw new Error("Agregá al menos una aplicación");
      if (Math.round(totalMetodos * 100) !== Math.round(totalAplic * 100)) {
        throw new Error(
          `Los métodos ($${fmt(
            totalMetodos
          )}) deben sumar igual que las aplicaciones ($${fmt(totalAplic)}).`
        );
      }

      const payload = {
        organizacionId,
        terceroId: terceroIdFinal,
        rol: rolFinal,
        fecha,
        observaciones: observaciones || null,
        metodos: metodos.map((m) => ({
          metodo: m.metodo.toUpperCase(),
          monto: Number(m.monto || 0),
          ref: m.ref || null,
        })),
        aplicaciones: aplicaciones.map((ap) => ({
          comprobanteId: ap.comprobanteId,
          montoAplicado: Number(ap.montoAplicado || 0),
        })),
      };

      const r = await api<{
        id: number | string;
        comprobanteId: string;
        comprobanteNumero: string;
        filename?: string;
      }>("/terceros/ordenes-pago", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setCompId(String(r.comprobanteId));
      setCompNumero(r.comprobanteNumero ?? null);
      setCompFilename(r.filename ?? null);

      // Mostrar SweetAlert con opciones
      const htmlContent = `
      <div style="text-align: left; font-size: 14px;">
        <div style="background: #ecfdf5; border: 1px solid #10b981; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
          <h4 style="margin: 0 0 12px 0; color: #059669; display: flex; align-items: center; gap: 8px;">
            ✅ Orden de Pago Creada Exitosamente
          </h4>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="color: #047857;">Número de Orden:</span>
            <strong style="color: #059669; font-family: monospace;">#${r.id}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="color: #047857;">Comprobante:</span>
            <strong style="color: #059669; font-family: monospace;">${r.comprobanteNumero ? "N° " + r.comprobanteNumero : `ID ${r.comprobanteId}`
        }</strong>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 2px solid #10b981; padding-top: 8px; margin-top: 12px;">
            <span style="color: #047857; font-size: 16px;">Total:</span>
            <strong style="color: #059669; font-size: 18px; font-family: monospace;">${fmt(totalMetodos)}</strong>
          </div>
        </div>

        <!-- Aplicaciones -->
        <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
          <h4 style="margin: 0 0 12px 0; color: #92400e; display: flex; align-items: center; gap: 8px;">
            📋 Aplicaciones
          </h4>
          ${aplicaciones
          .map(
            (ap) => `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 14px;">
              <span style="color: #92400e;">
                ${ap.numero || `ID ${ap.comprobanteId}`}
              </span>
              <strong style="color: #92400e; font-family: monospace;">${fmt(ap.montoAplicado)}</strong>
            </div>
          `
          )
          .join("")}
          <div style="border-top: 2px solid #f59e0b; padding-top: 8px; margin-top: 12px; display: flex; justify-content: space-between; align-items: center;">
            <strong style="color: #92400e; font-size: 16px;">TOTAL:</strong>
            <strong style="color: #92400e; font-size: 18px; font-family: monospace;">${fmt(totalAplic)}</strong>
          </div>
        </div>

        <!-- Métodos de pago -->
        <div style="background: #fefce8; border: 1px solid #eab308; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
          <h4 style="margin: 0 0 12px 0; color: #a16207; display: flex; align-items: center; gap: 8px;">
            💳 Métodos de Pago
          </h4>
          ${metodos
          .map(
            (m) => `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 14px;">
              <span style="color: #a16207;">
                ${m.metodo === "transferencia"
                ? "🏦 Transferencia"
                : m.metodo === "cheque"
                  ? "📝 Cheque"
                  : m.metodo === "efectivo"
                    ? "💵 Efectivo"
                    : "💳 Otro"
              }
                ${m.ref ? ` (${m.ref})` : ""}
              </span>
              <strong style="color: #a16207; font-family: monospace;">${fmt(m.monto)}</strong>
            </div>
          `
          )
          .join("")}
          <div style="border-top: 2px solid #eab308; padding-top: 8px; margin-top: 12px; display: flex; justify-content: space-between; align-items: center;">
            <strong style="color: #a16207; font-size: 16px;">TOTAL:</strong>
            <strong style="color: #a16207; font-size: 18px; font-family: monospace;">${fmt(totalMetodos)}</strong>
          </div>
        </div>

        ${observaciones
          ? `
          <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
            <h4 style="margin: 0 0 8px 0; color: #475569; display: flex; align-items: center; gap: 8px;">
              📝 Observaciones
            </h4>
            <p style="margin: 0; color: #64748b; font-size: 14px; font-style: italic;">
              ${observaciones}
            </p>
          </div>
        `
          : ""
        }
      </div>
    `;

      await Swal.fire({
        title: "✅ Orden de Pago Creada",
        html: htmlContent,
        icon: "success",
        width: "600px",
        showCancelButton: true,
        showDenyButton: true,
        showConfirmButton: true,
        confirmButtonText: "🖨️ Imprimir",
        denyButtonText: "📥 Descargar PDF",
        cancelButtonText: "🔄 Nueva Orden",
        showCloseButton: true,
        allowOutsideClick: true,
        allowEscapeKey: true,
        buttonsStyling: false,
        customClass: {
          confirmButton: "btn btn-primary",
          denyButton: "btn btn-success",
          cancelButton: "btn btn-secondary",
          popup: "swal-popup-custom",
          title: "swal-title-custom",
        },
      }).then(async (result) => {
        if (result.isConfirmed) {
          // Imprimir PDF
          try {
            await openPdf(`/comprobantes/${r.comprobanteId}/pdf?disposition=inline&organizacionId=${organizacionId}`);
          } catch (error) {
            Swal.fire({
              title: "Error",
              text: getErrorMessage(error),
              icon: "error",
            });
          }
        } else if (result.isDenied) {
          // Descargar PDF
          try {
            await downloadPdf(
              `/comprobantes/${r.comprobanteId}/pdf?disposition=attachment&organizacionId=${organizacionId}`,
              r.filename || `orden-pago-${r.comprobanteNumero || r.comprobanteId}.pdf`
            );
          } catch (error) {
            Swal.fire({
              title: "Error",
              text: getErrorMessage(error),
              icon: "error",
            });
          }
        } else if (result.dismiss === Swal.DismissReason.cancel) {
          // Nueva orden de pago
          resetAll();
        }
      });

      // Agregar estilos personalizados al modal si no existen
      if (!document.getElementById("swal-custom-styles")) {
        const style = document.createElement("style");
        style.id = "swal-custom-styles";
        style.textContent = `
          .swal-popup-custom {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
          }
          .swal-title-custom {
            color: #059669 !important;
            font-weight: 700 !important;
          }
          .swal2-popup .btn {
            margin: 0 8px !important;
            padding: 10px 20px !important;
            border-radius: 6px !important;
            font-weight: 500 !important;
            border: 1px solid transparent !important;
            display: inline-flex !important;
            align-items: center !important;
            gap: 8px !important;
            text-decoration: none !important;
            cursor: pointer !important;
            transition: all 0.2s ease !important;
          }
          .swal2-popup .btn-primary {
            background: #3b82f6 !important;
            color: white !important;
            border-color: #3b82f6 !important;
          }
          .swal2-popup .btn-primary:hover {
            background: #2563eb !important;
            border-color: #2563eb !important;
          }
          .swal2-popup .btn-success {
            background: #10b981 !important;
            color: white !important;
            border-color: #10b981 !important;
          }
          .swal2-popup .btn-success:hover {
            background: #059669 !important;
            border-color: #059669 !important;
          }
          .swal2-popup .btn-secondary {
            background: #6b7280 !important;
            color: white !important;
            border-color: #6b7280 !important;
          }
          .swal2-popup .btn-secondary:hover {
            background: #4b5563 !important;
            border-color: #4b5563 !important;
          }
          .swal-title-error {
            color: #dc2626 !important;
            font-weight: 700 !important;
          }
        `;
        document.head.appendChild(style);
      }

      // Refrescar pendientes
      if (rol === "REINTEGROS" && afiliadoSeleccionado) {
        const raw = await api<{ items: any[] }>(
          `/reintegros/solicitudes?afiliadoId=${afiliadoSeleccionado.id}&estado=APROBADO&pageSize=200`
        );
        const reintegros = (raw?.items ?? []).filter((r: any) => {
          // Excluir reintegros pagados (estado PAGADO)
          if (r.estado === 'PAGADO') return false;
          
          // Solo reintegros que no tienen pagos con ordenPagoId
          const tienePagosConOrden = r.pagos && r.pagos.some((p: any) => p.ordenPagoId);
          if (tienePagosConOrden) return false;
          
          // Calcular saldo para verificar si está completamente pagado
          const montoReintegro =
            r.importeReintegro != null
              ? Number(r.importeReintegro)
              : r.importeAprobado != null
                ? Number(r.importeAprobado)
                : Number(r.importeTotal ?? 0);
          
            // Calcular total pagado (incluyendo todos los pagos, con o sin ordenPagoId)
            const totalPagado = (r.pagos ?? [])
              .reduce((acc: number, p: any) => acc + Number(p.monto ?? 0), 0);
            
            const saldo = Math.max(0, montoReintegro - totalPagado);
            
            // Excluir si el saldo es 0 o negativo
            return saldo > 0.000001;
        });

        const data: Pendiente[] = reintegros.map((r: any) => {
          const montoReintegro =
            r.importeReintegro != null
              ? Number(r.importeReintegro)
              : r.importeAprobado != null
                ? Number(r.importeAprobado)
                : Number(r.importeTotal ?? 0);

          // Calcular total pagado (incluyendo todos los pagos)
          const totalPagado = (r.pagos ?? [])
            .reduce((acc: number, p: any) => acc + Number(p.monto ?? 0), 0);
          
          // Calcular aplicado previo solo desde pagos sin ordenPagoId (para mostrar en la UI)
          const aplicadoPrevio = (r.pagos ?? [])
            .filter((p: any) => !p.ordenPagoId)
            .reduce((acc: number, p: any) => acc + Number(p.monto ?? 0), 0);

          const saldo = Math.max(0, montoReintegro - totalPagado);

          return {
            id: `REINTEGRO-${r.id}`,
            tipo: "PRESTACION",
            clase: null,
            numero: `REINT-${r.id}`,
            fecha: r.fechaFactura || r.fechaPresentacion || new Date().toISOString(),
            total: montoReintegro,
            aplicadoPrevio,
            saldo,
          };
        });

        setPendientes(data.filter((p) => p.saldo > 0.000001));
      } else if (tercero) {
        const raw = await api<any[]>(
          `/terceros/comprobantes/pendientes?terceroId=${tercero.id}&rol=${rol}&limit=200`
        );
        const data: Pendiente[] = (raw ?? []).map((p) => ({
          id: String(p.id),
          tipo: p.tipo,
          clase: p.clase ?? null,
          numero: p.numero ?? null,
          fecha: p.fecha,
          total: Number(p.total ?? 0),
          aplicadoPrevio: Number(p.aplicadoPrevio ?? 0),
          saldo: Number(p.saldo ?? 0),
        }));
        setPendientes(data);
      }

      setAplics([]);
      setMetodos([{ metodo: "transferencia", monto: 0 }]);
      setObs("");
    } catch (e) {
      const errorMsg = getErrorMessage(e);
      setMsg(`ERROR:${errorMsg}`);

      // Mostrar error con SweetAlert
      await Swal.fire({
        title: "❌ Error al Crear Orden de Pago",
        html: `
          <div style="text-align: left; font-size: 14px;">
            <div style="background: #fef2f2; border: 1px solid #ef4444; border-radius: 8px; padding: 16px;">
              <p style="margin: 0; color: #991b1b; font-weight: 500;">
                ${errorMsg.replace(/\n/g, "<br>")}
              </p>
            </div>
          </div>
        `,
        icon: "error",
        width: "500px",
        confirmButtonText: "Cerrar",
        buttonsStyling: false,
        customClass: {
          confirmButton: "btn btn-primary",
          popup: "swal-popup-custom",
          title: "swal-title-error",
        },
      });

      // En caso de error también desplazarse hacia arriba para ver el mensaje
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }, 100);
    } finally {
      setPosting(false);
    }
  };

  const getMetodoIcon = (metodo: MetodoPago) => {
    switch (metodo) {
      case "transferencia":
        return <Building size={16} />;
      case "cheque":
        return <Receipt size={16} />;
      case "efectivo":
        return <DollarSign size={16} />;
      default:
        return <CreditCard size={16} />;
    }
  };

  const getMetodoLabel = (metodo: MetodoPago) => {
    switch (metodo) {
      case "transferencia":
        return "Transferencia";
      case "cheque":
        return "Cheque";
      case "efectivo":
        return "Efectivo";
      default:
        return "Otro";
    }
  };

  const handlePrint = async () => {
    if (compId) {
      try {
        await openPdf(`/comprobantes/${compId}/pdf?disposition=inline&organizacionId=${organizacionId}`);
      } catch (error) {
        setMsg(`ERROR:${getErrorMessage(error)}`);
      }
    }
  };

  const handleDownload = async () => {
    if (compId) {
      try {
        await downloadPdf(
          `/comprobantes/${compId}/pdf?disposition=attachment&organizacionId=${organizacionId}`,
          compFilename || `orden-pago-${compNumero || compId}.pdf`
        );
      } catch (error) {
        setMsg(`ERROR:${getErrorMessage(error)}`);
      }
    }
  };

  const handleView = async () => {
    if (compId) {
      try {
        await openPdf(`/comprobantes/${compId}/pdf?disposition=inline&organizacionId=${organizacionId}`);
      } catch (error) {
        setMsg(`ERROR:${getErrorMessage(error)}`);
      }
    }
  };

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-title-section">
          <h1 className="page-title">Nueva Orden de Pago</h1>
          <p className="page-subtitle">
            Registra pagos y aplicaciones a comprobantes pendientes
          </p>
        </div>
      </div>

      {/* Enhanced Message System */}
      {messageInfo && (
        <div
          className={`alert ${messageInfo.type === "error"
              ? "alert-error"
              : messageInfo.type === "success"
                ? "alert-success"
                : "alert-info"
            }`}
        >
          <div className="alert-content">
            <div className="alert-icon">
              {messageInfo.type === "error" && <XCircle size={20} />}
              {messageInfo.type === "success" && <CheckCircle size={20} />}
              {messageInfo.type === "info" && <Info size={20} />}
            </div>
            <div className="alert-text">{messageInfo.content}</div>
            <button
              className="alert-close"
              onClick={() => setMsg(null)}
              aria-label="Cerrar mensaje"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Comprobante Generado - Panel Destacado */}
      {compId && (
        <div
          className="form-section"
          style={{
            background: "var(--success-50)",
            border: "1px solid var(--success-200)",
          }}
        >
          <div className="form-section-header">
            <div>
              <h2
                className="form-section-title"
                style={{ color: "var(--success-700)" }}
              >
                <CheckCircle size={20} />
                Orden de Pago Creada Exitosamente
              </h2>
              <p
                className="form-section-subtitle"
                style={{ color: "var(--success-600)" }}
              >
                {compNumero ? `Comprobante N° ${compNumero}` : `ID ${compId}`}
                {compFilename && ` · ${compFilename}`} · Total: $
                {fmt(totalMetodos)}
              </p>
            </div>
          </div>

          {/* Acciones del comprobante */}
          <div
            style={{
              display: "flex",
              gap: "12px",
              flexWrap: "wrap",
              justifyContent: "center",
              marginBottom: "16px",
            }}
          >
            {compId && (
              <button
                className="btn btn-success"
                onClick={handleDownload}
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <Download size={16} />
                Descargar PDF
              </button>
            )}

            <button
              className="btn btn-success"
              onClick={handlePrint}
              disabled={!compId}
              style={{ display: "flex", alignItems: "center", gap: "8px" }}
            >
              <Printer size={16} />
              Imprimir
            </button>

            {compId && (
              <button
                className="btn btn-secondary"
                onClick={handleView}
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <Eye size={16} />
                Ver Comprobante
              </button>
            )}

            <button
              className="btn btn-primary"
              onClick={resetAll}
              style={{ display: "flex", alignItems: "center", gap: "8px" }}
            >
              <RefreshCw size={16} />
              Nueva Orden de Pago
            </button>
          </div>

          {/* Información resumida del comprobante */}
          <div
            className="alert alert-success"
            style={{
              margin: "0",
              background: "var(--success-100)",
              border: "1px solid var(--success-300)",
            }}
          >
            <div className="alert-content">
              <div className="alert-icon">
                <Info size={20} />
              </div>
              <div className="alert-text">
                <strong>Comprobante generado:</strong> El PDF se abrió
                automáticamente en una nueva pestaña. Use los botones de arriba
                para descargar, imprimir o ver nuevamente el comprobante.
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="page-content">
        {/* Información General */}
        <div className="form-section">
          <div className="form-section-header">
            <div>
              <h2 className="form-section-title">
                <FileText size={20} />
                Información General
              </h2>
              <p className="form-section-subtitle">
                Datos básicos de la orden de pago
              </p>
            </div>
          </div>

          <div className="form-grid form-grid-4">
            <div className="form-group">
              <label className="form-label">
                <Building size={16} />
                Organización
              </label>
              <input
                className="form-input"
                value={organizacionId}
                onChange={(e) => setOrg(e.target.value)}
                placeholder="ID de organización"
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <Users size={16} />
                Rol del Tercero
              </label>
              <select
                className="form-select"
                value={rol}
                onChange={(e) => {
                  const newRol = e.target.value as RolTercero;
                  setRol(newRol);
                  // Limpiar selecciones al cambiar de rol
                  if (newRol !== "REINTEGROS") {
                    setAfiliadoSeleccionado(null);
                  }
                  if (newRol !== rol && newRol !== "REINTEGROS") {
                    setTercero(null);
                  }
                }}
              >
                <option value="PROVEEDOR">Proveedor</option>
                <option value="PRESTADOR">Prestador</option>
                <option value="COMERCIO">Comercio</option>
                <option value="AFILIADO">Afiliado</option>
                <option value="REINTEGROS">Reintegros</option>
                <option value="OTRO">Otro</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">
                <Calendar size={16} />
                Fecha
              </label>
              <input
                className="form-input"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <FileText size={16} />
                Observaciones
              </label>
              <input
                className="form-input"
                value={observaciones}
                onChange={(e) => setObs(e.target.value)}
                placeholder="Notas adicionales..."
              />
            </div>
          </div>

          <div className="form-grid form-grid-2">
            {rol === "REINTEGROS" ? (
              <AutocompleteAfiliado
                onSelect={setAfiliadoSeleccionado}
                selectedAfiliado={afiliadoSeleccionado}
              />
            ) : (
              <AutocompleteTercero
                rol={rol}
                onSelect={setTercero}
                selectedTercero={tercero}
              />
            )}
          </div>
        </div>



        {/* Comprobantes Pendientes */}
        <div className="form-section">
          <div className="form-section-header">
            <div>
              <h2 className="form-section-title">
                <Receipt size={20} />
                Comprobantes Pendientes
              </h2>
              <p className="form-section-subtitle">
                {tercero
                  ? `Saldos pendientes de ${tercero.nombre}`
                  : "Selecciona un tercero para ver sus pendientes"}
              </p>
            </div>
            <div className="status-badge">
              {pendLoading ? (
                <>
                  <Loader2 className="spinner" size={16} />
                  Cargando...
                </>
              ) : (
                `${pendientes.length} pendientes`
              )}
            </div>
          </div>

          {(rol === "REINTEGROS" && afiliadoSeleccionado) || (rol !== "REINTEGROS" && tercero) ? (
            <>
              {pendientes.length > 0 ? (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Fecha</th>
                        <th>Tipo</th>
                        <th>Número</th>
                        <th className="table-col-numeric">Total</th>
                        <th className="table-col-numeric">Aplicado</th>
                        <th className="table-col-numeric">Saldo</th>
                        <th className="table-col-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendientes.map((p) => {
                        const isApplied = aplicaciones.some(
                          (a) => a.comprobanteId === p.id
                        );
                        return (
                          <tr
                            key={p.id}
                            className={isApplied ? "row-applied" : ""}
                          >
                            <td>
                              <span className="id-badge">{p.id}</span>
                            </td>
                            <td>
                              {formatearFechaArgentina(p.fecha)}
                            </td>
                            <td>
                              <span className="type-badge">
                                {p.id.startsWith('REINTEGRO-') ? 'Reintegro' : p.tipo}
                              </span>
                            </td>
                            <td>{p.numero || "—"}</td>
                            <td className="table-col-numeric">
                              ${fmt(p.total)}
                            </td>
                            <td className="table-col-numeric">
                              ${fmt(p.aplicadoPrevio)}
                            </td>
                            <td className="table-col-numeric">
                              <strong>${fmt(p.saldo)}</strong>
                            </td>
                            <td className="table-col-center">
                              <button
                                className={`btn btn-sm ${isApplied ? "btn-applied" : "btn-secondary"
                                  }`}
                                onClick={() => pickPendiente(p)}
                                disabled={isApplied}
                                title={
                                  isApplied
                                    ? "Ya aplicado"
                                    : "Aplicar a la orden"
                                }
                                type="button"
                              >
                                {isApplied ? (
                                  <CheckCircle size={16} />
                                ) : (
                                  <Plus size={16} />
                                )}
                                {isApplied ? "Aplicado" : "Aplicar"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state warning">
                  <div className="empty-state-icon">
                    <AlertCircle size={48} />
                  </div>
                  <div className="empty-state-title">
                    Sin comprobantes pendientes
                  </div>
                  <div className="empty-state-text">
                    No hay comprobantes pendientes para este tercero/rol. No se
                    puede crear la orden de pago sin comprobantes con saldo.
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">
                <User size={48} />
              </div>
              <div className="empty-state-title">
                {rol === "REINTEGROS" ? "Selecciona un afiliado" : "Selecciona un tercero"}
              </div>
              <div className="empty-state-text">
                {rol === "REINTEGROS"
                  ? "Busca y selecciona un afiliado para ver sus reintegros aprobados"
                  : "Busca y selecciona un tercero para ver sus comprobantes pendientes de pago"}
              </div>
            </div>
          )}
        </div>

        {/* Aplicaciones */}
        <div className="form-section">
          <div className="form-section-header">
            <div>
              <h2 className="form-section-title">
                <CheckCircle size={20} />
                Aplicaciones
              </h2>
              <p className="form-section-subtitle">
                Comprobantes seleccionados para pagar
              </p>
            </div>
            <div className="status-badge primary">
              Total: ${fmt(totalAplic)}
            </div>
          </div>

          {aplicaciones.length > 0 ? (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Fecha</th>
                    <th>Número</th>
                    <th className="table-col-numeric">Saldo</th>
                    <th className="table-col-numeric">Monto a Aplicar</th>
                    <th className="table-col-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {aplicaciones.map((ap, i) => (
                    <tr key={`${ap.comprobanteId}-${i}`}>
                      <td>
                        <span className="id-badge">{ap.comprobanteId}</span>
                      </td>
                      <td>
                        {ap.fecha ? formatearFechaArgentina(ap.fecha) : "—"}
                      </td>
                      <td>{ap.numero || "—"}</td>
                      <td className="table-col-numeric">
                        ${fmt(ap.saldo || 0)}
                      </td>
                      <td>
                        <input
                          className="table-input table-input-numeric"
                          type="number"
                          value={ap.montoAplicado}
                          min={0}
                          max={ap.saldo}
                          step="0.01"
                          onChange={(e) =>
                            updAplic(i, {
                              montoAplicado: Number(e.target.value),
                            })
                          }
                          placeholder="0.00"
                        />
                      </td>
                      <td className="table-col-center">
                        <button
                          className="btn-icon btn-icon-danger"
                          onClick={() => delAplic(i)}
                          title="Quitar de aplicaciones"
                          type="button"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">
                <FileText size={48} />
              </div>
              <div className="empty-state-title">Sin aplicaciones</div>
              <div className="empty-state-text">
                Selecciona comprobantes pendientes para aplicar el pago
              </div>
            </div>
          )}
        </div>

        {/* Métodos de Pago */}
        <div className="form-section">
          <div className="form-section-header">
            <div>
              <h2 className="form-section-title">
                <CreditCard size={20} />
                Métodos de Pago
              </h2>
              <p className="form-section-subtitle">Formas de pago utilizadas</p>
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={addMetodo}
              type="button"
            >
              <Plus size={16} />
              Agregar Método
            </button>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Método</th>
                  <th className="table-col-numeric">Monto</th>
                  <th>Referencia</th>
                  <th className="table-col-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {metodos.map((m, i) => (
                  <tr key={i}>
                    <td>
                      <div className="method-selector">
                        <span className="method-icon">
                          {getMetodoIcon(m.metodo)}
                        </span>
                        <select
                          className="table-select"
                          value={m.metodo}
                          onChange={(e) =>
                            updMetodo(i, {
                              metodo: e.target.value as MetodoPago,
                            })
                          }
                        >
                          <option value="transferencia">Transferencia</option>
                          <option value="cheque">Cheque</option>
                          <option value="efectivo">Efectivo</option>
                          <option value="otro">Otro</option>
                        </select>
                      </div>
                    </td>
                    <td>
                      <input
                        className="table-input table-input-numeric"
                        type="number"
                        value={m.monto}
                        onChange={(e) =>
                          updMetodo(i, { monto: Number(e.target.value) })
                        }
                        min={0}
                        step="0.01"
                        placeholder="0.00"
                      />
                    </td>
                    <td>
                      <input
                        className="table-input"
                        value={m.ref || ""}
                        onChange={(e) => updMetodo(i, { ref: e.target.value })}
                        placeholder="N° cheque, CBU, etc."
                      />
                    </td>
                    <td className="table-col-center">
                      <button
                        className="btn-icon btn-icon-danger"
                        onClick={() => delMetodo(i)}
                        title="Eliminar método"
                        type="button"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2} className="table-col-numeric">
                    <strong>Total Métodos: ${fmt(totalMetodos)}</strong>
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Resumen y Confirmación */}
        <div className="totals-section">
          <div className="payment-summary">
            <div className="summary-section">
              <h3 className="summary-title">
                <DollarSign size={20} />
                Resumen de Pagos
              </h3>
              <div className="summary-items">
                <div className="summary-item">
                  <span className="summary-label">Total Métodos de Pago</span>
                  <span className="summary-value">${fmt(totalMetodos)}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Total Aplicaciones</span>
                  <span className="summary-value">${fmt(totalAplic)}</span>
                </div>
                <div
                  className={`summary-item ${totalMetodos === totalAplic ? "balanced" : "unbalanced"
                    }`}
                >
                  <span className="summary-label">Diferencia</span>
                  <span className="summary-value">
                    ${fmt(Math.abs(totalMetodos - totalAplic))}
                    {totalMetodos !== totalAplic && (
                      <span className="balance-indicator">
                        {totalMetodos > totalAplic ? " (Sobra)" : " (Falta)"}
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {totalMetodos !== totalAplic && (
                <div className="balance-warning">
                  <div className="balance-warning-icon">
                    <AlertCircle size={16} />
                  </div>
                  <div className="balance-warning-text">
                    Los métodos de pago deben sumar exactamente igual que las
                    aplicaciones
                  </div>
                </div>
              )}
            </div>

            <div className="submit-section">
              <button
                className={`btn btn-lg ${canSubmit ? "btn-success" : "btn-disabled"
                  }`}
                onClick={submit}
                disabled={!canSubmit}
                type="button"
              >
                {posting ? (
                  <>
                    <Loader2 className="spinner" size={20} />
                    Procesando...
                  </>
                ) : (
                  <>
                    <CheckCircle size={20} />
                    Crear Orden de Pago
                  </>
                )}
              </button>

              {!canSubmit && (
                <div className="submit-help">
                  {rol === "REINTEGROS"
                    ? !afiliadoSeleccionado
                      ? "Selecciona un afiliado"
                      : pendientes.length === 0
                        ? "No hay reintegros aprobados"
                        : aplicaciones.length === 0
                          ? "Agrega al menos una aplicación"
                          : totalMetodos !== totalAplic
                            ? "Los totales deben coincidir"
                            : "Completa todos los campos requeridos"
                    : !tercero
                      ? "Selecciona un tercero"
                      : pendientes.length === 0
                        ? "No hay comprobantes pendientes"
                        : aplicaciones.length === 0
                          ? "Agrega al menos una aplicación"
                          : totalMetodos !== totalAplic
                            ? "Los totales deben coincidir"
                            : "Completa todos los campos requeridos"}
                </div>
              )}

              <div className="submit-note">
                <span className="note-icon">
                  <Info size={16} />
                </span>
                Puedes aplicar menos que el total del comprobante. El resto
                quedará como saldo pendiente.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
