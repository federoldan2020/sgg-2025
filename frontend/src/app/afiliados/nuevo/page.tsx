"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, getErrorMessage } from "@/servicios/api";
import { InputFecha } from "@/components/InputFecha";
import type { CrearAfiliadoDto } from "@/tipos/dtos";
import { AfiliadoTipo, Sexo } from "@/tipos/modelos";
import {
  User,
  Phone,
  MapPin,
  CreditCard,
  FileText,
  Save,
  RotateCcw,
  CheckCircle,
  XCircle,
  Info,
} from "lucide-react";
import { PageHeader } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

const SEXOS: Sexo[] = ["M", "F", "X"];
const TIPOS: AfiliadoTipo[] = ["TITULAR", "FAMILIAR", "JUBILADO", "OTRO"];

export default function NuevoAfiliadoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const afiliadoId = searchParams.get("afiliadoId");
  const isEdit = Boolean(afiliadoId);

  useEffect(() => {
    if (!isEdit) {
      router.replace("/padrones/nuevo");
    }
  }, [isEdit, router]);

  const [dni, setDni] = useState("");
  const [apellido, setApellido] = useState("");
  const [nombre, setNombre] = useState("");
  const [cuit, setCuit] = useState("");
  const [sexo, setSexo] = useState<Sexo | "">("");
  const [tipo, setTipo] = useState<AfiliadoTipo | "">("");
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

  useEffect(() => {
    if (!isEdit || !afiliadoId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const a = await api<any>(`/afiliados/${afiliadoId}`, { method: "GET" });
        if (cancelled) return;
        setDni(String(a.dni ?? ""));
        setApellido(a.apellido ?? "");
        setNombre(a.nombre ?? "");
        setCuit(a.cuit ?? "");
        setSexo((a.sexo as Sexo) ?? "");
        setTipo((a.tipo as AfiliadoTipo) ?? "");
        setTelefono(a.telefono ?? "");
        setCelular(a.celular ?? "");
        setCalle(a.calle ?? "");
        setNumero(a.numero ?? "");
        setOrientacion(a.orientacion ?? "");
        setBarrio(a.barrio ?? "");
        setPiso(a.piso ?? "");
        setDepto(a.depto ?? "");
        setMonoblock(a.monoblock ?? "");
        setCasa(a.casa ?? "");
        setManzana(a.manzana ?? "");
        setLocalidad(a.localidad ?? "");
        setFechaNacimiento(a.fechaNacimiento ?? "");
        setNumeroSocio(a.numeroSocio ?? "");
        setCupo(a.cupo != null ? String(a.cupo) : "");
        setSaldo(a.saldo != null ? String(a.saldo) : "");
        setObservaciones(a.observaciones ?? "");
      } catch (e: unknown) {
        setMsg(`ERROR:${getErrorMessage(e)}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEdit, afiliadoId]);

  const guardar = async () => {
    if (!isEdit || !afiliadoId) return;
    setMsg(null);
    setLoading(true);
    try {
      const opt = (s: string) => (s?.trim() ? s.trim() : undefined);

      const payload: Partial<CrearAfiliadoDto> = {
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
        cupo: opt(cupo),
        saldo: opt(saldo),
        observaciones: opt(observaciones),
      };

      await api(`/afiliados/${afiliadoId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setMsg("SUCCESS:Afiliado actualizado correctamente.");
    } catch (e: unknown) {
      setMsg(`ERROR:${getErrorMessage(e)}`);
    } finally {
      setLoading(false);
    }
  };

  const parseMessage = (message: string | null) => {
    if (!message) return null;
    if (message.startsWith("SUCCESS:")) {
      return { type: "success" as const, content: message.substring(8) };
    }
    if (message.startsWith("ERROR:")) {
      return { type: "error" as const, content: message.substring(6) };
    }
    if (message.startsWith("INFO:")) {
      return { type: "info" as const, content: message.substring(5) };
    }
    return {
      type: (message.includes("Error") || message.includes("❌") ? "error" : "success") as "error" | "success",
      content: message.replace(/^(✅|❌)\s*/, ""),
    };
  };

  const messageInfo = parseMessage(msg);

  if (!isEdit) return null;

  const formInputClass = "rounded-lg border-neutral-200 bg-white";
  const formGridClass = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3";

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Editar Afiliado"
        subtitle="Actualice la información del afiliado"
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
          <button
            type="button"
            onClick={() => setMsg(null)}
            className="shrink-0 rounded p-1 hover:bg-black/10"
            aria-label="Cerrar mensaje"
          >
            ×
          </button>
        </div>
      )}

      {/* Información Personal */}
      <Card className="mb-6 rounded-xl border-neutral-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="size-5 text-neutral-600" />
            Información Personal
          </CardTitle>
          <CardDescription>Datos básicos de identificación del afiliado</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className={formGridClass}>
            <div className="space-y-2">
              <Label htmlFor="dni">DNI</Label>
              <Input
                id="dni"
                inputMode="numeric"
                value={dni}
                placeholder="DNI del afiliado"
                className={formInputClass}
                disabled
              />
              <p className="text-xs text-neutral-500">El DNI no se puede modificar</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cuit">CUIT/CUIL</Label>
              <Input
                id="cuit"
                value={cuit}
                onChange={(e) => setCuit(e.target.value)}
                placeholder="20-12345678-9"
                className={formInputClass}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="numeroSocio">Número de Socio</Label>
              <Input
                id="numeroSocio"
                value={numeroSocio}
                onChange={(e) => setNumeroSocio(e.target.value)}
                placeholder="Opcional"
                className={formInputClass}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apellido">Apellido *</Label>
              <Input
                id="apellido"
                value={apellido}
                onChange={(e) => setApellido(e.target.value)}
                placeholder="Apellido del afiliado"
                className={formInputClass}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre *</Label>
              <Input
                id="nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre del afiliado"
                className={formInputClass}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fechaNacimiento">Fecha de Nacimiento</Label>
              <InputFecha
                value={fechaNacimiento}
                onChange={(iso) => setFechaNacimiento(iso)}
                placeholder="dd/mm/aaaa"
                className={formInputClass}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sexo">Sexo</Label>
              <select
                id="sexo"
                value={sexo}
                onChange={(e) => setSexo(e.target.value as Sexo | "")}
                className={`h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-medical-500 ${formInputClass}`}
              >
                <option value="">Seleccionar</option>
                {SEXOS.map((s) => (
                  <option key={s} value={s}>
                    {s === "M" ? "Masculino" : s === "F" ? "Femenino" : "No binario"}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo de Afiliado</Label>
              <select
                id="tipo"
                value={tipo}
                onChange={(e) => setTipo(e.target.value as AfiliadoTipo | "")}
                className={`h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-medical-500 ${formInputClass}`}
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
        </CardContent>
      </Card>

      {/* Contacto */}
      <Card className="mb-6 rounded-xl border-neutral-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Phone className="size-5 text-neutral-600" />
            Información de Contacto
          </CardTitle>
          <CardDescription>Datos para comunicación con el afiliado</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="telefono">Teléfono</Label>
              <Input
                id="telefono"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="11-1234-5678"
                className={formInputClass}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="celular">Celular</Label>
              <Input
                id="celular"
                value={celular}
                onChange={(e) => setCelular(e.target.value)}
                placeholder="11-1234-5678"
                className={formInputClass}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Domicilio */}
      <Card className="mb-6 rounded-xl border-neutral-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="size-5 text-neutral-600" />
            Domicilio
          </CardTitle>
          <CardDescription>Dirección de residencia del afiliado</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { id: "calle", label: "Calle", value: calle, set: setCalle, ph: "Nombre de la calle" },
              { id: "numero", label: "Número", value: numero, set: setNumero, ph: "1234" },
              { id: "orientacion", label: "Orientación", value: orientacion, set: setOrientacion, ph: "Entre calles..." },
              { id: "barrio", label: "Barrio", value: barrio, set: setBarrio, ph: "Nombre del barrio" },
              { id: "piso", label: "Piso", value: piso, set: setPiso, ph: "1" },
              { id: "depto", label: "Departamento", value: depto, set: setDepto, ph: "A" },
              { id: "monoblock", label: "Monoblock", value: monoblock, set: setMonoblock, ph: "1" },
              { id: "casa", label: "Casa", value: casa, set: setCasa, ph: "1" },
              { id: "manzana", label: "Manzana", value: manzana, set: setManzana, ph: "A" },
              { id: "localidad", label: "Localidad", value: localidad, set: setLocalidad, ph: "Ciudad/Localidad" },
            ].map(({ id, label, value, set, ph }) => (
              <div key={id} className="space-y-2">
                <Label htmlFor={id}>{label}</Label>
                <Input
                  id={id}
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  placeholder={ph}
                  className={formInputClass}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Información Financiera */}
      <Card className="mb-6 rounded-xl border-neutral-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="size-5 text-neutral-600" />
            Información Financiera
          </CardTitle>
          <CardDescription>Datos económicos y límites del afiliado</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cupo">Cupo Disponible</Label>
              <Input
                id="cupo"
                type="number"
                step="0.01"
                value={cupo}
                onChange={(e) => setCupo(e.target.value)}
                placeholder="0.00"
                className={formInputClass}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="saldo">Saldo</Label>
              <Input
                id="saldo"
                type="number"
                step="0.01"
                value={saldo}
                onChange={(e) => setSaldo(e.target.value)}
                placeholder="0.00"
                className={formInputClass}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Observaciones */}
      <Card className="mb-6 rounded-xl border-neutral-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="size-5 text-neutral-600" />
            Observaciones
          </CardTitle>
          <CardDescription>Información adicional sobre el afiliado</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="observaciones">Notas y comentarios</Label>
            <textarea
              id="observaciones"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={4}
              placeholder="Agregue cualquier información adicional relevante..."
              className={`w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-medical-500 ${formInputClass}`}
            />
          </div>
        </CardContent>
      </Card>

      {/* Acciones */}
      <Card className="rounded-xl border-neutral-200">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
          <p className="text-sm text-neutral-500">Los campos marcados con * son obligatorios</p>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/afiliados">Cancelar</Link>
            </Button>
            <Button onClick={guardar} disabled={!canSubmit} type="button">
              {loading ? (
                <>
                  <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="size-4" />
                  Guardar cambios
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
