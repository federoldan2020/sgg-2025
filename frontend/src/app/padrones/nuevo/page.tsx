/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import { api, getErrorMessage } from "@/servicios/api";
import { InputFecha } from "@/components/InputFecha";
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
  Users,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  CheckCircle,
  XCircle,
  Info,
  Loader2,
  Phone,
  MapPin,
  CreditCard,
} from "lucide-react";
import { usePadronMask } from "@/hooks/usePadronMask";
import { PageHeader } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import Link from "next/link";

const SISTEMAS: Sistema[] = ["ESC", "SGR", "SG", "JUV"];

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
  const fc = "h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm transition-colors hover:border-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-medical-500 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 placeholder:text-neutral-400";
  const selectClass = `h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm transition-colors hover:border-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-medical-500 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 appearance-none`;
  const padronEnabled = !!(afiliado || sinResultadosDniExacto);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Alta de Afiliado / Padrón"
        subtitle="Busque un afiliado existente o cree uno nuevo junto con su padrón"
      >
        <Button variant="outline" size="sm" asChild>
          <Link href="/afiliados">Volver al listado</Link>
        </Button>
      </PageHeader>

      {messageInfo && (
        <div
          className={`mb-6 flex items-start gap-3 rounded-lg border px-4 py-3 ${
            messageInfo.type === "error"
              ? "border-red-200 bg-red-50 text-red-800"
              : messageInfo.type === "success"
                ? "border-medical-200 bg-medical-50 text-medical-800"
                : "border-neutral-200 bg-neutral-50 text-neutral-800"
          }`}
          role="alert"
        >
          <span className="shrink-0">
            {messageInfo.type === "error" && <XCircle className="size-5" />}
            {messageInfo.type === "success" && <CheckCircle className="size-5" />}
            {messageInfo.type === "info" && <Info className="size-5" />}
          </span>
          <span className="flex-1 text-sm font-medium">{messageInfo.content}</span>
          <button type="button" onClick={() => setMsg(null)} className="shrink-0 rounded p-1 hover:bg-black/10" aria-label="Cerrar mensaje">×</button>
        </div>
      )}

      {/* Paso 1: Buscar Afiliado */}
      <Card className="mb-6 rounded-lg border-neutral-200 shadow-sm transition-shadow hover:shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold leading-none tracking-tight text-neutral-900">
            <Search className="size-5 text-neutral-500" />
            Paso 1: Buscar Afiliado
          </CardTitle>
          <CardDescription className="text-sm text-neutral-500">Ingrese DNI, apellido o nombre. Si no existe, podrá crear uno nuevo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative max-w-md">
            <Label htmlFor="buscador">Búsqueda</Label>
            <div className="relative mt-1.5">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
              <Input
                id="buscador"
                className={`${fc} pl-9`}
                placeholder="Ej: 30123456 o Gomez Juan"
                value={buscador}
                onChange={(e) => setBuscador(e.target.value)}
              />
              {buscador && (
                <button className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-neutral-400 hover:text-neutral-700" onClick={() => setBuscador("")}>×</button>
              )}
            </div>
          </div>

          {buscando && (
            <p className="flex items-center gap-2 text-sm text-neutral-500">
              <Loader2 className="size-4 animate-spin" /> Buscando...
            </p>
          )}

          {buscaMsg && !buscando && (
            <p className="flex items-center gap-2 text-sm text-neutral-500">
              <Info className="size-4" /> {buscaMsg}
            </p>
          )}

          {resultados.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold text-neutral-600">Resultados ({resultados.length})</p>
              <div className="divide-y rounded-lg border border-neutral-200">
                {resultados.map((a) => (
                  <button
                    key={String(a.id)}
                    type="button"
                    className={`group relative flex w-full items-center justify-between px-4 py-3 text-left transition-all duration-150 active:scale-[0.98] ${
                      afiliado?.id === a.id ? "bg-medical-50 text-medical-700 shadow-sm" : "hover:bg-neutral-100 text-neutral-700"
                    }`}
                    onClick={() => { setAfiliado(a); setSinResultadosDniExacto(null); }}
                  >
                    {afiliado?.id === a.id && (
                      <div className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-medical-600" />
                    )}
                    <div>
                      <span className="font-medium text-neutral-900">{a.display}</span>
                      <span className="ml-2 text-sm text-neutral-500">DNI {String(a.dni)}</span>
                    </div>
                    {afiliado?.id === a.id && (
                      <Badge variant="default" className="gap-1">
                        <CheckCircle className="size-3" /> Seleccionado
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {afiliado && (
            <div className="flex items-center gap-3 rounded-lg border border-medical-200 bg-medical-50 p-4">
              <div className="flex size-10 items-center justify-center rounded-full bg-medical-100 text-medical-600">
                <User className="size-5" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-neutral-900">{afiliado.display}</p>
                <p className="text-sm text-neutral-600">DNI {String(afiliado.dni)}</p>
              </div>
              <div className="text-sm">
                {cargandoCoseguro && <span className="flex items-center gap-1 text-neutral-500"><Loader2 className="size-3 animate-spin" /> Verificando coseguro...</span>}
                {!cargandoCoseguro && tieneCoseguro === true && <Badge variant="default" className="gap-1"><CheckCircle className="size-3" /> Tiene coseguro</Badge>}
                {!cargandoCoseguro && tieneCoseguro === false && <Badge variant="secondary" className="gap-1"><XCircle className="size-3" /> Sin coseguro</Badge>}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Datos del nuevo afiliado (si no existe) */}
      {!afiliado && sinResultadosDniExacto && (
        <Card className="mb-6 rounded-lg border-amber-200 bg-amber-50/30 shadow-sm transition-shadow hover:shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold leading-none tracking-tight text-amber-900">
              <UserPlus className="size-5" />
              Nuevo Afiliado (DNI {sinResultadosDniExacto})
            </CardTitle>
            <CardDescription className="text-sm text-amber-700">No existe un afiliado con este DNI. Complete los datos para crearlo junto con el padrón.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Info Personal */}
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-700"><User className="size-4" /> Información Personal</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>DNI *</Label>
                  <Input className={fc} inputMode="numeric" value={dniNuevo} onChange={(e) => setDniNuevo(e.target.value.replace(/\D+/g, ""))} placeholder="12345678" />
                </div>
                <div className="space-y-1.5">
                  <Label>Apellido y Nombre (helper)</Label>
                  <div className="flex gap-2">
                    <Input className={`flex-1 ${fc}`} value={apeNom} onChange={(e) => setApeNom(e.target.value)} placeholder="PÉREZ, JUAN" />
                    <Button variant="outline" size="sm" type="button" onClick={() => { const s = splitApeNom(apeNom); if (!apellNuevo && s.apellido) setApellNuevo(s.apellido); if (!nombNuevo && s.nombre) setNombNuevo(s.nombre); }}>Separar</Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>CUIT/CUIL</Label>
                  <Input className={fc} value={cuit} onChange={(e) => setCuit(e.target.value)} placeholder="20-12345678-9" />
                </div>
                <div className="space-y-1.5">
                  <Label>Apellido</Label>
                  <Input className={fc} value={apellNuevo} onChange={(e) => setApellNuevo(e.target.value)} placeholder="Apellido" />
                </div>
                <div className="space-y-1.5">
                  <Label>Nombre</Label>
                  <Input className={fc} value={nombNuevo} onChange={(e) => setNombNuevo(e.target.value)} placeholder="Nombre" />
                </div>
                <div className="space-y-1.5">
                  <Label>Fecha de Nacimiento</Label>
                  <InputFecha value={fechaNacimiento} onChange={(iso) => setFechaNacimiento(iso)} placeholder="dd/mm/aaaa" className={fc} />
                </div>
                <div className="space-y-1.5">
                  <Label>Sexo</Label>
                  <select className={selectClass} value={sexo ?? ""} onChange={(e) => setSexo((e.target.value || undefined) as CrearAfiliadoDto["sexo"])}>
                    <option value="">Seleccionar</option>
                    <option value="M">Masculino</option>
                    <option value="F">Femenino</option>
                    <option value="X">No binario</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Tipo</Label>
                  <select className={selectClass} value={tipo ?? ""} onChange={(e) => setTipo((e.target.value || undefined) as CrearAfiliadoDto["tipo"])}>
                    <option value="">Seleccionar</option>
                    <option value="TITULAR">TITULAR</option>
                    <option value="FAMILIAR">FAMILIAR</option>
                    <option value="JUBILADO">JUBILADO</option>
                    <option value="OTRO">OTRO</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>N° Socio</Label>
                  <Input className={fc} value={numeroSocio} onChange={(e) => setNumeroSocio(e.target.value)} placeholder="Opcional" />
                </div>
              </div>
            </div>

            {/* Contacto */}
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-700"><Phone className="size-4" /> Contacto</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5"><Label>Teléfono</Label><Input className={fc} value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="11-1234-5678" /></div>
                <div className="space-y-1.5"><Label>Celular</Label><Input className={fc} value={celular} onChange={(e) => setCelular(e.target.value)} placeholder="11-1234-5678" /></div>
              </div>
            </div>

            {/* Domicilio */}
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-700"><MapPin className="size-4" /> Domicilio</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {([
                  ["calle", "Calle", calle, setCalle, "Nombre de la calle"],
                  ["numero", "Número", numero, setNumero, "1234"],
                  ["orientacion", "Orientación", orientacion, setOrientacion, "Entre calles..."],
                  ["barrio", "Barrio", barrio, setBarrio, "Nombre del barrio"],
                  ["piso", "Piso", piso, setPiso, "1"],
                  ["depto", "Departamento", depto, setDepto, "A"],
                  ["monoblock", "Monoblock", monoblock, setMonoblock, "1"],
                  ["casa", "Casa", casa, setCasa, "1"],
                  ["manzana", "Manzana", manzana, setManzana, "A"],
                  ["localidad", "Localidad", localidad, setLocalidad, "Ciudad"],
                ] as [string, string, string, (v: string) => void, string][]).map(([id, label, val, setter, ph]) => (
                  <div key={id} className="space-y-1.5"><Label>{label}</Label><Input className={fc} value={val} onChange={(e) => setter(e.target.value)} placeholder={ph} /></div>
                ))}
              </div>
            </div>

            {/* Financiero */}
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-700"><CreditCard className="size-4" /> Información Financiera</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5"><Label>Cupo</Label><Input className={fc} type="number" step="0.01" value={cupoAf} onChange={(e) => setCupoAf(e.target.value)} placeholder="0.00" /></div>
                <div className="space-y-1.5"><Label>Saldo</Label><Input className={fc} type="number" step="0.01" value={saldoAf} onChange={(e) => setSaldoAf(e.target.value)} placeholder="0.00" /></div>
              </div>
            </div>

            {/* Observaciones */}
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-700"><FileText className="size-4" /> Observaciones</h3>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                rows={3}
                placeholder="Información adicional sobre el afiliado..."
                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-medical-500"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Paso 2: Datos del Padrón */}
      <Card className={`mb-6 rounded-lg border-neutral-200 shadow-sm transition-all hover:shadow-md ${padronEnabled ? "" : "pointer-events-none opacity-50"}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold leading-none tracking-tight text-neutral-900">
            <FileText className="size-5 text-neutral-500" />
            Paso 2: Datos del Padrón
          </CardTitle>
          <CardDescription className="text-sm text-neutral-500">Complete la información específica del padrón</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Código de Padrón *</Label>
              <Input className={fc} value={padronMask.value} onChange={padronMask.onChange} placeholder="000000-0" maxLength={8} />
              <p className="text-xs text-neutral-500">El guión se agrega automáticamente después del 6° dígito</p>
            </div>
            <div className="space-y-1.5">
              <Label>Situación</Label>
              <Input className={fc} value={situacion} onChange={(e) => setSituacion(e.target.value)} placeholder="TITULAR / SUPLENTE / PP / 04" />
            </div>
            <div className="space-y-1.5">
              <Label>Sistema</Label>
              <select className={selectClass} value={sistema} onChange={(e) => setSistema(e.target.value as Sistema | "")}>
                <option value="">Seleccionar</option>
                {SISTEMAS.map((s) => (<option key={s} value={s}>{s}</option>))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Centro</Label>
              <Input className={fc} inputMode="numeric" value={centro} onChange={(e) => setCentro(e.target.value.replace(/\D+/g, ""))} placeholder="Código" />
            </div>
            <div className="space-y-1.5">
              <Label>Sector</Label>
              <Input className={fc} inputMode="numeric" value={sector} onChange={(e) => setSector(e.target.value.replace(/\D+/g, ""))} placeholder="Código" />
            </div>
            <div className="space-y-1.5">
              <Label>Clase</Label>
              <Input className={fc} value={clase} onChange={(e) => setClase(e.target.value)} placeholder="Clase del padrón" />
            </div>
            <div className="space-y-1.5">
              <Label>Fecha Alta</Label>
              <InputFecha value={fechaAlta} onChange={(iso) => setFechaAlta(iso)} placeholder="dd/mm/aaaa" className={fc} />
            </div>
            <div className="space-y-1.5">
              <Label>Fecha Baja</Label>
              <InputFecha value={fechaBaja} onChange={(iso) => setFechaBaja(iso)} placeholder="dd/mm/aaaa" className={fc} />
            </div>
            <div className="flex items-end space-y-1.5 pb-1">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} className="size-4 rounded border-neutral-300" />
                Padrón activo
              </label>
            </div>
            <div className="space-y-1.5"><Label>J17</Label><Input className={fc} type="number" step="0.01" value={j17} onChange={(e) => setJ17(e.target.value)} placeholder="0.00" /></div>
            <div className="space-y-1.5"><Label>J22</Label><Input className={fc} type="number" step="0.01" value={j22} onChange={(e) => setJ22(e.target.value)} placeholder="0.00" /></div>
            <div className="space-y-1.5"><Label>J38</Label><Input className={fc} type="number" step="0.01" value={j38} onChange={(e) => setJ38(e.target.value)} placeholder="0.00" /></div>
            <div className="space-y-1.5"><Label>K16</Label><Input className={fc} type="number" step="0.01" value={k16} onChange={(e) => setK16(e.target.value)} placeholder="0.00" /></div>
            <div className="space-y-1.5"><Label>Sueldo Básico</Label><Input className={fc} type="number" step="0.01" value={sueldoBasico} onChange={(e) => setSueldoBasico(e.target.value)} placeholder="0.00" /></div>
            <div className="space-y-1.5"><Label>Cupo</Label><Input className={fc} type="number" step="0.01" value={cupo} onChange={(e) => setCupo(e.target.value)} placeholder="0.00" /></div>
            <div className="space-y-1.5"><Label>Saldo</Label><Input className={fc} type="number" step="0.01" value={saldo} onChange={(e) => setSaldo(e.target.value)} placeholder="0.00" /></div>
            <div className="space-y-1.5"><Label>Caja de Ahorro</Label><Input className={fc} value={cajaAhorro} onChange={(e) => setCajaAhorro(e.target.value)} placeholder="Para jubilados" /></div>
            <div className="space-y-1.5"><Label>Beneficiario</Label><Input className={fc} value={beneficiarioJubilado} onChange={(e) => setBeneficiarioJubilado(e.target.value)} placeholder="Para jubilados" /></div>
            <div className="col-span-full space-y-1.5">
              <Label>Motivo de Baja</Label>
              <textarea value={motivoBaja} onChange={(e) => setMotivoBaja(e.target.value)} rows={3} placeholder="Si aplica..." className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-medical-500" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Coseguro */}
      {padronEnabled && (
        <Card className="mb-6 rounded-lg border-neutral-200 shadow-sm transition-shadow hover:shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold leading-none tracking-tight text-neutral-900">
              <Users className="size-5 text-neutral-500" />
              Configuración de Coseguro
            </CardTitle>
            <CardDescription className="text-sm text-neutral-500">Opcionalmente configure el coseguro y colaterales para este padrón</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(tieneCoseguro === false || !!sinResultadosDniExacto) && (
              <>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={crearCoseguro} onChange={(e) => setCrearCoseguro(e.target.checked)} className="size-4 rounded border-neutral-300" />
                  Crear coseguro en este padrón
                </label>

                {crearCoseguro && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-neutral-700">Colaterales Iniciales</h4>
                      <Button variant="outline" size="sm" type="button" onClick={addColateral} className="gap-1">
                        <Plus className="size-4" /> Agregar
                      </Button>
                    </div>

                    {colaterales.length === 0 ? (
                      <p className="py-4 text-center text-sm text-neutral-400">No hay colaterales. Use &quot;Agregar&quot; para empezar.</p>
                    ) : (
                      <div className="space-y-3">
                        {colaterales.map((c, idx) => (
                          <ColateralRow key={idx} colateral={c} onChange={(patch) => updateColateral(idx, patch)} onRemove={() => removeColateral(idx)} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {tieneCoseguro === true && !sinResultadosDniExacto && (
              <div className="flex items-start gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                <Info className="size-5 shrink-0 text-neutral-500" />
                <p className="text-sm text-neutral-600">
                  <strong>Coseguro existente:</strong> El afiliado ya tiene coseguro configurado. Para modificar colaterales, hágalo desde la ficha del afiliado.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Acciones */}
      <Card className="rounded-lg shadow-sm border-neutral-200">
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-neutral-500">
              {!padronEnabled && "Primero busque un afiliado existente o ingrese un DNI para crear uno nuevo"}
              {padronEnabled && !padronMask.value.trim() && "El código de padrón es obligatorio"}
              {canCrear && <>Listo para crear el padrón{crearCoseguro ? " con coseguro" : ""}</>}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={limpiarTodo} disabled={creando} type="button">
                <RotateCcw className="size-4" /> Limpiar
              </Button>
              <Button onClick={crearPadron} disabled={!canCrear} type="button">
                {creando ? (
                  <><Loader2 className="size-4 animate-spin" /> Creando...</>
                ) : (
                  <><Save className="size-4" /> Crear Padrón</>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ColateralRow({
  colateral,
  onChange,
  onRemove,
}: {
  colateral: ColateralUI;
  onChange: (patch: Partial<ColateralUI>) => void;
  onRemove: () => void;
}) {
  const fc = "h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm transition-colors hover:border-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-medical-500 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 placeholder:text-neutral-400";
  return (
    <div className="flex items-start gap-3 rounded-lg border border-neutral-200 bg-white p-4">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-medical-100 text-medical-600">
        <User className="size-4" />
      </div>
      <div className="grid flex-1 gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>ID Parentesco</Label>
          <Input className={fc} inputMode="numeric" value={colateral.parentescoId} onChange={(e) => onChange({ parentescoId: e.target.value.replace(/\D+/g, "") })} placeholder="1" />
        </div>
        <div className="space-y-1.5">
          <Label>Nombre</Label>
          <Input className={fc} value={colateral.nombre} onChange={(e) => onChange({ nombre: e.target.value })} placeholder="Nombre del colateral" />
        </div>
        <div className="space-y-1.5">
          <Label>Fecha de Nacimiento</Label>
          <InputFecha value={colateral.fechaNacimiento || ""} onChange={(iso) => onChange({ fechaNacimiento: iso })} placeholder="dd/mm/aaaa" className={fc} />
        </div>
      </div>
      <Button variant="ghost" size="sm" className="shrink-0 text-red-500 hover:bg-red-50 hover:text-red-700" onClick={onRemove} type="button" title="Quitar colateral">
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}
