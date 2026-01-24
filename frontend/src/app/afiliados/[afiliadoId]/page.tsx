"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/servicios/api";
import { formatearFechaArgentina } from "@/utiles/formatos";
const badgeBase =
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold";
const badgeActive = "border-emerald-200 bg-emerald-50 text-emerald-700";
const badgeInactive = "border-slate-200 bg-slate-100 text-slate-600";

type Afiliado = {
  id: string | number;
  dni: string | number;
  apellido: string;
  nombre: string;
  estado: "activo" | "baja";
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
  saldoPosterior?: string | number | null;
};

type MovimientosResp = { movimientos: Movimiento[]; saldoFinal: number };

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

export default function AfiliadoDetallePage() {
  const { afiliadoId } = useParams<{ afiliadoId: string }>();
  const [afiliado, setAfiliado] = useState<Afiliado | null>(null);
  const [padrones, setPadrones] = useState<PadronLite[]>([]);
  const [coseguro, setCoseguro] = useState<CoseguroPanel | null>(null);
  const [familia, setFamilia] = useState<Colateral[]>([]);
  const [movs, setMovs] = useState<Movimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!afiliadoId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [afiRes, padRes, cosRes, famRes, movRes] = await Promise.allSettled([
          api<Afiliado>(`/afiliados/${afiliadoId}`),
          api<PadronLite[]>(`/padrones?afiliadoId=${encodeURIComponent(afiliadoId)}`),
          api<CoseguroPanel>(`/coseguro/afiliados/${afiliadoId}`),
          api<Colateral[]>(
            `/colaterales/afiliados/${afiliadoId}/colaterales?soloActivos=false`
          ),
          api<MovimientosResp>(
            `/movimientos?afiliadoId=${encodeURIComponent(afiliadoId)}&take=200`
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
  const saldoTotal = useMemo(
    () => padrones.reduce((acc, p) => acc + Number(p.saldo || 0), 0),
    [padrones]
  );
  const deudaTotal = useMemo(
    () => padrones.reduce((acc, p) => acc + (Number(p.saldo || 0) > 0 ? Number(p.saldo || 0) : 0), 0),
    [padrones]
  );
  const aFavor = useMemo(
    () => padrones.reduce((acc, p) => acc + (Number(p.saldo || 0) < 0 ? Math.abs(Number(p.saldo || 0)) : 0), 0),
    [padrones]
  );

  if (loading) {
    return (
      <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="text-sm text-slate-500">Cargando afiliado...</div>
        </div>
      </section>
    );
  }

  if (error || !afiliado) {
    return (
      <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-sm text-red-700">
          {error || "No se encontró el afiliado."}
        </div>
      </section>
    );
  }

  const nombreCompleto = displayNombre(afiliado.apellido, afiliado.nombre);
  const estadoActivo = afiliado.estado === "activo";
  const coseguroEstado = coseguro?.coseguro?.estado ?? "baja";
  const coseguroPadron = coseguro?.padrones?.find(
    (p) => String(p.id) === String(coseguro?.coseguro?.padronCoseguroId ?? "")
  );

  return (
    <section className="min-h-dvh bg-gradient-to-b from-slate-50 via-white to-white">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 rounded-3xl border border-slate-100 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Afiliado #{afiliado.id}
              </div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">
                {nombreCompleto}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                <span>DNI {formatDni(afiliado.dni)}</span>
                <span className="text-slate-300">•</span>
                <span>{afiliado.tipo || "Sin tipo"}</span>
                <span className="text-slate-300">•</span>
                <span
                  className={`${badgeBase} ${
                    estadoActivo ? badgeActive : badgeInactive
                  }`}
                >
                  {estadoActivo ? "Activo" : "Baja"}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                href={`/afiliados/nuevo?afiliadoId=${afiliado.id}`}
              >
                Editar afiliado
              </a>
              <a
                className="inline-flex items-center rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
                href={`/movimientos?afiliadoId=${afiliado.id}`}
              >
                Ver movimientos
              </a>
              <a
                className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                href="/caja"
              >
                Registrar pago
              </a>
              <a
                className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                href={`/coseguro/${afiliado.id}`}
              >
                Coseguro y colaterales
              </a>
            </div>
          </div>
        </header>

        <section className="mb-6">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Resumen financiero
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs font-semibold uppercase text-slate-500">
                Saldo total
              </div>
              <div className="mt-2 text-xl font-semibold text-slate-900">
                {money(saldoTotal)}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs font-semibold uppercase text-slate-500">
                Deuda total
              </div>
              <div className="mt-2 text-xl font-semibold text-rose-700">
                {money(deudaTotal)}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs font-semibold uppercase text-slate-500">
                A favor
              </div>
              <div className="mt-2 text-xl font-semibold text-emerald-700">
                {money(aFavor)}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs font-semibold uppercase text-slate-500">
                Padrones activos
              </div>
              <div className="mt-2 text-xl font-semibold text-slate-900">
                {padronesActivos.length}
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-base font-semibold text-slate-900">
              Datos personales
            </div>
            <div className="mt-4 space-y-4 text-sm">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <div className="text-xs text-muted-foreground">Nombre</div>
                  <div className="font-semibold text-slate-900">{nombreCompleto}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">DNI</div>
                  <div className="font-semibold text-slate-900">{formatDni(afiliado.dni)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">CUIT/CUIL</div>
                  <div className="font-semibold text-slate-900">
                    {afiliado.cuit || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">N° socio</div>
                  <div className="font-semibold text-slate-900">
                    {afiliado.numeroSocio || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Sexo</div>
                  <div className="font-semibold text-slate-900">
                    {afiliado.sexo || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Fecha nacimiento</div>
                  <div className="font-semibold text-slate-900">
                    {formatDate(afiliado.fechaNacimiento)}
                  </div>
                </div>
              </div>
              <div className="h-px w-full bg-slate-100" />
              <div>
                <div className="text-xs text-muted-foreground">Domicilio</div>
                <div className="font-medium text-slate-900">{buildDireccion(afiliado)}</div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-base font-semibold text-slate-900">Contacto</div>
            <div className="mt-4 space-y-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Teléfono</div>
                <div className="font-semibold text-slate-900">
                  {afiliado.telefono || "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Celular</div>
                <div className="font-semibold text-slate-900">
                  {afiliado.celular || "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Cupo general</div>
                <div className="font-semibold text-slate-900">
                  {money(afiliado.cupo)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Saldo general</div>
                <div className="font-semibold text-slate-900">
                  {money(afiliado.saldo)}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-base font-semibold text-slate-900">Padrones</div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-xs uppercase text-slate-500">
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
                    <tr key={String(p.id)} className="hover:bg-slate-50">
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
                      <td className="py-2 text-right tabular-nums">
                        {money(p.saldo)}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {money(p.cupo)}
                      </td>
                    </tr>
                ))}
                {padrones.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-6 text-center text-sm text-slate-500"
                      >
                        No hay padrones asociados
                      </td>
                    </tr>
                )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-base font-semibold text-slate-900">Coseguro</div>
            <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between">
                <span className="text-slate-500">Estado</span>
                <span
                  className={`${badgeBase} ${
                    coseguroEstado === "activo" ? badgeActive : badgeInactive
                  }`}
                >
                  {coseguroEstado === "activo" ? "Activo" : "Baja"}
                </span>
            </div>
            <div className="flex items-center justify-between">
                <span className="text-slate-500">J22 base</span>
                <span className="font-semibold">{money(coseguro?.precioBase ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between">
                <span className="text-slate-500">Padrón imputación</span>
                <span className="font-semibold">{coseguroPadron?.padron || "—"}</span>
            </div>
              <div className="h-px w-full bg-slate-100" />
              <div className="text-xs text-slate-500">
                Este panel refleja la configuración vigente del coseguro J22.
              </div>
            </div>
          </div>
      </section>

        <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-base font-semibold text-slate-900">Grupo familiar</div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-2 text-left">Nombre</th>
                    <th className="py-2 text-left">Parentesco</th>
                    <th className="py-2 text-left">DNI</th>
                    <th className="py-2 text-left">Fecha nac.</th>
                    <th className="py-2 text-left">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                {familia.map((f) => (
                    <tr key={String(f.id)} className="hover:bg-slate-50">
                      <td className="py-2 font-semibold">
                        {f.nombre || "—"}
                      </td>
                      <td className="py-2">
                        {f.parentesco?.descripcion || f.parentesco?.codigo || "—"}
                      </td>
                      <td className="py-2">{formatDni(f.dni)}</td>
                      <td className="py-2">{formatDate(f.fechaNacimiento)}</td>
                      <td className="py-2">
                        <span
                          className={`${badgeBase} ${
                            f.activo ? badgeActive : badgeInactive
                          }`}
                        >
                          {f.activo ? "Activo" : "Baja"}
                        </span>
                      </td>
                    </tr>
                ))}
                {familia.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-6 text-center text-sm text-slate-500"
                      >
                        Sin integrantes cargados
                      </td>
                    </tr>
                )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-base font-semibold text-slate-900">Observaciones</div>
            <div className="mt-4 text-sm text-slate-700">
              {afiliado.observaciones ? (
                <p className="whitespace-pre-line">{afiliado.observaciones}</p>
              ) : (
                <span className="text-slate-500">Sin observaciones</span>
              )}
            </div>
          </div>
      </section>

        <section className="mt-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-base font-semibold text-slate-900">
                Últimos movimientos
              </div>
              <a
                className="inline-flex items-center rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800"
                href={`/movimientos?afiliadoId=${afiliado.id}`}
              >
                Ver cuenta completa
              </a>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-2 text-left">Fecha</th>
                    <th className="py-2 text-left">Concepto</th>
                    <th className="py-2 text-right">Debe</th>
                    <th className="py-2 text-right">Haber</th>
                    <th className="py-2 text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                {movs.map((m) => {
                  const isDeb = m.naturaleza === "debito";
                  return (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="py-2">{formatDate(m.fecha)}</td>
                      <td className="py-2">
                        <div className="font-semibold" title={m.concepto}>
                          {m.concepto}
                        </div>
                        <div className="text-xs text-slate-500">
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
                    <td
                      colSpan={5}
                      className="py-6 text-center text-sm text-slate-500"
                    >
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
    </section>
  );
}
