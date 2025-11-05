/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import { api, getErrorMessage } from "@/servicios/api";
import type {
  CrearPadronDto,
  CrearPadronResp,
  CrearAfiliadoDto,
  ColateralMinDto,
  Sistema,
} from "@/tipos/dtos";
import {
  Search,
  User,
  UserPlus,
  FileText,
  Calendar,
  Users,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  CheckCircle,
  XCircle,
  Info,
  AlertCircle,
  Loader2,
  Phone,
  MapPin,
  CreditCard,
} from "lucide-react";
import { usePadronMask } from "@/hooks/usePadronMask";

const SISTEMAS: Sistema[] = ["ESC", "SGR", "SG"];

// Types
type AfiliadoSuggest = {
  id: string | number;
  dni: string | number;
  display: string;
};

type CoseguroCfg = {
  id?: string | number;
  padronCoseguro?: { id: string | number; padron: string } | null;
  padronColat?: { id: string | number; padron: string } | null;
};

type ColateralUI = {
  parentescoId: string;
  nombre: string;
  fechaNacimiento?: string;
  activo?: boolean;
};

function useDebouncedValue<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function isLikelyDni(s: string) {
  return /^\d{6,}$/.test(s);
}

function splitApeNom(raw: string) {
  const s = (raw ?? "").trim().replace(/\s+/g, " ");
  if (!s) return { apellido: "", nombre: "" };
  const coma = s.indexOf(",");
  if (coma > -1) {
    const ape = s.slice(0, coma).trim();
    const nom = s.slice(coma + 1).trim();
    return { apellido: ape, nombre: nom };
  }
  const parts = s.split(" ");
  if (parts.length === 1) return { apellido: parts[0], nombre: "" };
  return { apellido: parts[0], nombre: parts.slice(1).join(" ") };
}

