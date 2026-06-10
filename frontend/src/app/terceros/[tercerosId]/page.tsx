/* eslint-disable @next/next/no-html-link-for-pages */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Power,
  Wallet,
} from "lucide-react";
import { api, getErrorMessage } from "@/servicios/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Rol = "PROVEEDOR" | "PRESTADOR" | "COMERCIO" | "AFILIADO" | "OTRO";

const ROL_BADGE: Record<Rol, string> = {
  PROVEEDOR: "bg-blue-100 text-blue-800 border-blue-200",
  PRESTADOR: "bg-violet-100 text-violet-800 border-violet-200",
  COMERCIO: "bg-amber-100 text-amber-800 border-amber-200",
  AFILIADO: "bg-emerald-100 text-emerald-800 border-emerald-200",
  OTRO: "bg-neutral-100 text-neutral-700 border-neutral-200",
};
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

// PROVEEDOR/PRESTADOR/COMERCIO/OTRO: positivo = les debemos (rojo); negativo = a favor nuestro (verde).
// AFILIADO: positivo = nos debe (verde); negativo = pagado de mas (rojo).
const saldoColor = (rol: Rol, saldo: number | null | undefined) => {
  const s = saldo ?? 0;
  if (s === 0) return "text-neutral-600";
  const positivoEsBueno = rol === "AFILIADO";
  const esBueno = positivoEsBueno ? s > 0 : s < 0;
  return esBueno ? "text-emerald-700" : "text-rose-700";
};

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

  // Carga automática de cuentas cuando el tercero está disponible.
  useEffect(() => {
    if (data?.id) void loadCuentas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.id]);

  return (
    <div className="mx-auto max-w-5xl">
      {/* Toolbar */}
      <div className="mb-4 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="mb-1 h-7 gap-1.5 px-2 text-neutral-500"
          >
            <ArrowLeft className="size-4" />
            Volver
          </Button>
          <h1 className="truncate text-xl font-semibold text-neutral-900">
            {data ? data.nombre : "Tercero"}
          </h1>
          {data?.fantasia && (
            <p className="text-sm text-neutral-500">({data.fantasia})</p>
          )}
        </div>
        {data && (
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" asChild className="gap-1.5">
              <Link href={`/terceros/${data.id}/editar`}>
                <Pencil className="size-4" />
                Editar
              </Link>
            </Button>
            <Button
              variant={data.activo ? "outline" : "default"}
              size="sm"
              onClick={toggleActivo}
              className="gap-1.5"
            >
              <Power className="size-4" />
              {data.activo ? "Desactivar" : "Activar"}
            </Button>
          </div>
        )}
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

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-neutral-500">
          <Loader2 className="size-4 animate-spin" />
          Cargando…
        </div>
      ) : !data ? (
        <div className="py-16 text-center">
          <p className="text-sm font-medium text-neutral-700">No encontrado</p>
          <p className="mt-1 text-sm text-neutral-500">
            El tercero no existe o no es accesible.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Resumen */}
          <Card className="rounded-xl border-neutral-200 p-5">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Field label="CUIT" mono>
                {data.cuit || "—"}
              </Field>
              <Field label="Condición IVA">{data.condIva || "—"}</Field>
              <Field label="Tipo de persona">{data.tipoPersona || "—"}</Field>
              <Field label="Estado">
                <Badge
                  variant="outline"
                  className={
                    data.activo
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-neutral-200 bg-neutral-100 text-neutral-500"
                  }
                >
                  {data.activo ? "Activo" : "Inactivo"}
                </Badge>
              </Field>
              {data.codigo && <Field label="Código">{data.codigo}</Field>}
              {data.iibb && <Field label="Ingresos brutos">{data.iibb}</Field>}
            </div>

            <div className="mt-4">
              <p className="mb-1 text-xs font-medium uppercase tracking-wider text-neutral-400">
                Roles
              </p>
              <div className="flex flex-wrap gap-1">
                {(data.roles ?? []).length === 0 ? (
                  <span className="text-sm text-neutral-400">—</span>
                ) : (
                  (data.roles ?? []).map((r, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className={`text-[10px] ${ROL_BADGE[r.rol]}`}
                    >
                      {r.rol}
                    </Badge>
                  ))
                )}
              </div>
            </div>

            {data.notas && (
              <div className="mt-4">
                <p className="mb-1 text-xs font-medium uppercase tracking-wider text-neutral-400">
                  Notas
                </p>
                <p className="whitespace-pre-wrap text-sm text-neutral-700">
                  {data.notas}
                </p>
              </div>
            )}
          </Card>

          {/* Cuentas corrientes */}
          <Card className="rounded-xl border-neutral-200 p-5">
            <div className="mb-3 flex items-center gap-2">
              <Wallet className="size-4 text-neutral-400" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
                Cuentas corrientes
              </h2>
            </div>
            {loadingCtas ? (
              <div className="flex items-center gap-2 py-4 text-sm text-neutral-500">
                <Loader2 className="size-4 animate-spin" />
                Cargando cuentas…
              </div>
            ) : !cuentas || cuentas.length === 0 ? (
              <p className="py-2 text-sm text-neutral-500">
                Este tercero no tiene cuentas corrientes.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {cuentas.map((c) => (
                  <Link
                    key={c.id}
                    href={`/finanzas/cuentas/${c.id}`}
                    className="rounded-lg border border-neutral-200 bg-white p-3 transition hover:border-medical-300 hover:shadow-sm"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${ROL_BADGE[c.rol]}`}
                      >
                        {c.rol}
                      </Badge>
                      <span
                        className={`text-[10px] font-medium ${
                          c.activo ? "text-emerald-600" : "text-neutral-400"
                        }`}
                      >
                        {c.activo ? "Activa" : "Inactiva"}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-neutral-500">
                        Saldo actual
                      </span>
                      <span
                        className={`font-mono text-sm font-semibold tabular-nums ${
                          saldoColor(c.rol, c.saldoActual)
                        }`}
                      >
                        {fmtMoney(c.saldoActual)}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-neutral-500">
                        Saldo inicial
                      </span>
                      <span className="font-mono text-xs tabular-nums text-neutral-600">
                        {fmtMoney(c.saldoInicial)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Direcciones */}
            <Card className="rounded-xl border-neutral-200 p-5">
              <div className="mb-3 flex items-center gap-2">
                <MapPin className="size-4 text-neutral-400" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
                  Direcciones
                </h2>
              </div>
              {data.direcciones.length === 0 ? (
                <p className="text-sm text-neutral-500">Sin direcciones.</p>
              ) : (
                <ul className="space-y-2">
                  {data.direcciones.map((d) => (
                    <li
                      key={d.id}
                      className="rounded-lg border border-neutral-100 bg-neutral-50/60 p-2.5"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-neutral-800">
                          {d.etiqueta || "Dirección"}
                        </span>
                        {d.principal && (
                          <Badge variant="outline" className="text-[10px]">
                            Principal
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-neutral-600">
                        {[d.calle, d.numero].filter(Boolean).join(" ") || "—"}
                        {d.piso ? `, Piso ${d.piso}` : ""}
                        {d.dpto ? `, Dto ${d.dpto}` : ""}
                        {d.ciudad ? ` · ${d.ciudad}` : ""}
                        {d.provincia ? `, ${d.provincia}` : ""}
                        {d.cp ? ` (${d.cp})` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* Contactos */}
            <Card className="rounded-xl border-neutral-200 p-5">
              <div className="mb-3 flex items-center gap-2">
                <Mail className="size-4 text-neutral-400" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
                  Contactos
                </h2>
              </div>
              {data.contactos.length === 0 ? (
                <p className="text-sm text-neutral-500">Sin contactos.</p>
              ) : (
                <ul className="space-y-2">
                  {data.contactos.map((c) => (
                    <li
                      key={c.id}
                      className="flex items-center justify-between rounded-lg border border-neutral-100 bg-neutral-50/60 p-2.5"
                    >
                      <div className="min-w-0">
                        <span className="text-xs font-medium uppercase text-neutral-500">
                          {c.tipo.toLowerCase()}
                          {c.etiqueta ? ` · ${c.etiqueta}` : ""}
                        </span>
                        <p className="truncate text-sm text-neutral-800">
                          {c.valor}
                        </p>
                      </div>
                      {c.principal && (
                        <Badge variant="outline" className="text-[10px]">
                          Principal
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {/* Bancos */}
          <Card className="rounded-xl border-neutral-200 p-5">
            <div className="mb-3 flex items-center gap-2">
              <Banknote className="size-4 text-neutral-400" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
                Datos bancarios
              </h2>
            </div>
            {data.bancos.length === 0 ? (
              <p className="text-sm text-neutral-500">
                Sin cuentas bancarias registradas.
              </p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {data.bancos.map((b) => (
                  <li
                    key={b.id}
                    className="rounded-lg border border-neutral-100 bg-neutral-50/60 p-2.5"
                  >
                    <div className="text-sm font-medium text-neutral-800">
                      {b.tipo}
                      {b.banco ? ` · ${b.banco}` : ""}
                    </div>
                    <div className="font-mono text-xs text-neutral-600">
                      {b.numero}
                    </div>
                    {(b.titular || b.cuitTitular) && (
                      <div className="text-xs text-neutral-500">
                        Titular: {b.titular || "—"}
                        {b.cuitTitular ? ` · CUIT ${b.cuitTitular}` : ""}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

/** Campo etiqueta/valor del resumen. */
function Field({
  label,
  children,
  mono,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="mb-0.5 text-xs font-medium uppercase tracking-wider text-neutral-400">
        {label}
      </p>
      <div
        className={`text-sm text-neutral-800 ${mono ? "font-mono tabular-nums" : ""}`}
      >
        {children}
      </div>
    </div>
  );
}
