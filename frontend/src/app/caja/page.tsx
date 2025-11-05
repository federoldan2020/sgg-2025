"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  cajaService,
  AfiliadoSuggest,
  ObligPend,
} from "@/servicios/cajaService";
import { getErrorMessage } from "@/servicios/api";

type MetodoRow = {
  metodo: "efectivo" | "tarjeta" | "mercadopago" | "otro";
  monto: string;
  ref?: string;
};
type AplicRow = { obligacionId: string; monto: string };

export default function CajaCobrosPage() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const st = await cajaService.estado();
      if (!st.abierta || !st.cajaId) router.replace("/caja/apertura");
    })();
  }, [router]);

  const [afQuery, setAfQuery] = useState("");
  const [afOpts, setAfOpts] = useState<AfiliadoSuggest[]>([]);
  const [afi, setAfi] = useState<AfiliadoSuggest | null>(null);
  const [pend, setPend] = useState<ObligPend[]>([]);
  const [aplic, setAplic] = useState<AplicRow[]>([]);
  const [metodos, setMetodos] = useState<MetodoRow[]>([
    { metodo: "efectivo", monto: "0", ref: "" },
  ]);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const toNum = (v: string) =>
    Number.isFinite(+v)
      ? parseFloat(v)
      : parseFloat(String(v).replace(",", ".")) || 0;
  const fmt = (n: number) =>
    new Intl.NumberFormat("es-AR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);

  // suggest
  useEffect(() => {
    let cancel = false;
    (async () => {
      if (afQuery.length < 2) return setAfOpts([]);
      const r = await cajaService.suggestAfiliados(afQuery).catch(() => []);
      if (!cancel) setAfOpts(r);
    })();
    return () => {
      cancel = true;
    };
  }, [afQuery]);

  // pendientes
  useEffect(() => {
    (async () => {
      setPend([]);
      setAplic([]);
      if (!afi) return;
      const r = await cajaService.pendientesAfiliado(afi.id).catch(() => []);
      setPend(r);
    })();
  }, [afi]);

  const totalAplic = useMemo(
    () => aplic.reduce((a, b) => a + toNum(b.monto), 0),
    [aplic]
  );
  const totalMetodos = useMemo(
    () => metodos.reduce((a, b) => a + toNum(b.monto), 0),
    [metodos]
  );
  const diff = useMemo(
    () => +(totalMetodos - totalAplic).toFixed(2),
    [totalMetodos, totalAplic]
  );

  const pagarTodo = (o: ObligPend) => {
    const v = [...aplic];
    const i = v.findIndex((x) => x.obligacionId === o.id);
    if (i === -1) v.push({ obligacionId: o.id, monto: o.saldo.toFixed(2) });
    else v[i].monto = o.saldo.toFixed(2);
    setAplic(v);
  };

  const cobrar = async () => {
    try {
      setLoading(true);
      setMsg(null);
      if (!afi) throw new Error("Seleccioná un afiliado.");
      if (aplic.length === 0) throw new Error("No hay aplicaciones.");
      if (Math.abs(diff) > 0.01)
        throw new Error("Total métodos debe igualar total aplicado.");

      const { cajaId } = await cajaService.estado();
      const payload = {
        cajaId: Number(cajaId),
        afiliadoId: Number(afi.id),
        metodos: metodos.map((m) => ({
          metodo: m.metodo,
          monto: toNum(m.monto),
          ref: m.ref ?? null,
        })),
        aplicaciones: aplic.map((a) => ({
          obligacionId: Number(a.obligacionId),
          monto: toNum(a.monto),
        })),
      };

      const r = await cajaService.cobrar(payload);
      setMsg(
        `Pago OK. Recibo #${String(r.id)} — Total $${fmt(Number(r.total))}`
      );
      setMetodos([{ metodo: "efectivo", monto: "0", ref: "" }]);
      setAplic([]);
    } catch (e) {
      setMsg(`Error: ${getErrorMessage(e)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Caja · Cobros</h1>
          <p className="text-sm text-muted-foreground">
            Registrar pagos de afiliados
          </p>
        </div>
        <button
          className="btn btn-warning"
          onClick={() => router.push("/caja/cierre")}
        >
          Ir a cierre
        </button>
      </div>

      {msg && (
        <div
          className={`text-sm ${
            msg.startsWith("Error") ? "text-red-600" : "text-green-700"
          }`}
        >
          {msg}
        </div>
      )}

      {/* Afiliado */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Buscar afiliado</label>
        <input
          className="form-input"
          placeholder="DNI o nombre…"
          value={afQuery}
          onChange={(e) => {
            setAfQuery(e.target.value);
            setAfi(null);
          }}
        />
        {afQuery.length >= 2 && !afi && afOpts.length > 0 && (
          <div className="border rounded p-2 space-y-1">
            {afOpts.map((o) => (
              <button
                key={o.id}
                className="w-full text-left hover:bg-neutral-100 px-2 py-1 rounded"
                onClick={() => {
                  setAfi(o);
                  setAfQuery(o.display);
                }}
              >
                {o.display} — DNI {o.dni}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Pendientes */}
      <div className="overflow-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50">
            <tr>
              <th className="p-2 text-left">Padrón</th>
              <th className="p-2 text-left">Concepto</th>
              <th className="p-2 text-right">Saldo</th>
              <th className="p-2 text-right">Aplicar</th>
              <th className="p-2 text-center">—</th>
            </tr>
          </thead>
          <tbody>
            {pend.length === 0 && (
              <tr>
                <td className="p-3 text-center text-neutral-500" colSpan={5}>
                  {afi ? "Sin pendientes" : "Seleccioná un afiliado"}
                </td>
              </tr>
            )}
            {pend.map((o) => {
              const row = aplic.find((x) => x.obligacionId === o.id);
              return (
                <tr key={o.id} className="border-t">
                  <td className="p-2">{o.padronLabel}</td>
                  <td className="p-2">{o.concepto}</td>
                  <td className="p-2 text-right">$ {fmt(o.saldo)}</td>
                  <td className="p-2 text-right">
                    <input
                      className="w-36 text-right border rounded px-2 py-1"
                      type="number"
                      step="0.01"
                      value={row?.monto ?? ""}
                      onChange={(e) => {
                        const v = [...aplic];
                        const i = v.findIndex((x) => x.obligacionId === o.id);
                        if (i === -1)
                          v.push({ obligacionId: o.id, monto: e.target.value });
                        else v[i].monto = e.target.value;
                        setAplic(v);
                      }}
                    />
                  </td>
                  <td className="p-2 text-center">
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => pagarTodo(o)}
                    >
                      Pagar todo
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Métodos */}
      <div className="overflow-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50">
            <tr>
              <th className="p-2 text-left">Método</th>
              <th className="p-2 text-right">Monto</th>
              <th className="p-2">Ref</th>
              <th className="p-2 text-center">—</th>
            </tr>
          </thead>
          <tbody>
            {metodos.map((m, i) => (
              <tr key={i} className="border-t">
                <td className="p-2">
                  <select
                    className="border rounded px-2 py-1"
                    value={m.metodo}
                    onChange={(e) => {
                      const v = [...metodos];
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      v[i].metodo = e.target.value as any;
                      setMetodos(v);
                    }}
                  >
                    <option value="efectivo">Efectivo</option>
                    <option value="tarjeta">Tarjeta</option>
                    <option value="mercadopago">MercadoPago</option>
                    <option value="otro">Otro</option>
                  </select>
                </td>
                <td className="p-2 text-right">
                  <input
                    className="w-36 text-right border rounded px-2 py-1"
                    type="number"
                    step="0.01"
                    value={m.monto}
                    onChange={(e) => {
                      const v = [...metodos];
                      v[i].monto = e.target.value;
                      setMetodos(v);
                    }}
                  />
                </td>
                <td className="p-2">
                  <input
                    className="w-56 border rounded px-2 py-1"
                    value={m.ref ?? ""}
                    onChange={(e) => {
                      const v = [...metodos];
                      v[i].ref = e.target.value;
                      setMetodos(v);
                    }}
                    placeholder="N° operación, etc."
                  />
                </td>
                <td className="p-2 text-center">
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() =>
                      setMetodos(metodos.filter((_, j) => j !== i))
                    }
                    disabled={metodos.length === 1}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        className={`btn ${
          afi && aplic.length > 0 && Math.abs(diff) <= 0.01
            ? "btn-success"
            : "btn-disabled"
        }`}
        onClick={cobrar}
        disabled={
          !afi || aplic.length === 0 || Math.abs(diff) > 0.01 || loading
        }
      >
        {loading ? "Procesando…" : "Confirmar Cobro"}
      </button>
    </div>
  );
}
