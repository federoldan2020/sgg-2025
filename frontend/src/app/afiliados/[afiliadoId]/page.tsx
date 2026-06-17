"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/servicios/api";
import { formatearFechaArgentina } from "@/utiles/formatos";
import { useAfiliadoDetalle } from "@/contexts/afiliadoDetalle";
import { GrupoFamiliarSection } from "@/components/coseguro/GrupoFamiliarSection";
import { CoseguroResumenSection } from "@/components/coseguro/CoseguroResumenSection";

const badgeBase =
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold";
const badgeActive = "border-emerald-200 bg-emerald-50 text-emerald-700";
const badgeInactive = "border-slate-200 bg-slate-100 text-slate-600";

type Afiliado = {
  id: string | number;
  dni: string | number;
  apellido: string;
  nombre: string;
  estado: string;
  cuit?: string | null;
  sexo?: string | null;
  tipo?: string | null;
  telefono?: string | null;
  celular?: string | null;
  calle?: string | null;
  numero?: string | null;
  orientacion?: string | null;
  barrio?: string | null;
  piso?: string | null;
  depto?: string | null;
  monoblock?: string | null;
  casa?: string | null;
  manzana?: string | null;
  localidad?: string | null;
  fechaNacimiento?: string | null;
  numeroSocio?: string | null;
  cupo?: string | number | null;
  saldo?: string | number | null;
  observaciones?: string | null;
};

type PadronLite = {
  id: string | number;
  padron: string;
  afiliadoId?: string | number;
  activo: boolean;
  sistema: string | null;
  saldo: string | number;
  cupo: string | number;
  fechaAlta?: string | null;
  fechaBaja?: string | null;
  centro?: number | null;
  j22?: string | number | null;
  j38?: string | number | null;
};

type CoseguroPanel = {
  afiliado?: { id: string | number; apellido: string; nombre: string; dni: string | number };
  coseguro: {
    id: string;
    estado: "activo" | "baja";
    fechaAlta?: string | null;
    fechaBaja?: string | null;
    padronCoseguroId?: string | number | null;
  } | null;
  padrones: { id: string | number; padron: string; activo?: boolean; sistema?: string | null }[];
  precioBase: number;
};

type Colateral = {
  id: string | number;
  nombre: string | null;
  dni: string | number | null;
  fechaNacimiento?: string | null;
  activo?: boolean | null;
  parentesco?: { codigo?: string | null; descripcion?: string | null };
};

type Movimiento = {
  id: string;
  fecha: string;
  naturaleza: "debito" | "credito";
  origen: string;
  concepto: string;
  importe: string | number;
  padronId?: string | number | null;
  saldoPosterior?: string | number | null;
};

type MovimientosResp = { movimientos: Movimiento[]; saldoFinal: number };

type PrecioCoseguro = {
  coseguro?: number | string | null;
  colaterales?: number | string | null;
  total?: number | string | null;
};

const money = (n: number | string | null | undefined) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(typeof n === "string" ? Number(n || 0) : n || 0);

