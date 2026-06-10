"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  Building2,
  Check,
  Loader2,
  Mail,
  MapPin,
  User,
} from "lucide-react";
import { api, getErrorMessage } from "@/servicios/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

type Rol = "PROVEEDOR" | "PRESTADOR" | "COMERCIO";
type CondIva =
  | ""
  | "INSCRIPTO"
  | "MONOTRIBUTO"
  | "EXENTO"
  | "CONSUMIDOR_FINAL"
  | "NO_RESPONSABLE";
type TipoPersona = "" | "FISICA" | "JURIDICA" | "OTRO";

const ROLES: { value: Rol; label: string; icon: string }[] = [
  { value: "PROVEEDOR", label: "Proveedor", icon: "🏢" },
  { value: "PRESTADOR", label: "Prestador", icon: "🏥" },
  { value: "COMERCIO", label: "Comercio", icon: "🏬" },
];

const labelCls = "mb-1 block text-xs font-medium text-neutral-600";
const inputCls = "h-9 rounded-lg border-neutral-200";
const selectCls =
  "h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-medical-500";

export default function NuevoTerceroPage() {
  const router = useRouter();

  const [nombre, setNombre] = useState("");
  const [fantasia, setFantasia] = useState("");
  const [codigo, setCodigo] = useState("");
  const [cuit, setCuit] = useState("");
  const [iibb, setIibb] = useState("");
  const [condIva, setCondIva] = useState<CondIva>("");
  const [tipoPersona, setTipoPersona] = useState<TipoPersona>("");
  const [roles, setRoles] = useState<Rol[]>(["COMERCIO"]);
  const [saldoInicial, setSaldoInicial] = useState<string>("");

  // contacto
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");

  // dirección
  const [calle, setCalle] = useState("");
  const [numero, setNumero] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [provincia, setProvincia] = useState("");
  const [cp, setCp] = useState("");

  const [notas, setNotas] = useState("");

  const [posting, setPosting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const toggleRol = (r: Rol) =>
    setRoles((x) => (x.includes(r) ? x.filter((v) => v !== r) : [...x, r]));

  const canSubmit = useMemo(
    () => nombre.trim().length > 0 && roles.length > 0 && !posting,
    [nombre, roles, posting]
  );

  const submit = async () => {
    try {
      setPosting(true);
      setMsg(null);
      if (!nombre.trim()) throw new Error("El nombre es obligatorio.");
      if (roles.length === 0)
        throw new Error("Seleccioná al menos un rol.");

      const contactos: Array<{
        tipo: "EMAIL" | "TELEFONO";
        valor: string;
        principal?: boolean;
      }> = [];
      if (email.trim())
        contactos.push({ tipo: "EMAIL", valor: email.trim(), principal: true });
      if (telefono.trim())
        contactos.push({ tipo: "TELEFONO", valor: telefono.trim() });

      const direcciones =
        calle.trim() || ciudad.trim() || provincia.trim() || cp.trim()
          ? [
              {
                etiqueta: "fiscal",
                calle: calle.trim() || undefined,
                numero: numero.trim() || undefined,
                ciudad: ciudad.trim() || undefined,
                provincia: provincia.trim() || undefined,
                cp: cp.trim() || undefined,
                principal: true,
              },
            ]
          : [];

      const saldo = saldoInicial.trim() === "" ? undefined : Number(saldoInicial);

      const payload = {
        nombre: nombre.trim(),
        fantasia: fantasia.trim() || null,
        codigo: codigo.trim() || null,
        cuit: cuit.trim() || null,
        iibb: iibb.trim() || null,
        condIva: condIva || null,
        tipoPersona: tipoPersona || null,
        activo: true,
        roles,
        ...(saldo != null && Number.isFinite(saldo)
          ? { saldoInicial: saldo, saldoActual: saldo }
          : {}),
        contactos,
        direcciones,
        notas: notas.trim() || null,
      };

      const r = await api<{ id: string }>("/terceros", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      router.push(`/terceros/${r.id}`);
    } catch (e) {
      setMsg(getErrorMessage(e));
      setPosting(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      {/* Toolbar */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-neutral-900">Nuevo tercero</h1>
        <Button variant="outline" size="sm" asChild>
          <Link href="/terceros" className="gap-1.5">
            <ArrowLeft className="size-4" />
            Volver al listado
          </Link>
        </Button>
      </div>

      {msg && (
        <div
          className="mb-4 flex items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
          role="alert"
        >
          <AlertCircle className="size-5 shrink-0" />
          <span className="font-medium">{msg}</span>
        </div>
      )}

      <div className="space-y-4">
        {/* Datos del tercero */}
        <Card className="rounded-xl border-neutral-200 p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-neutral-500">
            <User className="size-4 text-neutral-400" />
            Datos del tercero
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelCls}>
                Razón social / Nombre <span className="text-rose-500">*</span>
              </label>
              <Input
                className={inputCls}
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Farmacia San Martín"
                autoFocus
              />
            </div>
            <div>
              <label className={labelCls}>Nombre de fantasía</label>
              <Input
                className={inputCls}
                value={fantasia}
                onChange={(e) => setFantasia(e.target.value)}
                placeholder="Opcional"
              />
            </div>
            <div>
              <label className={labelCls}>Código</label>
              <Input
                className={inputCls}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="Código interno (opcional)"
              />
            </div>
            <div>
              <label className={labelCls}>CUIT</label>
              <Input
                className={inputCls}
                value={cuit}
                onChange={(e) => setCuit(e.target.value)}
                placeholder="20-12345678-9"
              />
            </div>
            <div>
              <label className={labelCls}>Ingresos brutos</label>
              <Input
                className={inputCls}
                value={iibb}
                onChange={(e) => setIibb(e.target.value)}
                placeholder="Opcional"
              />
            </div>
            <div>
              <label className={labelCls}>Condición IVA</label>
              <select
                className={selectCls}
                value={condIva}
                onChange={(e) => setCondIva(e.target.value as CondIva)}
              >
                <option value="">(Sin especificar)</option>
                <option value="INSCRIPTO">Responsable Inscripto</option>
                <option value="MONOTRIBUTO">Monotributo</option>
                <option value="EXENTO">Exento</option>
                <option value="CONSUMIDOR_FINAL">Consumidor Final</option>
                <option value="NO_RESPONSABLE">No Responsable</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Tipo de persona</label>
              <select
                className={selectCls}
                value={tipoPersona}
                onChange={(e) => setTipoPersona(e.target.value as TipoPersona)}
              >
                <option value="">(Sin especificar)</option>
                <option value="FISICA">Física</option>
                <option value="JURIDICA">Jurídica</option>
                <option value="OTRO">Otro</option>
              </select>
            </div>
          </div>

          {/* Roles */}
          <div className="mt-4">
            <label className={labelCls}>
              Roles <span className="text-rose-500">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {ROLES.map((r) => {
                const on = roles.includes(r.value);
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => toggleRol(r.value)}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition ${
                      on
                        ? "border-medical-400 bg-medical-50 text-medical-800 ring-1 ring-medical-300"
                        : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
                    }`}
                  >
                    <span>{r.icon}</span>
                    {r.label}
                    {on && <Check className="size-3.5" />}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-xs text-neutral-400">
              Cada rol genera su propia cuenta corriente.
            </p>
          </div>
        </Card>

        {/* Saldo inicial */}
        <Card className="rounded-xl border-neutral-200 p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-neutral-500">
            <Banknote className="size-4 text-neutral-400" />
            Saldo inicial
          </h2>
          <div className="max-w-xs">
            <label className={labelCls}>Saldo de apertura (opcional)</label>
            <Input
              className={`${inputCls} text-right`}
              type="number"
              step="0.01"
              value={saldoInicial}
              onChange={(e) => setSaldoInicial(e.target.value)}
              placeholder="0.00"
            />
            <p className="mt-1.5 text-xs text-neutral-400">
              Se aplica a la cuenta corriente de cada rol seleccionado.
            </p>
          </div>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Contacto */}
          <Card className="rounded-xl border-neutral-200 p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-neutral-500">
              <Mail className="size-4 text-neutral-400" />
              Contacto
            </h2>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Email</label>
                <Input
                  className={inputCls}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contacto@ejemplo.com"
                />
              </div>
              <div>
                <label className={labelCls}>Teléfono</label>
                <Input
                  className={inputCls}
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="0264-1234567"
                />
              </div>
            </div>
          </Card>

          {/* Dirección */}
          <Card className="rounded-xl border-neutral-200 p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-neutral-500">
              <MapPin className="size-4 text-neutral-400" />
              Dirección
            </h2>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className={labelCls}>Calle</label>
                <Input
                  className={inputCls}
                  value={calle}
                  onChange={(e) => setCalle(e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>N°</label>
                <Input
                  className={inputCls}
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Ciudad</label>
                <Input
                  className={inputCls}
                  value={ciudad}
                  onChange={(e) => setCiudad(e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>CP</label>
                <Input
                  className={inputCls}
                  value={cp}
                  onChange={(e) => setCp(e.target.value)}
                />
              </div>
              <div className="col-span-3">
                <label className={labelCls}>Provincia</label>
                <Input
                  className={inputCls}
                  value={provincia}
                  onChange={(e) => setProvincia(e.target.value)}
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Notas */}
        <Card className="rounded-xl border-neutral-200 p-5">
          <label className={labelCls}>Notas</label>
          <textarea
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-medical-500"
            rows={2}
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Observaciones internas…"
          />
        </Card>

        {/* Acciones */}
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" asChild>
            <Link href="/terceros">Cancelar</Link>
          </Button>
          <Button onClick={submit} disabled={!canSubmit} className="gap-2">
            {posting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Creando…
              </>
            ) : (
              <>
                <Building2 className="size-4" />
                Crear tercero
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
