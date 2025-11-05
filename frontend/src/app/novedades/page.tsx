/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, useMemo, useState } from "react";
import { api, getErrorMessage } from "@/servicios/api";
import styles from "../../components/novedades/MonitorNovedades.module.css";

type ResumenItem = {
  periodo: string;
  padronId: string;
  padron: string | null;
  centro: number | null;
  sistema: "ES" | "SG" | null;
  J17: number | null;
  J22: number | null;
  J38: number | null;
  K16: number | null;
  ocurridoEn: string | null; // ISO
};

type Paged<T> = { items: T[]; total: number; page: number; limit: number };

function toLocalAR(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("es-AR", { hour12: false });
}

function qs(params: Record<string, any>) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    if (Array.isArray(v)) {
      if (v.length) q.set(k, v.join(","));
    } else {
      q.set(k, String(v));
    }
  });
  return q.toString();
}

export default function MonitorNovedadesPage() {
  // Periodo por defecto: mes actual
  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const periodoHoy = `${today.getFullYear()}-${pad(today.getMonth() + 1)}`;

  const [periodo, setPeriodo] = useState(periodoHoy);
  const [sistema, setSistema] = useState<"" | "ES" | "SG">("");
  const [qtext, setQtext] = useState("");

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const [items, setItems] = useState<ResumenItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const lastPage = Math.max(1, Math.ceil((total || 0) / (limit || 20)));

  const listQS = useMemo(
    () =>
      qs({
        periodo,
        sistema: sistema || undefined,
        q: qtext || undefined,
        page,
        limit,
      }),
    [periodo, sistema, qtext, page, limit]
  );

  const cargar = async () => {
    setMsg(null);
    setLoading(true);
    try {
      const data = (await api(`/novedades/pendientes/resumen?${listQS}`, {
        method: "GET",
      })) as Paged<ResumenItem>;
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (e) {
      setMsg(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [periodo, sistema, qtext, limit]);

  useEffect(() => {
    void cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listQS]);

  const exportCSV = async () => {
    try {
      const data = (await api(
        `/novedades/pendientes/resumen?${qs({
          periodo,
          sistema: sistema || undefined,
          q: qtext || undefined,
          page: 1,
          limit: 5000,
        })}`,
        { method: "GET" }
      )) as Paged<ResumenItem>;

      const headers = [
        "Periodo",
        "PadronId",
        "Padron",
        "Centro",
        "Sistema",
        "J17",
        "J22",
        "J38",
        "K16",
        "UltimoEvento",
      ];
      const escape = (v: any) => {
        const s = v == null ? "" : String(v).replace(/\"/g, '""');
        return /[",\n]/.test(s) ? `"${s}"` : s;
      };
      const lines = [headers.join(",")];
      for (const r of data.items ?? []) {
        const row = [
          r.periodo || "",
          r.padronId || "",
          r.padron ?? "",
          r.centro ?? "",
          r.sistema ?? "",
          r.J17 ?? "",
          r.J22 ?? "",
          r.J38 ?? "",
          r.K16 ?? "",
          toLocalAR(r.ocurridoEn),
        ].map(escape);
        lines.push(row.join(","));
      }
      const blob = new Blob([lines.join("\n")], {
        type: "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `resumen_padron_${periodo}${
        sistema ? "_" + sistema : ""
      }.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setMsg(getErrorMessage(e));
    }
  };

  const aplicarPeriodo = () => {
    if (!/^\d{4}-\d{2}$/.test(periodo)) {
      setMsg("Periodo inválido. Formato esperado: YYYY-MM");
      return;
    }
    void cargar();
  };

  const money = (n: number | null) =>
    n == null
      ? "—"
      : Number(n).toLocaleString("es-AR", { minimumFractionDigits: 2 });

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Novedades – Vista unificada (por padrón)</h1>
      </div>

      <div className={styles.content}>
        {/* Card de Filtros */}
        <div className={styles.card}>
          <div className={styles.cardBody}>
            <div className={styles.filtersGrid}>
              {/* Periodo */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Periodo (YYYY-MM)</label>
                <div className={styles.inputGroup}>
                  <input
                    className={styles.formControl}
                    placeholder="YYYY-MM"
                    value={periodo}
                    onChange={(e) => setPeriodo(e.target.value)}
                  />
                  <button
                    className={`${styles.btn} ${styles.btnSecondary}`}
                    onClick={aplicarPeriodo}
                  >
                    Aplicar
                  </button>
                </div>
              </div>

              {/* Sistema */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Sistema</label>
                <select
                  className={styles.formControl}
                  value={sistema}
                  onChange={(e) => setSistema(e.target.value as "" | "ES" | "SG")}
                >
                  <option value="">Todos</option>
                  <option value="ES">ES</option>
                  <option value="SG">SG</option>
                </select>
              </div>

              {/* Búsqueda */}
              <div className={`${styles.formGroup} ${styles.searchGroup}`}>
                <label className={styles.formLabel}>Buscar padrón</label>
                <input
                  className={styles.formControl}
                  value={qtext}
                  onChange={(e) => setQtext(e.target.value)}
                  placeholder="Ej: 123456-7 o 12/3456"
                />
              </div>

              {/* Filas por página */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Filas por página</label>
                <select
                  className={styles.formControl}
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                >
                  {[10, 20, 50, 100].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>

              {/* Acciones */}
              <div className={styles.filterActions}>
                <button
                  className={`${styles.btn} ${styles.btnSecondary}`}
                  onClick={cargar}
                >
                  🔄 Refrescar
                </button>
                <button
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  onClick={exportCSV}
                >
                  📥 Exportar CSV
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Mensajes de error */}
        {msg && (
          <div className={styles.alert}>
            <strong>⚠️ Error:</strong> {msg}
          </div>
        )}

        {/* Tabla */}
        <div className={styles.card}>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead className={styles.tableHeader}>
                <tr>
                  <th>Padrón</th>
                  <th>Centro</th>
                  <th>Sistema</th>
                  <th className={styles.textRight}>J17</th>
                  <th className={styles.textRight}>J22</th>
                  <th className={styles.textRight}>J38</th>
                  <th className={styles.textRight}>K16</th>
                  <th>Último evento</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={8} className={styles.loadingCell}>
                      <div className={styles.loadingSpinner}></div>
                      <span>Cargando datos...</span>
                    </td>
                  </tr>
                )}
                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={8} className={styles.emptyCell}>
                      Sin resultados para los filtros seleccionados
                    </td>
                  </tr>
                )}
                {!loading &&
                  items.map((r) => (
                    <tr key={r.padronId} className={styles.tableRow}>
                      <td>
                        <span className={styles.padronBadge}>
                          {r.padron ?? "—"}
                        </span>
                      </td>
                      <td>{r.centro ?? "—"}</td>
                      <td>
                        {r.sistema && (
                          <span className={`${styles.systemBadge} ${styles[`system${r.sistema}`]}`}>
                            {r.sistema}
                          </span>
                        )}
                      </td>
                      <td className={styles.textRight}>
                        <span className={styles.moneyValue}>{money(r.J17)}</span>
                      </td>
                      <td className={styles.textRight}>
                        <span className={styles.moneyValue}>{money(r.J22)}</span>
                      </td>
                      <td className={styles.textRight}>
                        <span className={styles.moneyValue}>{money(r.J38)}</span>
                      </td>
                      <td className={styles.textRight}>
                        <span className={styles.moneyValue}>{money(r.K16)}</span>
                      </td>
                      <td className={styles.dateCell}>{toLocalAR(r.ocurridoEn)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          <div className={styles.pagination}>
            <div className={styles.paginationInfo}>
              <strong>{total}</strong> resultados • Página <strong>{page}</strong> de <strong>{lastPage}</strong>
            </div>
            <div className={styles.paginationActions}>
              <button
                className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ← Anterior
              </button>
              <button
                className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
                disabled={page >= lastPage}
                onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
              >
                Siguiente →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}