export default function NuevoPadronPage() {
  const padronMask = usePadronMask();

  // Autocomplete (buscador)
  const [buscador, setBuscador] = useState("");
  const debounced = useDebouncedValue(buscador, 300);
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<AfiliadoSuggest[]>([]);
  const [buscaMsg, setBuscaMsg] = useState<string | null>(null);

  // Selección / estado
  const [afiliado, setAfiliado] = useState<AfiliadoSuggest | null>(null);
  const [sinResultadosDniExacto, setSinResultadosDniExacto] = useState<
    string | null
  >(null);

  // Coseguro
  const [tieneCoseguro, setTieneCoseguro] = useState<boolean | null>(null);
  const [cargandoCoseguro, setCargandoCoseguro] = useState(false);

  // Form padrón
  const [padron, setPadron] = useState("");
  const [centro, setCentro] = useState("");
  const [sector, setSector] = useState("");
  const [clase, setClase] = useState("");
  const [situacion, setSituacion] = useState("");
  const [fechaAlta, setFechaAlta] = useState("");
  const [fechaBaja, setFechaBaja] = useState("");
  const [activo, setActivo] = useState(true);
  const [j17, setJ17] = useState("");
  const [j22, setJ22] = useState("");
  const [j38, setJ38] = useState("");
  const [k16, setK16] = useState("");
  const [motivoBaja, setMotivoBaja] = useState("");
  const [cajaAhorro, setCajaAhorro] = useState("");
  const [beneficiarioJubilado, setBeneficiarioJubilado] = useState("");
  const [sistema, setSistema] = useState<Sistema | "">("");
  const [sueldoBasico, setSueldoBasico] = useState("");
  const [cupo, setCupo] = useState("");
  const [saldo, setSaldo] = useState("");

  // Alta combinada: afiliado nuevo
  const [dniNuevo, setDniNuevo] = useState("");
  const [apeNom, setApeNom] = useState("");
  const [apellNuevo, setApellNuevo] = useState("");
  const [nombNuevo, setNombNuevo] = useState("");
  const [cuit, setCuit] = useState("");
  const [sexo, setSexo] = useState<CrearAfiliadoDto["sexo"]>(undefined);
  const [tipo, setTipo] = useState<CrearAfiliadoDto["tipo"]>(undefined);
  const [telefono, setTelefono] = useState("");
  const [celular, setCelular] = useState("");
  const [calle, setCalle] = useState("");
  const [numero, setNumero] = useState("");
  const [orientacion, setOrientacion] = useState("");
  const [barrio, setBarrio] = useState("");
  const [piso, setPiso] = useState("");
  const [depto, setDepto] = useState("");
  const [monoblock, setMonoblock] = useState("");
  const [casa, setCasa] = useState("");
  const [manzana, setManzana] = useState("");
  const [localidad, setLocalidad] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [numeroSocio, setNumeroSocio] = useState("");
  const [cupoAf, setCupoAf] = useState("");
  const [saldoAf, setSaldoAf] = useState("");
  const [observaciones, setObservaciones] = useState("");

  // UI: coseguro + colaterales
  const [crearCoseguro, setCrearCoseguro] = useState(false);
  const [colaterales, setColaterales] = useState<ColateralUI[]>([]);

  const [msg, setMsg] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);

  const creandoConAfiliadoExistente = !!afiliado;
  const creandoConAfiliadoNuevo = !afiliado && !!sinResultadosDniExacto;

  const canCrear = useMemo(() => {
    if (creando) return false;
    if (padronMask.value.trim().length === 0) return false; // ← Usar padronMask.value

    if (creandoConAfiliadoExistente) return true;

    if (creandoConAfiliadoNuevo) {
      const tieneNombre =
        apellNuevo.trim().length > 0 ||
        nombNuevo.trim().length > 0 ||
        apeNom.trim().length > 0;
      const dniOk = /^\d{6,}$/.test(dniNuevo.trim());
      return dniOk && tieneNombre;
    }
    return false;
  }, [
    creando,
    padronMask.value, // ← Cambiar esta dependencia
    creandoConAfiliadoExistente,
    creandoConAfiliadoNuevo,
    dniNuevo,
    apellNuevo,
    nombNuevo,
    apeNom,
  ]);

  const opt = (s: string) => (s?.trim() ? s.trim() : undefined);
  const numOpt = (s: string) => (s?.trim() ? Number(s) : undefined);

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

  // Buscar afiliados
  useEffect(() => {
    let cancelled = false;
    const q = debounced.trim();
    if (!q) {
      setResultados([]);
      setBuscaMsg(null);
      setSinResultadosDniExacto(null);
      setAfiliado(null);
      return;
    }
    (async () => {
      setBuscando(true);
      setBuscaMsg(null);
      setResultados([]);
      setSinResultadosDniExacto(null);
      setAfiliado(null);
      try {
        const res = await api<AfiliadoSuggest[]>(
          `/afiliados/suggest?q=${encodeURIComponent(q)}`,
          { method: "GET" }
        );
        if (cancelled) return;

        setResultados(res ?? []);
        if (!res?.length) {
          setBuscaMsg("Sin resultados.");
          if (isLikelyDni(q)) {
            setSinResultadosDniExacto(q);
            setDniNuevo(q);
          }
        }
      } catch (e: unknown) {
        if (!cancelled)
          setBuscaMsg(`Error buscando afiliados: ${getErrorMessage(e)}`);
      } finally {
        if (!cancelled) setBuscando(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  // Verificar coseguro
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCrearCoseguro(false);
      setColaterales([]);
      setTieneCoseguro(null);
      if (!afiliado) return;
      setCargandoCoseguro(true);
      try {
        const cfg = await api<CoseguroCfg | null>(
          `/afiliados/${encodeURIComponent(String(afiliado.id))}/coseguro`,
          { method: "GET" }
        );
        if (cancelled) return;
        setTieneCoseguro(!!cfg);
      } catch {
        if (!cancelled) setTieneCoseguro(false);
      } finally {
        if (!cancelled) setCargandoCoseguro(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [afiliado]);

  const limpiarPadron = () => {
    setPadron("");
    setCentro("");
    setSector("");
    setClase("");
    setSituacion("");
    setFechaAlta("");
    setFechaBaja("");
    setActivo(true);
    setJ17("");
    setJ22("");
    setJ38("");
    setK16("");
    setMotivoBaja("");
    setCajaAhorro("");
    setBeneficiarioJubilado("");
    setSistema("");
    setSueldoBasico("");
    setCupo("");
    setSaldo("");
    setCrearCoseguro(false);
    setColaterales([]);
  };

  const limpiarTodo = () => {
    setBuscador("");
    setResultados([]);
    setBuscaMsg(null);
    setSinResultadosDniExacto(null);
    setAfiliado(null);
    limpiarPadron();
    setDniNuevo("");
    setApeNom("");
    setApellNuevo("");
    setNombNuevo("");
    setCuit("");
    setSexo(undefined);
    setTipo(undefined);
    setTelefono("");
    setCelular("");
    setCalle("");
    setNumero("");
    setOrientacion("");
    setBarrio("");
    setPiso("");
    setDepto("");
    setMonoblock("");
    setCasa("");
    setManzana("");
    setLocalidad("");
    setFechaNacimiento("");
    setNumeroSocio("");
    setCupoAf("");
    setSaldoAf("");
    setObservaciones("");
    setMsg(null);
  };

  const addColateral = () => {
    setColaterales((prev) => [
      ...prev,
      { parentescoId: "", nombre: "", fechaNacimiento: "" },
    ]);
  };

  const updateColateral = (idx: number, patch: Partial<ColateralUI>) => {
    setColaterales((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, ...patch } : c))
    );
  };

  const removeColateral = (idx: number) => {
    setColaterales((prev) => prev.filter((_, i) => i !== idx));
  };

  const crearPadron = async () => {
    setMsg(null);
    setCreando(true);
    try {
      // --- Normalizar + validar padrón desde la máscara ---
      const raw = String(padronMask?.value ?? "");
      const digits = raw.replace(/\D+/g, "");
      if (digits.length !== 7) {
        throw new Error(
          "El código de padrón debe tener 7 dígitos (6 + DV). Ej: 123456-7"
        );
      }
      const padronNorm = `${digits.slice(0, 6)}-${digits.slice(6)}`;

      const base = {
        padron: padronNorm, // 👈 usar SIEMPRE el normalizado
        centro: numOpt(centro),
        sector: numOpt(sector),
        clase: opt(clase),
        situacion: opt(situacion),
        fechaAlta: opt(fechaAlta),
        fechaBaja: opt(fechaBaja),
        activo,
        j17: opt(j17),
        j22: opt(j22),
        j38: opt(j38),
        k16: opt(k16),
        motivoBaja: opt(motivoBaja),
        cajaAhorro: opt(cajaAhorro),
        beneficiarioJubilado: opt(beneficiarioJubilado),
        sistema: (sistema || undefined) as Sistema | undefined,
        sueldoBasico: opt(sueldoBasico),
        cupo: opt(cupo),
        saldo: opt(saldo),
      };

      let payload: CrearPadronDto;

      if (creandoConAfiliadoExistente && afiliado) {
        payload = { ...base, afiliadoId: Number(afiliado.id) };

        if (tieneCoseguro === false && crearCoseguro) {
          payload.crearCoseguro = true;
          const rows: ColateralMinDto[] = colaterales
            .map((c) => ({
              parentescoId: c.parentescoId?.trim()
                ? Number(c.parentescoId)
                : (undefined as unknown as number),
              nombre: (c.nombre || "").trim(),
              fechaNacimiento: c.fechaNacimiento?.trim()
                ? c.fechaNacimiento
                : undefined,
              activo: typeof c.activo === "boolean" ? c.activo : undefined,
            }))
            .filter((r) => r.parentescoId && r.nombre) as ColateralMinDto[];
          if (rows.length) payload.colaterales = rows;
        }
      } else if (creandoConAfiliadoNuevo && sinResultadosDniExacto) {
        let apellido = apellNuevo.trim();
        let nombre = nombNuevo.trim();
        if (apeNom.trim()) {
          const { apellido: ape, nombre: nom } = splitApeNom(apeNom);
          if (!apellido) apellido = ape;
          if (!nombre) nombre = nom;
        }

        const afNuevo: CrearAfiliadoDto = {
          dni: Number(dniNuevo),
          apellido,
          nombre,
          cuit: opt(cuit),
          sexo,
          tipo,
          telefono: opt(telefono),
          celular: opt(celular),
          calle: opt(calle),
          numero: opt(numero),
          orientacion: opt(orientacion),
          barrio: opt(barrio),
          piso: opt(piso),
          depto: opt(depto),
          monoblock: opt(monoblock),
          casa: opt(casa),
          manzana: opt(manzana),
          localidad: opt(localidad),
          fechaNacimiento: opt(fechaNacimiento),
          numeroSocio: opt(numeroSocio),
          cupo: opt(cupoAf),
          saldo: opt(saldoAf),
          observaciones: opt(observaciones),
        };

        payload = { ...base, afiliadoNuevo: afNuevo };

        if (crearCoseguro) {
          payload.crearCoseguro = true;
          const rows: ColateralMinDto[] = colaterales
            .map((c) => ({
              parentescoId: c.parentescoId?.trim()
                ? Number(c.parentescoId)
                : (undefined as unknown as number),
              nombre: (c.nombre || "").trim(),
              fechaNacimiento: c.fechaNacimiento?.trim()
                ? c.fechaNacimiento
                : undefined,
              activo: typeof c.activo === "boolean" ? c.activo : undefined,
            }))
            .filter((r) => r.parentescoId && r.nombre) as ColateralMinDto[];
          if (rows.length) payload.colaterales = rows;
        }
      } else {
        throw new Error(
          "Seleccioná un afiliado o ingresá un DNI válido para crear uno nuevo."
        );
      }

      const r = await api<CrearPadronResp>("/padrones", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setMsg(
        `SUCCESS:Padrón creado (ID ${String(r.id)})${
          crearCoseguro ? " + coseguro configurado" : ""
        }`
      );
      limpiarTodo();
    } catch (e: unknown) {
      setMsg(`ERROR:${getErrorMessage(e)}`);
    } finally {
      setCreando(false);
    }
  };
  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-title-section">
          <h1 className="page-title">Nuevo Padrón</h1>
          <p className="page-subtitle">
            Busque un afiliado existente o cree uno nuevo junto con su padrón
          </p>
        </div>
      </div>

      {/* Enhanced Message System */}
      {messageInfo && (
        <div
          className={`alert ${
            messageInfo.type === "error"
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

      <div className="page-content">
        {/* Búsqueda de Afiliado */}
        <div className="form-section">
          <div className="form-section-header">
            <div>
              <h2 className="form-section-title">
                <Search size={20} />
                Buscar Afiliado
              </h2>
              <p className="form-section-subtitle">
                Ingrese DNI, apellido o nombre para buscar un afiliado existente
              </p>
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Búsqueda</label>
              <div className="form-input-group">
                <Search className="form-input-icon" size={16} />
                <input
                  className="form-input form-input-with-icon"
                  placeholder="Ej: 30123456 o 'Gomez' o 'Gomez Juan'"
                  value={buscador}
                  onChange={(e) => setBuscador(e.target.value)}
                />
                {buscador && (
                  <button
                    className="form-input-clear"
                    onClick={() => setBuscador("")}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          </div>

          {buscando && (
            <div className="loading-indicator">
              <Loader2 className="spinner" size={16} />
              <span>Buscando...</span>
            </div>
          )}

          {buscaMsg && !buscando && (
            <div className="alert alert-info">
              <div className="alert-content">
                <div className="alert-icon">
                  <Info size={16} />
                </div>
                <div className="alert-text">{buscaMsg}</div>
              </div>
            </div>
          )}

          {/* Resultados de búsqueda */}
          {resultados.length > 0 && (
            <div style={{ marginTop: "16px" }}>
              <h4
                style={{
                  margin: "0 0 12px 0",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "var(--text-secondary)",
                }}
              >
                Resultados encontrados ({resultados.length})
              </h4>
              <div
                className="autocomplete-dropdown"
                style={{
                  position: "relative",
                  marginTop: "0",
                  border: "1px solid var(--border)",
                  maxHeight: "300px",
                }}
              >
                {resultados.map((a) => (
                  <div
                    key={String(a.id)}
                    className="autocomplete-item"
                    style={{
                      background:
                        afiliado?.id === a.id
                          ? "var(--primary-50)"
                          : "transparent",
                      borderLeft:
                        afiliado?.id === a.id
                          ? "3px solid var(--primary-600)"
                          : "3px solid transparent",
                    }}
                    onClick={() => {
                      setAfiliado(a);
                      setSinResultadosDniExacto(null);
                    }}
                  >
                    <div className="tercero-info">
                      <div className="tercero-nombre">{a.display}</div>
                      <div className="tercero-cuit">DNI {String(a.dni)}</div>
                    </div>
                    {afiliado?.id === a.id && (
                      <div className="status-badge primary">
                        <CheckCircle size={12} />
                        Seleccionado
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Afiliado seleccionado */}
          {afiliado && (
            <div className="tercero-selected-info">
              <div className="tercero-selected-header">
                <div className="tercero-selected-avatar">
                  <User size={20} />
                </div>
                <div className="tercero-selected-details">
                  <div className="tercero-selected-name">
                    {afiliado.display}
                  </div>
                  <div className="tercero-selected-cuit">
                    DNI {String(afiliado.dni)}
                  </div>
                </div>
                <div className="tercero-selected-summary">
                  <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                    {cargandoCoseguro && (
                      <div className="loading-indicator">
                        <Loader2 className="spinner" size={12} />
                        <span>Verificando coseguro...</span>
                      </div>
                    )}
                    {!cargandoCoseguro && tieneCoseguro === true && (
                      <div className="status-badge primary">
                        <CheckCircle size={12} />
                        Tiene coseguro
                      </div>
                    )}
                    {!cargandoCoseguro && tieneCoseguro === false && (
                      <div className="status-badge">
                        <XCircle size={12} />
                        Sin coseguro
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Alta combinada de afiliado nuevo */}
        {!afiliado && sinResultadosDniExacto && (
          <div className="form-section">
            <div className="form-section-header">
              <div>
                <h2 className="form-section-title">
                  <UserPlus size={20} />
                  Crear Nuevo Afiliado
                </h2>
                <p className="form-section-subtitle">
                  No existe un afiliado con DNI {sinResultadosDniExacto}.
                  Complete los datos para crearlo junto con el padrón.
                </p>
              </div>
            </div>

            {/* Información Personal */}
            <div style={{ marginBottom: "24px" }}>
              <h3
                style={{
                  fontSize: "16px",
                  fontWeight: "600",
                  color: "var(--text)",
                  marginBottom: "12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <User size={16} />
                Información Personal
              </h3>
              <div className="form-grid form-grid-3">
                <div className="form-group">
                  <label className="form-label">DNI *</label>
                  <input
                    className="form-input"
                    inputMode="numeric"
                    value={dniNuevo}
                    onChange={(e) =>
                      setDniNuevo(e.target.value.replace(/\D+/g, ""))
                    }
                    placeholder="12345678"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Apellido y Nombre (helper)
                  </label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input
                      className="form-input"
                      value={apeNom}
                      onChange={(e) => setApeNom(e.target.value)}
                      placeholder="PÉREZ, JUAN o PÉREZ JUAN"
                      style={{ flex: "1" }}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        const s = splitApeNom(apeNom);
                        if (!apellNuevo && s.apellido)
                          setApellNuevo(s.apellido);
                        if (!nombNuevo && s.nombre) setNombNuevo(s.nombre);
                      }}
                      style={{ whiteSpace: "nowrap" }}
                    >
                      Separar
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">CUIT/CUIL</label>
                  <input
                    className="form-input"
                    value={cuit}
                    onChange={(e) => setCuit(e.target.value)}
                    placeholder="20-12345678-9"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Apellido</label>
                  <input
                    className="form-input"
                    value={apellNuevo}
                    onChange={(e) => setApellNuevo(e.target.value)}
                    placeholder="Apellido"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Nombre</label>
                  <input
                    className="form-input"
                    value={nombNuevo}
                    onChange={(e) => setNombNuevo(e.target.value)}
                    placeholder="Nombre"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Fecha de Nacimiento</label>
                  <input
                    className="form-input"
                    type="date"
                    value={fechaNacimiento}
                    onChange={(e) => setFechaNacimiento(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Sexo</label>
                  <select
                    className="form-select"
                    value={sexo ?? ""}
                    onChange={(e) =>
                      setSexo(
                        (e.target.value ||
                          undefined) as CrearAfiliadoDto["sexo"]
                      )
                    }
                  >
                    <option value="">Seleccionar</option>
                    <option value="M">Masculino</option>
                    <option value="F">Femenino</option>
                    <option value="X">No binario</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Tipo</label>
                  <select
                    className="form-select"
                    value={tipo ?? ""}
                    onChange={(e) =>
                      setTipo(
                        (e.target.value ||
                          undefined) as CrearAfiliadoDto["tipo"]
                      )
                    }
                  >
                    <option value="">Seleccionar</option>
                    <option value="TITULAR">TITULAR</option>
                    <option value="FAMILIAR">FAMILIAR</option>
                    <option value="JUBILADO">JUBILADO</option>
                    <option value="OTRO">OTRO</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">N° Socio</label>
                  <input
                    className="form-input"
                    value={numeroSocio}
                    onChange={(e) => setNumeroSocio(e.target.value)}
                    placeholder="Opcional"
                  />
                </div>
              </div>
            </div>

            {/* Contacto */}
            <div style={{ marginBottom: "24px" }}>
              <h3
                style={{
                  fontSize: "16px",
                  fontWeight: "600",
                  color: "var(--text)",
                  marginBottom: "12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <Phone size={16} />
                Contacto
              </h3>
              <div className="form-grid form-grid-2">
                <div className="form-group">
                  <label className="form-label">Teléfono</label>
                  <input
                    className="form-input"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="11-1234-5678"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Celular</label>
                  <input
                    className="form-input"
                    value={celular}
                    onChange={(e) => setCelular(e.target.value)}
                    placeholder="11-1234-5678"
                  />
                </div>
              </div>
            </div>

            {/* Domicilio */}
            <div style={{ marginBottom: "24px" }}>
              <h3
                style={{
                  fontSize: "16px",
                  fontWeight: "600",
                  color: "var(--text)",
                  marginBottom: "12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <MapPin size={16} />
                Domicilio
              </h3>
              <div className="form-grid form-grid-4">
                <div className="form-group">
                  <label className="form-label">Calle</label>
                  <input
                    className="form-input"
                    value={calle}
                    onChange={(e) => setCalle(e.target.value)}
                    placeholder="Nombre de la calle"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Número</label>
                  <input
                    className="form-input"
                    value={numero}
                    onChange={(e) => setNumero(e.target.value)}
                    placeholder="1234"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Orientación</label>
                  <input
                    className="form-input"
                    value={orientacion}
                    onChange={(e) => setOrientacion(e.target.value)}
                    placeholder="Entre calles..."
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Barrio</label>
                  <input
                    className="form-input"
                    value={barrio}
                    onChange={(e) => setBarrio(e.target.value)}
                    placeholder="Nombre del barrio"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Piso</label>
                  <input
                    className="form-input"
                    value={piso}
                    onChange={(e) => setPiso(e.target.value)}
                    placeholder="1"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Departamento</label>
                  <input
                    className="form-input"
                    value={depto}
                    onChange={(e) => setDepto(e.target.value)}
                    placeholder="A"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Monoblock</label>
                  <input
                    className="form-input"
                    value={monoblock}
                    onChange={(e) => setMonoblock(e.target.value)}
                    placeholder="1"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Casa</label>
                  <input
                    className="form-input"
                    value={casa}
                    onChange={(e) => setCasa(e.target.value)}
                    placeholder="1"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Manzana</label>
                  <input
                    className="form-input"
                    value={manzana}
                    onChange={(e) => setManzana(e.target.value)}
                    placeholder="A"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Localidad</label>
                  <input
                    className="form-input"
                    value={localidad}
                    onChange={(e) => setLocalidad(e.target.value)}
                    placeholder="Ciudad/Localidad"
                  />
                </div>
              </div>
            </div>

            {/* Información Financiera */}
            <div style={{ marginBottom: "24px" }}>
              <h3
                style={{
                  fontSize: "16px",
                  fontWeight: "600",
                  color: "var(--text)",
                  marginBottom: "12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <CreditCard size={16} />
                Información Financiera
              </h3>
              <div className="form-grid form-grid-2">
                <div className="form-group">
                  <label className="form-label">Cupo</label>
                  <input
                    className="form-input"
                    type="number"
                    step="0.01"
                    value={cupoAf}
                    onChange={(e) => setCupoAf(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Saldo</label>
                  <input
                    className="form-input"
                    type="number"
                    step="0.01"
                    value={saldoAf}
                    onChange={(e) => setSaldoAf(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            {/* Observaciones */}
            <div>
              <h3
                style={{
                  fontSize: "16px",
                  fontWeight: "600",
                  color: "var(--text)",
                  marginBottom: "12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <FileText size={16} />
                Observaciones
              </h3>
              <div className="form-grid">
                <div className="form-group form-group-full">
                  <label className="form-label">Notas adicionales</label>
                  <textarea
                    className="form-textarea"
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    rows={3}
                    placeholder="Información adicional sobre el afiliado..."
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Datos del Padrón */}
        <div
          className="form-section"
          style={{
            opacity: afiliado || sinResultadosDniExacto ? 1 : 0.6,
            pointerEvents: afiliado || sinResultadosDniExacto ? "auto" : "none",
          }}
        >
          <div className="form-section-header">
            <div>
              <h2 className="form-section-title">
                <FileText size={20} />
                Datos del Padrón
              </h2>
              <p className="form-section-subtitle">
                Complete la información específica del padrón
              </p>
            </div>
          </div>

          <div className="form-grid form-grid-3">
            <div className="form-group">
              <label className="form-label">Código de Padrón *</label>
              <input
                className="form-input"
                value={padronMask.value}
                onChange={padronMask.onChange}
                placeholder="000000-0"
                maxLength={8}
                required
              />
              <small className="form-help">
                El guión se agrega automáticamente después del 6º dígito
              </small>
            </div>

            <div className="form-group">
              <label className="form-label">Situación</label>
              <input
                className="form-input"
                value={situacion}
                onChange={(e) => setSituacion(e.target.value)}
                placeholder="TITULAR / SUPLEMENTE / PP / 04"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Sistema</label>
              <select
                className="form-select"
                value={sistema}
                onChange={(e) => setSistema(e.target.value as Sistema | "")}
              >
                <option value="">Seleccionar</option>
                {SISTEMAS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Centro</label>
              <input
                className="form-input"
                inputMode="numeric"
                value={centro}
                onChange={(e) => setCentro(e.target.value.replace(/\D+/g, ""))}
                placeholder="Código de centro"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Sector</label>
              <input
                className="form-input"
                inputMode="numeric"
                value={sector}
                onChange={(e) => setSector(e.target.value.replace(/\D+/g, ""))}
                placeholder="Código de sector"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Clase</label>
              <input
                className="form-input"
                value={clase}
                onChange={(e) => setClase(e.target.value)}
                placeholder="Clase del padrón"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Fecha Alta</label>
              <input
                className="form-input"
                type="date"
                value={fechaAlta}
                onChange={(e) => setFechaAlta(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Fecha Baja</label>
              <input
                className="form-input"
                type="date"
                value={fechaBaja}
                onChange={(e) => setFechaBaja(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Estado</label>
              <div className="form-checkbox">
                <input
                  type="checkbox"
                  checked={activo}
                  onChange={(e) => setActivo(e.target.checked)}
                />
                <span>Padrón activo</span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">J17</label>
              <input
                className="form-input"
                type="number"
                step="0.01"
                value={j17}
                onChange={(e) => setJ17(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="form-group">
              <label className="form-label">J22</label>
              <input
                className="form-input"
                type="number"
                step="0.01"
                value={j22}
                onChange={(e) => setJ22(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="form-group">
              <label className="form-label">J38</label>
              <input
                className="form-input"
                type="number"
                step="0.01"
                value={j38}
                onChange={(e) => setJ38(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="form-group">
              <label className="form-label">K16</label>
              <input
                className="form-input"
                type="number"
                step="0.01"
                value={k16}
                onChange={(e) => setK16(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Sueldo Básico</label>
              <input
                className="form-input"
                type="number"
                step="0.01"
                value={sueldoBasico}
                onChange={(e) => setSueldoBasico(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Cupo</label>
              <input
                className="form-input"
                type="number"
                step="0.01"
                value={cupo}
                onChange={(e) => setCupo(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Saldo</label>
              <input
                className="form-input"
                type="number"
                step="0.01"
                value={saldo}
                onChange={(e) => setSaldo(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Caja de Ahorro</label>
              <input
                className="form-input"
                value={cajaAhorro}
                onChange={(e) => setCajaAhorro(e.target.value)}
                placeholder="Para jubilados"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Beneficiario</label>
              <input
                className="form-input"
                value={beneficiarioJubilado}
                onChange={(e) => setBeneficiarioJubilado(e.target.value)}
                placeholder="Para jubilados"
              />
            </div>

            <div className="form-group form-group-full">
              <label className="form-label">Motivo de Baja</label>
              <textarea
                className="form-textarea"
                value={motivoBaja}
                onChange={(e) => setMotivoBaja(e.target.value)}
                rows={3}
                placeholder="Descripción del motivo de baja (si aplica)"
              />
            </div>
          </div>
        </div>

        {/* Configuración de Coseguro */}
        {(afiliado || sinResultadosDniExacto) && (
          <div className="form-section">
            <div className="form-section-header">
              <div>
                <h2 className="form-section-title">
                  <Users size={20} />
                  Configuración de Coseguro
                </h2>
                <p className="form-section-subtitle">
                  Opcionalmente configure el coseguro y colaterales para este
                  padrón
                </p>
              </div>
            </div>

            {(tieneCoseguro === false || !!sinResultadosDniExacto) && (
              <div>
                <div className="form-checkbox" style={{ marginBottom: "16px" }}>
                  <input
                    type="checkbox"
                    checked={crearCoseguro}
                    onChange={(e) => setCrearCoseguro(e.target.checked)}
                  />
                  <span>Crear coseguro en este padrón</span>
                </div>

                {crearCoseguro && (
                  <div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "16px",
                      }}
                    >
                      <h4
                        style={{
                          margin: 0,
                          fontSize: "16px",
                          fontWeight: "600",
                          color: "var(--text)",
                        }}
                      >
                        Colaterales Iniciales
                      </h4>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={addColateral}
                      >
                        <Plus size={16} />
                        Agregar Colateral
                      </button>
                    </div>

                    {colaterales.length === 0 ? (
                      <div className="empty-state-small">
                        <div className="empty-state-icon-small">
                          <Users />
                        </div>
                        <p
                          style={{
                            margin: 0,
                            color: "var(--text-muted)",
                            fontSize: "14px",
                          }}
                        >
                          No hay colaterales cargados. Use el botón
                          &quot;Agregar Colateral&quot; para empezar.
                        </p>
                      </div>
                    ) : (
                      <div
                        className="colaterales-list"
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "12px",
                        }}
                      >
                        {colaterales.map((c, idx) => (
                          <ColateralRow
                            key={idx}
                            colateral={c}
                            onChange={(patch) => updateColateral(idx, patch)}
                            onRemove={() => removeColateral(idx)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {tieneCoseguro === true && !sinResultadosDniExacto && (
              <div className="alert alert-info">
                <div className="alert-content">
                  <div className="alert-icon">
                    <Info size={20} />
                  </div>
                  <div className="alert-text">
                    <strong>Coseguro existente:</strong> El afiliado ya tiene un
                    coseguro configurado. Para agregar colaterales o modificar
                    la configuración, hágalo desde la ficha del afiliado en la
                    pestaña <strong>Coseguro</strong>.
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Form Actions */}
        <div className="form-section">
          <div className="form-actions">
            <div
              style={{
                display: "flex",
                gap: "12px",
                justifyContent: "flex-end",
              }}
            >
              <button
                className="btn btn-secondary"
                onClick={limpiarTodo}
                disabled={creando}
                type="button"
              >
                <RotateCcw size={16} />
                Limpiar Todo
              </button>

              <button
                className={`btn ${canCrear ? "btn-primary" : "btn-disabled"}`}
                onClick={crearPadron}
                disabled={!canCrear}
                type="submit"
              >
                {creando ? (
                  <>
                    <Loader2 className="spinner" size={16} />
                    Creando...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Crear Padrón
                  </>
                )}
              </button>
            </div>

            <div className="form-help">
              {!afiliado && !sinResultadosDniExacto && (
                <span>
                  Primero busque un afiliado existente o ingrese un DNI para
                  crear uno nuevo
                </span>
              )}
              {(afiliado || sinResultadosDniExacto) && !padron && (
                <span>El código de padrón es obligatorio</span>
              )}
              {canCrear && (
                <span>
                  Listo para crear el padrón
                  {crearCoseguro ? " con coseguro" : ""}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Componente para cada fila de colateral
function ColateralRow({
  colateral,
  onChange,
  onRemove,
}: {
  colateral: ColateralUI;
  onChange: (patch: Partial<ColateralUI>) => void;
  onRemove: () => void;
}) {
  return (
    <div
      className="contacto-item"
      style={{
        padding: "16px",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
      }}
    >
      <div
        className="contacto-icon"
        style={{
          background: "var(--primary-100)",
          color: "var(--primary-600)",
        }}
      >
        <User size={18} />
      </div>
      <div className="contacto-form" style={{ flex: 1 }}>
        <div className="form-grid form-grid-3">
          <div className="form-group">
            <label className="form-label">ID Parentesco</label>
            <input
              className="form-input"
              inputMode="numeric"
              value={colateral.parentescoId}
              onChange={(e) =>
                onChange({ parentescoId: e.target.value.replace(/\D+/g, "") })
              }
              placeholder="1"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Nombre</label>
            <input
              className="form-input"
              value={colateral.nombre}
              onChange={(e) => onChange({ nombre: e.target.value })}
              placeholder="Nombre del colateral"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Fecha de Nacimiento</label>
            <input
              className="form-input"
              type="date"
              value={colateral.fechaNacimiento || ""}
              onChange={(e) => onChange({ fechaNacimiento: e.target.value })}
            />
          </div>
        </div>
      </div>
      <div className="contacto-remove">
        <button
          type="button"
          className="btn-icon btn-icon-danger"
          onClick={onRemove}
          title="Quitar colateral"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
