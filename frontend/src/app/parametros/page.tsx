"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, AlertCircle, Settings2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { mon } from "@/utiles/formatos";
import { getErrorMessage } from "@/servicios/api";
import {
  crearCuota04,
  crearJ17Minimo,
  crearReglaJ22,
  eliminarReglaJ22,
  eliminarUltimaCuota04,
  eliminarUltimaJ17Minimo,
  listarCuota04,
  listarJ17Minimo,
  listarReglasJ22,
  toggleReglaJ22,
  type ParametroVigencia,
  type ReglaJ22,
} from "@/servicios/suspensiones";

type Tipo = "minimo" | "cuota04";

function fmtFecha(s: string | null | undefined) {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleDateString("es-AR");
}

function ParametroPanel({
  tipo,
  titulo,
  descripcion,
  cargar,
  crear,
  eliminarUltima,
}: {
  tipo: Tipo;
  titulo: string;
  descripcion: string;
  cargar: () => Promise<ParametroVigencia[]>;
  crear: (valor: number, vigenteDesde: string) => Promise<ParametroVigencia>;
  eliminarUltima: () => Promise<unknown>;
}) {
  const [items, setItems] = useState<ParametroVigencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [valor, setValor] = useState("");
  const [vigenteDesde, setVigenteDesde] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setItems(await cargar());
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await crear(Number(valor), vigenteDesde);
      setValor("");
      await load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function onDeleteLast() {
    if (!confirm("¿Eliminar la última vigencia? Reabrirá la anterior.")) return;
    setError(null);
    try {
      await eliminarUltima();
      await load();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  }

  const vigente = items.find((i) => i.vigenteHasta === null);

  return (
    <section className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">{titulo}</h2>
          <p className="mt-1 text-sm text-neutral-500">{descripcion}</p>
        </div>
        {vigente && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-right">
            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
              Vigente
            </div>
            <div className="text-2xl font-bold tabular-nums text-emerald-900">
              {mon(vigente.valor)}
            </div>
            <div className="text-xs text-emerald-700/80">desde {fmtFecha(vigente.vigenteDesde)}</div>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={onSubmit} className="mb-6 flex flex-col gap-3 rounded-xl border border-neutral-200 bg-neutral-50/60 p-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600">
            Nuevo valor
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            required
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="Ej. 25000"
            className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-medical-400 focus:outline-none focus:ring-2 focus:ring-medical-500/30"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600">
            Vigente desde
          </label>
          <input
            type="date"
            required
            value={vigenteDesde}
            onChange={(e) => setVigenteDesde(e.target.value)}
            className="mt-1 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-medical-400 focus:outline-none focus:ring-2 focus:ring-medical-500/30"
          />
        </div>
        <Button type="submit" disabled={submitting || !valor} className="sm:mb-0">
          <Plus className="size-4" />
          {submitting ? "Guardando…" : "Agregar vigencia"}
        </Button>
      </form>

      <div className="overflow-hidden rounded-xl border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="px-4 py-2">Desde</th>
              <th className="px-4 py-2">Hasta</th>
              <th className="px-4 py-2 text-right">Valor</th>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 2 }).map((_, i) => (
                <tr key={i} className="border-t border-neutral-200">
                  <td colSpan={5} className="px-4 py-3">
                    <Skeleton className="h-4 w-full" />
                  </td>
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-neutral-500">
                  No hay vigencias registradas. Cargá la primera arriba.
                </td>
              </tr>
            ) : (
              items.map((it, idx) => {
                const esVigente = it.vigenteHasta === null;
                return (
                  <tr key={it.id} className="border-t border-neutral-200">
                    <td className="px-4 py-2 tabular-nums">{fmtFecha(it.vigenteDesde)}</td>
                    <td className="px-4 py-2 tabular-nums">{fmtFecha(it.vigenteHasta)}</td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums">
                      {mon(it.valor)}
                    </td>
                    <td className="px-4 py-2">
                      {esVigente ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                          <CheckCircle2 className="size-3" /> Vigente
                        </span>
                      ) : (
                        <span className="text-xs text-neutral-500">Histórico</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {idx === 0 && (
                        <button
                          type="button"
                          onClick={onDeleteLast}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="size-3.5" />
                          Eliminar última
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function ParametrosPage() {
  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-medical-50 text-medical-600 ring-1 ring-medical-100">
          <Settings2 className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            Parámetros de cobertura
          </h1>
          <p className="text-sm text-neutral-500">
            Valores con historia que determinan la mora del afiliado.
          </p>
        </div>
      </header>

      <ParametroPanel
        tipo="minimo"
        titulo="J17 mínimo (Activos / Jubilados / PP)"
        descripcion="Monto mínimo que la suma de J17 cobrados entre todos los padrones debe alcanzar para considerar al afiliado cubierto en el período. Si no se alcanza, se genera deuda por la diferencia."
        cargar={listarJ17Minimo}
        crear={crearJ17Minimo}
        eliminarUltima={eliminarUltimaJ17Minimo}
      />

      <ParametroPanel
        tipo="cuota04"
        titulo="J17 cuota fija (afiliados 04)"
        descripcion="Valor único de cuota J17 para afiliados sin canal automático de cobranza (tipo 04). Se genera como obligación con monto cierto desde el día 1 del período."
        cargar={listarCuota04}
        crear={crearCuota04}
        eliminarUltima={eliminarUltimaCuota04}
      />

      <ReglaJ22Panel />
    </div>
  );
}

function ReglaJ22Panel() {
  const [items, setItems] = useState<ReglaJ22[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [valor, setValor] = useState("");
  const [vigenteDesde, setVigenteDesde] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [vigenteHasta, setVigenteHasta] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await listarReglasJ22();
      setItems(r);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await crearReglaJ22(Number(valor), vigenteDesde, vigenteHasta || undefined);
      setValor("");
      setVigenteHasta("");
      await load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function onToggle(id: string, activo: boolean) {
    try {
      await toggleReglaJ22(id, activo);
      await load();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  }

  async function onDelete(id: string) {
    if (!confirm("¿Eliminar esta regla de precio?")) return;
    try {
      await eliminarReglaJ22(id);
      await load();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  }

  const vigente = items.find(
    (i) => i.activo && (i.vigenteHasta == null || new Date(i.vigenteHasta) >= new Date()),
  );

  return (
    <section className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">
            J22 — Precio del coseguro
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Valor mensual de la cuota de coseguro del titular. Se usa al
            materializar las obligaciones J22 del mes (último día hábil del
            mes anterior). Soporta vigencias con desde/hasta explícitos.
          </p>
        </div>
        {vigente && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-right">
            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
              Vigente
            </div>
            <div className="text-2xl font-bold tabular-nums text-emerald-900">
              {mon(Number(vigente.precioBase))}
            </div>
            <div className="text-xs text-emerald-700/80">
              desde {fmtFecha(vigente.vigenteDesde)}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form
        onSubmit={onSubmit}
        className="mb-6 flex flex-col gap-3 rounded-xl border border-neutral-200 bg-neutral-50/60 p-4 sm:flex-row sm:items-end"
      >
        <div className="flex-1">
          <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600">
            Precio J22
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            required
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="Ej. 4500"
            className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-medical-400 focus:outline-none focus:ring-2 focus:ring-medical-500/30"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600">
            Vigente desde
          </label>
          <input
            type="date"
            required
            value={vigenteDesde}
            onChange={(e) => setVigenteDesde(e.target.value)}
            className="mt-1 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-medical-400 focus:outline-none focus:ring-2 focus:ring-medical-500/30"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600">
            Vigente hasta (opcional)
          </label>
          <input
            type="date"
            value={vigenteHasta}
            onChange={(e) => setVigenteHasta(e.target.value)}
            className="mt-1 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-medical-400 focus:outline-none focus:ring-2 focus:ring-medical-500/30"
          />
        </div>
        <Button type="submit" disabled={submitting || !valor}>
          <Plus className="size-4" />
          {submitting ? "Guardando…" : "Agregar"}
        </Button>
      </form>

      <div className="overflow-hidden rounded-xl border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="px-4 py-2">Desde</th>
              <th className="px-4 py-2">Hasta</th>
              <th className="px-4 py-2 text-right">Precio</th>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-3">
                  <Skeleton className="h-4 w-full" />
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-neutral-500">
                  No hay reglas de J22 cargadas. Agregá la primera arriba.
                </td>
              </tr>
            ) : (
              items.map((it) => {
                const esVigente =
                  it.activo &&
                  (it.vigenteHasta == null || new Date(it.vigenteHasta) >= new Date());
                return (
                  <tr key={it.id} className="border-t border-neutral-200">
                    <td className="px-4 py-2 tabular-nums">
                      {fmtFecha(it.vigenteDesde)}
                    </td>
                    <td className="px-4 py-2 tabular-nums">
                      {fmtFecha(it.vigenteHasta)}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums">
                      {mon(Number(it.precioBase))}
                    </td>
                    <td className="px-4 py-2">
                      {esVigente ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                          <CheckCircle2 className="size-3" /> Vigente
                        </span>
                      ) : it.activo ? (
                        <span className="text-xs text-neutral-500">Histórico</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-500">
                          Desactivada
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => void onToggle(it.id, !it.activo)}
                          className="rounded-md px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100"
                        >
                          {it.activo ? "Desactivar" : "Reactivar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void onDelete(it.id)}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="size-3.5" />
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
