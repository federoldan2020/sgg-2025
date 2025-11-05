"use client";

import { useMemo, useState } from "react";
import { api, getErrorMessage } from "@/servicios/api";
import type {
  CrearAfiliadoDto,
  CrearAfiliadoResp,
} from "@/tipos/dtos";
import { AfiliadoTipo, Sexo } from "@/tipos/modelos";
import { User, Phone, MapPin, Calendar, CreditCard, FileText, Save, RotateCcw, CheckCircle, XCircle, Info } from "lucide-react";

const SEXOS: Sexo[] = ["M", "F", "X"];
const TIPOS: AfiliadoTipo[] = ["TITULAR", "FAMILIAR", "JUBILADO", "OTRO"];

export default function NuevoAfiliadoPage() {
  // Requeridos
  const [dni, setDni] = useState("");
  const [apellido, setApellido] = useState("");
  const [nombre, setNombre] = useState("");

  // Personales
  const [cuit, setCuit] = useState("");
  const [sexo, setSexo] = useState<Sexo | "">("");
  const [tipo, setTipo] = useState<AfiliadoTipo | "">("");

  // Contacto
  const [telefono, setTelefono] = useState("");
  const [celular, setCelular] = useState("");

  // Domicilio
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

  // Otros
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [numeroSocio, setNumeroSocio] = useState("");
  const [cupo, setCupo] = useState("");
  const [saldo, setSaldo] = useState("");
  const [observaciones, setObservaciones] = useState("");

  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(() => {
    const dniNum = Number(dni);
    return (
      Number.isFinite(dniNum) &&
      dniNum > 0 &&
      apellido.trim().length >= 2 &&
      nombre.trim().length >= 2 &&
      !loading
    );
  }, [dni, apellido, nombre, loading]);

  const limpiar = () => {
    setDni("");
    setApellido("");
    setNombre("");
    setCuit("");
    setSexo("");
    setTipo("");
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
    setCupo("");
    setSaldo("");
    setObservaciones("");
    setMsg(null);
  };

  const crear = async () => {
    setMsg(null);
    setLoading(true);
    try {
      // helper: si string vacío => undefined
      const opt = (s: string) => (s?.trim() ? s.trim() : undefined);

      const payload: CrearAfiliadoDto = {
        dni: Number(dni),
        apellido: apellido.trim(),
        nombre: nombre.trim(),

        cuit: opt(cuit),
        sexo: sexo || undefined,
        tipo: tipo || undefined,

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

        // Enviar decimales como string (Prisma.Decimal-friendly)
        cupo: opt(cupo),
        saldo: opt(saldo),

        observaciones: opt(observaciones),
      };

      const r = await api<CrearAfiliadoResp>("/afiliados", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setMsg(`SUCCESS:Afiliado creado exitosamente (ID ${String(r.id)})`);
      limpiar();
    } catch (e: unknown) {
      setMsg(`ERROR:${getErrorMessage(e)}`);
    } finally {
      setLoading(false);
    }
  };

  // Parse message type and content
  const parseMessage = (message: string | null) => {
    if (!message) return null;
    
    if (message.startsWith('SUCCESS:')) {
      return { type: 'success', content: message.substring(8) };
    } else if (message.startsWith('ERROR:')) {
      return { type: 'error', content: message.substring(6) };
    } else if (message.startsWith('INFO:')) {
      return { type: 'info', content: message.substring(5) };
    } else {
      // Legacy support for old messages
      return { 
        type: message.includes('Error') || message.includes('❌') ? 'error' : 'success', 
        content: message.replace(/^(✅|❌)\s*/, '')
      };
    }
  };

  const messageInfo = parseMessage(msg);

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-title-section">
          <h1 className="page-title">Nuevo Afiliado</h1>
          <p className="page-subtitle">
            Complete la información del nuevo afiliado en el sistema
          </p>
        </div>
      </div>

      {/* Enhanced Message System */}
      {messageInfo && (
        <div className={`alert ${messageInfo.type === 'error' ? 'alert-error' : messageInfo.type === 'success' ? 'alert-success' : 'alert-info'}`}>
          <div className="alert-content">
            <div className="alert-icon">
              {messageInfo.type === 'error' && <XCircle size={20} />}
              {messageInfo.type === 'success' && <CheckCircle size={20} />}
              {messageInfo.type === 'info' && <Info size={20} />}
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
        {/* Información Personal */}
        <div className="form-section">
          <div className="form-section-header">
            <div>
              <h2 className="form-section-title">
                <User size={20} />
                Información Personal
              </h2>
              <p className="form-section-subtitle">
                Datos básicos de identificación del afiliado
              </p>
            </div>
          </div>

          <div className="form-grid form-grid-3">
            <div className="form-group">
              <label className="form-label">DNI *</label>
              <input
                className="form-input"
                inputMode="numeric"
                value={dni}
                onChange={(e) => setDni(e.target.value.replace(/\D+/g, ""))}
                placeholder="Ejemplo: 12345678"
                required
              />
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
              <label className="form-label">Número de Socio</label>
              <input
                className="form-input"
                value={numeroSocio}
                onChange={(e) => setNumeroSocio(e.target.value)}
                placeholder="Opcional"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Apellido *</label>
              <input
                className="form-input"
                value={apellido}
                onChange={(e) => setApellido(e.target.value)}
                placeholder="Apellido del afiliado"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Nombre *</label>
              <input
                className="form-input"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre del afiliado"
                required
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
                value={sexo}
                onChange={(e) => setSexo(e.target.value as Sexo | "")}
              >
                <option value="">Seleccionar</option>
                {SEXOS.map((s) => (
                  <option key={s} value={s}>
                    {s === 'M' ? 'Masculino' : s === 'F' ? 'Femenino' : 'No binario'}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Tipo de Afiliado</label>
              <select
                className="form-select"
                value={tipo}
                onChange={(e) => setTipo(e.target.value as AfiliadoTipo | "")}
              >
                <option value="">Seleccionar tipo</option>
                {TIPOS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Información de Contacto */}
        <div className="form-section">
          <div className="form-section-header">
            <div>
              <h2 className="form-section-title">
                <Phone size={20} />
                Información de Contacto
              </h2>
              <p className="form-section-subtitle">
                Datos para comunicación con el afiliado
              </p>
            </div>
          </div>

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
        <div className="form-section">
          <div className="form-section-header">
            <div>
              <h2 className="form-section-title">
                <MapPin size={20} />
                Domicilio
              </h2>
              <p className="form-section-subtitle">
                Dirección de residencia del afiliado
              </p>
            </div>
          </div>

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
        <div className="form-section">
          <div className="form-section-header">
            <div>
              <h2 className="form-section-title">
                <CreditCard size={20} />
                Información Financiera
              </h2>
              <p className="form-section-subtitle">
                Datos económicos y límites del afiliado
              </p>
            </div>
          </div>

          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">Cupo Disponible</label>
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
              <label className="form-label">Saldo Inicial</label>
              <input
                className="form-input"
                type="number"
                step="0.01"
                value={saldo}
                onChange={(e) => setSaldo(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>
        </div>

        {/* Observaciones */}
        <div className="form-section">
          <div className="form-section-header">
            <div>
              <h2 className="form-section-title">
                <FileText size={20} />
                Observaciones
              </h2>
              <p className="form-section-subtitle">
                Información adicional sobre el afiliado
              </p>
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group form-group-full">
              <label className="form-label">Notas y comentarios</label>
              <textarea
                className="form-textarea"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                rows={4}
                placeholder="Agregue cualquier información adicional relevante..."
              />
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="form-section">
          <div className="form-actions">
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={limpiar}
                disabled={loading}
                type="button"
              >
                <RotateCcw size={16} />
                Limpiar Formulario
              </button>
              
              <button
                className={`btn ${canSubmit ? 'btn-primary' : 'btn-disabled'}`}
                onClick={crear}
                disabled={!canSubmit}
                type="submit"
              >
                {loading ? (
                  <>
                    <div className="spinner" style={{ width: 16, height: 16 }} />
                    Creando...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Crear Afiliado
                  </>
                )}
              </button>
            </div>

            <div className="form-help">
              Los campos marcados con * son obligatorios
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}