const formatDni = (dni: string | number | null | undefined) => {
  if (dni == null) return "—";
  const s = String(dni).replace(/\D+/g, "");
  if (!s) return "—";
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

const formatDate = (v?: string | null) => {
  if (!v) return "—";
  return formatearFechaArgentina(v) || v;
};

const displayNombre = (apellido?: string | null, nombre?: string | null) => {
  const a = (apellido ?? "").trim();
  const n = (nombre ?? "").trim();
  if (a && n) return `${a}, ${n}`;
  if (a || n) return (a || n)!;
  return "(sin nombre)";
};

function buildDireccion(a: Afiliado | null) {
  if (!a) return "—";
  const parts = [
    a.calle,
    a.numero,
    a.orientacion,
    a.barrio ? `Barrio ${a.barrio}` : null,
    a.piso ? `Piso ${a.piso}` : null,
    a.depto ? `Dto ${a.depto}` : null,
    a.monoblock ? `Monoblock ${a.monoblock}` : null,
    a.casa ? `Casa ${a.casa}` : null,
    a.manzana ? `Mz ${a.manzana}` : null,
    a.localidad,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : "—";
}

export default function AfiliadoDatosPage() {
  const { afiliadoId } = useAfiliadoDetalle();
  const [afiliado, setAfiliado] = useState<Afiliado | null>(null);
  const [padrones, setPadrones] = useState<PadronLite[]>([]);
  const [coseguro, setCoseguro] = useState<CoseguroPanel | null>(null);
  const [familia, setFamilia] = useState<Colateral[]>([]);
  const [movs, setMovs] = useState<Movimiento[]>([]);
  const [precio, setPrecio] = useState<PrecioCoseguro | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!afiliadoId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [afiRes, padRes, cosRes, famRes, movRes, prRes] = await Promise.allSettled([
          api<Afiliado>(`/afiliados/${afiliadoId}`),
          api<PadronLite[]>(`/padrones?afiliadoId=${encodeURIComponent(afiliadoId)}`),
          api<CoseguroPanel>(`/coseguro/afiliados/${afiliadoId}`),
          api<Colateral[]>(
            `/colaterales/afiliados/${afiliadoId}/colaterales?soloActivos=false`
          ),
          api<MovimientosResp>(
            `/movimientos?afiliadoId=${encodeURIComponent(afiliadoId)}&take=200`
          ),
          api<PrecioCoseguro>(
            `/colaterales/precio?afiliadoId=${encodeURIComponent(afiliadoId)}`
          ),
        ]);

        if (cancelled) return;

        if (afiRes.status === "rejected") {
          throw new Error("No se pudo cargar el afiliado.");
        }
        setAfiliado(afiRes.value);
        setPadrones(padRes.status === "fulfilled" ? padRes.value : []);
        setCoseguro(cosRes.status === "fulfilled" ? cosRes.value : null);
        setFamilia(famRes.status === "fulfilled" ? famRes.value : []);
        const allMovs = movRes.status === "fulfilled" ? movRes.value.movimientos : [];
        setMovs(allMovs.slice(-8));
        setPrecio(prRes.status === "fulfilled" ? prRes.value : null);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Error cargando el afiliado");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [afiliadoId]);

  const padronesActivos = padrones.filter((p) => p.activo);
  const padronesMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of padrones) m.set(String(p.id), p.padron);
    return m;
  }, [padrones]);
  const saldoTotal = useMemo(
    () => padrones.reduce((acc, p) => acc + Number(p.saldo || 0), 0),
    [padrones]
  );
  const deudaTotal = useMemo(
    () =>
      padrones.reduce(
        (acc, p) => acc + (Number(p.saldo || 0) > 0 ? Number(p.saldo || 0) : 0),
        0
      ),
    [padrones]
  );
  const aFavor = useMemo(
    () =>
      padrones.reduce(
        (acc, p) =>
          acc + (Number(p.saldo || 0) < 0 ? Math.abs(Number(p.saldo || 0)) : 0),
        0
      ),
    [padrones]
  );

  if (loading) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm text-sm text-neutral-500">
        Cargando datos del afiliado…
      </div>
    );
  }

  if (error || !afiliado) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
        {error || "No se encontró el afiliado."}
      </div>
    );
  }

  const nombreCompleto = displayNombre(afiliado.apellido, afiliado.nombre);
  const coseguroEstado = coseguro?.coseguro?.estado ?? "baja";
  const coseguroPadron = coseguro?.padrones?.find(
    (p) => String(p.id) === String(coseguro?.coseguro?.padronCoseguroId ?? "")
  );

  return (
    <div className="space-y-6">
      {/* Resumen financiero */}
      <section>
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Resumen financiero
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase text-neutral-500">Saldo total</div>
            <div className="mt-2 text-xl font-semibold text-neutral-900 tabular-nums">
              {money(saldoTotal)}
            </div>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase text-neutral-500">Deuda total</div>
            <div className="mt-2 text-xl font-semibold text-rose-700 tabular-nums">
              {money(deudaTotal)}
            </div>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase text-neutral-500">A favor</div>
            <div className="mt-2 text-xl font-semibold text-emerald-700 tabular-nums">
              {money(aFavor)}
            </div>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase text-neutral-500">Padrones activos</div>
            <div className="mt-2 text-xl font-semibold text-neutral-900 tabular-nums">
              {padronesActivos.length}
            </div>
          </div>
        </div>
      </section>

      {/* Datos personales + contacto */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="text-base font-semibold text-neutral-900">Datos personales</div>
          <div className="mt-4 space-y-4 text-sm">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Nombre" value={nombreCompleto} />
              <Field label="DNI" value={formatDni(afiliado.dni)} />
              <Field label="CUIT/CUIL" value={afiliado.cuit || "—"} />
              <Field label="N° socio" value={afiliado.numeroSocio || "—"} />
              <Field label="Sexo" value={afiliado.sexo || "—"} />
              <Field label="Fecha nacimiento" value={formatDate(afiliado.fechaNacimiento)} />
            </div>
            <div className="h-px w-full bg-neutral-100" />
            <Field label="Domicilio" value={buildDireccion(afiliado)} />
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="text-base font-semibold text-neutral-900">Contacto</div>
          <div className="mt-4 space-y-3 text-sm">
            <Field label="Teléfono" value={afiliado.telefono || "—"} />
            <Field label="Celular" value={afiliado.celular || "—"} />
            <Field label="Cupo general" value={money(afiliado.cupo)} />
            <Field label="Saldo general" value={money(afiliado.saldo)} />
          </div>
        </div>
      </section>

      {/* Padrones + coseguro */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="text-base font-semibold text-neutral-900">Padrones</div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-xs uppercase text-neutral-500">
                <tr>
                  <th className="py-2 text-left">Padrón</th>
                  <th className="py-2 text-left">Sistema</th>
                  <th className="py-2 text-left">Centro</th>
                  <th className="py-2 text-left">Estado</th>
                  <th className="py-2 text-right">Saldo</th>
                  <th className="py-2 text-right">Cupo</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {padrones.map((p) => (
                  <tr key={String(p.id)} className="hover:bg-neutral-50">
                    <td className="py-2 font-semibold">{p.padron}</td>
                    <td className="py-2">{p.sistema || "—"}</td>
                    <td className="py-2">{p.centro ?? "—"}</td>
                    <td className="py-2">
                      <span
                        className={`${badgeBase} ${
                          p.activo ? badgeActive : badgeInactive
                        }`}
                      >
                        {p.activo ? "Activo" : "Baja"}
                      </span>
                    </td>
                    <td className="py-2 text-right tabular-nums">{money(p.saldo)}</td>
                    <td className="py-2 text-right tabular-nums">{money(p.cupo)}</td>
                  </tr>
                ))}
                {padrones.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-sm text-neutral-500">
                      No hay padrones asociados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <CoseguroResumenSection
          afiliadoId={afiliado.id}
          estado={coseguroEstado === "activo" ? "activo" : coseguro?.coseguro ? "baja" : "ninguno"}
          precioJ22={precio?.coseguro ?? coseguro?.precioBase ?? 0}
          precioJ38={precio?.colaterales ?? 0}
          padronImputacion={coseguroPadron?.padron ?? null}
          fechaAlta={coseguro?.coseguro?.fechaAlta ?? null}
        />
      </section>

      {/* Grupo familiar + observaciones */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <GrupoFamiliarSection afiliadoId={afiliado.id} integrantes={familia} />
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="text-base font-semibold text-neutral-900">Observaciones</div>
          <div className="mt-4 text-sm text-neutral-700">
            {afiliado.observaciones ? (
              <p className="whitespace-pre-line">{afiliado.observaciones}</p>
            ) : (
              <span className="text-neutral-500">Sin observaciones</span>
            )}
          </div>
        </div>
      </section>

      {/* Últimos movimientos */}
      <section>
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-base font-semibold text-neutral-900">Últimos movimientos</div>
            <a
              className="inline-flex items-center rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-neutral-800"
              href={`/afiliados/${afiliado.id}/cuenta-corriente`}
            >
              Ver cuenta corriente
            </a>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-xs uppercase text-neutral-500">
                <tr>
                  <th className="py-2 text-left">Fecha</th>
                  <th className="py-2 text-left">Padrón</th>
                  <th className="py-2 text-left">Concepto</th>
                  <th className="py-2 text-right">Debe</th>
                  <th className="py-2 text-right">Haber</th>
                  <th className="py-2 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {movs.map((m) => {
                  const isDeb = m.naturaleza === "debito";
                  const padronStr = m.padronId
                    ? padronesMap.get(String(m.padronId))
                    : null;
                  return (
                    <tr key={m.id} className="hover:bg-neutral-50">
                      <td className="py-2">{formatDate(m.fecha)}</td>
                      <td className="py-2 font-mono text-xs text-neutral-600">
                        {padronStr ?? "—"}
                      </td>
                      <td className="py-2">
                        <div className="font-semibold" title={m.concepto}>
                          {m.concepto}
                        </div>
                        <div className="text-xs text-neutral-500">
                          {m.origen.replace(/_/g, " ")}
                        </div>
                      </td>
                      <td className="py-2 text-right text-rose-700 tabular-nums">
                        {isDeb ? money(m.importe) : "—"}
                      </td>
                      <td className="py-2 text-right text-emerald-700 tabular-nums">
                        {isDeb ? "—" : money(m.importe)}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {m.saldoPosterior == null ? "—" : money(m.saldoPosterior)}
                      </td>
                    </tr>
                  );
                })}
                {movs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-sm text-neutral-500">
                      Sin movimientos registrados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="font-semibold text-neutral-900">{value}</div>
    </div>
  );
}
