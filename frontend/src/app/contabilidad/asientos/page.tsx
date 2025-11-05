"use client";
import { useEffect, useMemo, useState } from "react";
import { api, getErrorMessage } from "@/servicios/api";
import Link from "next/link";

type Row = {
  id: string;
  fecha: string; // o Date si parseás
  descripcion: string | null;
  origen: string | null;
  referenciaId: string | null;
  totalDebe: number;
  totalHaber: number;
};

export default function AsientosPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [q, setQ] = useState("");
  const [origen, setOrigen] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const cargar = async (p = 1) => {
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (origen) params.set("origen", origen);
      if (desde) params.set("desde", desde);
      if (hasta) params.set("hasta", hasta);
      params.set("page", String(p));
      params.set("pageSize", "20");

      const r = await api<{
        items: Row[];
        pages: number;
        page: number;
        total: number;
      }>(`/contabilidad/asientos?${params.toString()}`);
      setItems(r.items);
      setPage(r.page);
      setPages(r.pages);
      setMsg(null);
    } catch (e) {
      setMsg(getErrorMessage(e));
    }
  };

  useEffect(() => {
    void cargar(1);
  }, []); // carga inicial

  const urlExport = useMemo(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (origen) params.set("origen", origen);
    if (desde) params.set("desde", desde);
    if (hasta) params.set("hasta", hasta);
    return `${
      process.env.NEXT_PUBLIC_API_URL
    }/contabilidad/asientos/export/csv?${params.toString()}`;
  }, [q, origen, desde, hasta]);

  return (
    <main style={{ padding: 24 }}>
      <h1>Asientos</h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 8,
          maxWidth: 980,
        }}
      >
        <input
          placeholder="Buscar…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select value={origen} onChange={(e) => setOrigen(e.target.value)}>
          <option value="">(todos)</option>
          <option value="pago_caja">pago_caja</option>
          <option value="cierre_caja">cierre_caja</option>
        </select>
        <input
          type="date"
          value={desde}
          onChange={(e) => setDesde(e.target.value)}
        />
        <input
          type="date"
          value={hasta}
          onChange={(e) => setHasta(e.target.value)}
        />
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => cargar(1)}>Filtrar</button>
          <a href={urlExport}>Export CSV</a>
        </div>
      </div>

      {msg && <p style={{ color: "crimson" }}>{msg}</p>}

      <table
        style={{ width: "100%", marginTop: 12, borderCollapse: "collapse" }}
      >
        <thead>
          <tr>
            <th align="left">Fecha</th>
            <th align="left">Origen</th>
            <th align="left">Ref</th>
            <th align="left">Descripción</th>
            <th align="right">Debe</th>
            <th align="right">Haber</th>
          </tr>
        </thead>
        <tbody>
          {items.map((r) => (
            <tr key={r.id} style={{ borderTop: "1px solid #eee" }}>
              <td>{new Date(r.fecha).toLocaleDateString()}</td>
              <td>{r.origen}</td>
              <td>{r.referenciaId}</td>
              <td>
                <Link href={`/contabilidad/asientos/${r.id}`}>
                  {r.descripcion ?? "(sin desc.)"}
                </Link>
              </td>
              <td align="right">{r.totalDebe.toFixed(2)}</td>
              <td align="right">{r.totalHaber.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <button disabled={page <= 1} onClick={() => cargar(page - 1)}>
          ←
        </button>
        <span>
          Página {page} / {pages}
        </span>
        <button disabled={page >= pages} onClick={() => cargar(page + 1)}>
          →
        </button>
      </div>
    </main>
  );
}
