"use client";

import { useState } from "react";
import { getErrorMessage, ORG } from "@/servicios/api";
import Link from "next/link";

// === Respuesta del backend /comercios/import ===
type ImportResultado = {
  dryRun: boolean;
  procesados: number;
  insertados: number;
  actualizados: number;
  saltados: number;
  errores: { row: number; msg: string }[];
};

export default function ImportarComerciosPage() {
  const API = process.env.NEXT_PUBLIC_API_URL!;
  const [file, setFile] = useState<File | null>(null);
  const [dryRun, setDryRun] = useState(true);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [res, setRes] = useState<ImportResultado | null>(null);

  const subir = async () => {
    try {
      setLoading(true);
      setMsg(null);
      setRes(null);
      if (!file) throw new Error("Seleccioná un archivo CSV");

      const fd = new FormData();
      fd.append("file", file);

      const url = `${API}/comercios/import?dry=${dryRun ? "true" : "false"}`;
      const r = await fetch(url, {
        method: "POST",
        body: fd, // NO setear Content-Type
        headers: { "X-Organizacion-ID": ORG },
        cache: "no-store",
      });

      const text = await r.text();
      if (!r.ok) throw new Error(text || r.statusText);

      // El importador responde JSON
      const data = JSON.parse(text) as ImportResultado;
      setRes(data);

      setMsg(
        (dryRun ? "Previsualización OK. " : "Importación OK. ") +
          `Procesados: ${data.procesados}. ` +
          `Insertados: ${data.insertados}. ` +
          `Actualizados: ${data.actualizados}. ` +
          `Saltados: ${data.saltados}. ` +
          `Errores: ${data.errores?.length ?? 0}.`
      );
    } catch (e) {
      setMsg(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  // Helpers CSV para descargar errores
  const toCsv = (rows: string[][]) =>
    rows
      .map((r) =>
        r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")
      )
      .join("\r\n");

  const downloadErroresCsv = () => {
    if (!res?.errores?.length) return;
    const header = ["row", "msg"];
    const body = res.errores.map((e) => [String(e.row), e.msg]);
    const csv = toCsv([header, ...body]);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "comercios_errores.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const descargarTemplate = () => {
    const cols = [
      "CODIGO",
      "RAZON_SOC",
      "DOMICILIO",
      "LOCALIDAD",
      "INGRESO",
      "TELEFONO1",
      "TELEFONO2",
      "EMAIL",
      "GRUPO",
      "DEPARTAMEN",
      "RUBRO",
      "TIPO",
      "CUOMAX",
      "P_IVA",
      "P_GANANCIA",
      "P_INGBRUTO",
      "P_LOTEHOGA",
      "P_RETENCIO",
      "CUIT",
      "INGBRUTOS",
      "USOCONTABL",
      "BAJA",
      "CONFIRMA",
      "SALDO_ACT",
    ];
    const blob = new Blob([cols.join(",") + "\n"], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "template_comercios.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main style={{ padding: 24, display: "grid", gap: 16, maxWidth: 1100 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h1 style={{ margin: 0 }}>Importar comercios (CSV)</h1>
        <Link href="/comercios" style={{ textDecoration: "none" }}>
          <button type="button">← Volver</button>
        </Link>
      </header>

      <section
        style={{
          border: "1px solid #eee",
          borderRadius: 12,
          padding: 16,
          display: "grid",
          gap: 12,
        }}
      >
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
        >
          {/* Archivo */}
          <div>
            <label
              style={{ display: "block", marginBottom: 6, fontWeight: 600 }}
            >
              Seleccionar CSV
            </label>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file && (
              <small style={{ marginLeft: 8, opacity: 0.8 }}>
                {file.name} ({Math.ceil(file.size / 1024)} KB)
              </small>
            )}
            <div style={{ marginTop: 8 }}>
              <button type="button" onClick={descargarTemplate}>
                Descargar template
              </button>
            </div>
            <small style={{ display: "block", marginTop: 8, opacity: 0.8 }}>
              Columnas aceptadas (se normalizan tildes/espacios):&nbsp;
              <code>
                CODIGO, RAZON_SOC, DOMICILIO, LOCALIDAD, INGRESO, TELEFONO1,
                TELEFONO2, EMAIL, GRUPO, DEPARTAMEN, RUBRO, TIPO, CUOMAX, P_IVA,
                P_GANANCIA, P_INGBRUTO, P_LOTEHOGA, P_RETENCIO, CUIT, INGBRUTOS,
                USOCONTABL, BAJA, CONFIRMA, SALDO_ACT
              </code>
            </small>
          </div>

          {/* Opciones */}
          <div>
            <label
              style={{ display: "block", marginBottom: 6, fontWeight: 600 }}
            >
              Opciones
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
              />
              Dry-run (no guarda cambios)
            </label>
            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <button onClick={subir} disabled={!file || loading}>
                {loading
                  ? dryRun
                    ? "Analizando…"
                    : "Importando…"
                  : dryRun
                  ? "Previsualizar"
                  : "Importar"}
              </button>
            </div>
          </div>
        </div>
      </section>

      {msg && (
        <p
          style={{
            padding: 8,
            border: "1px solid #eee",
            borderRadius: 8,
            whiteSpace: "pre-wrap",
          }}
        >
          {msg}
        </p>
      )}

      {res && (
        <section
          style={{
            border: "1px solid #eee",
            borderRadius: 12,
            padding: 16,
            display: "grid",
            gap: 16,
          }}
        >
          <h3 style={{ margin: 0 }}>
            {res.dryRun ? "Previsualización" : "Resultado del import"}
          </h3>

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <span>
              <b>Procesados:</b> {res.procesados}
            </span>
            <span>
              <b>Insertados:</b> {res.insertados}
            </span>
            <span>
              <b>Actualizados:</b> {res.actualizados}
            </span>
            <span>
              <b>Saltados:</b> {res.saltados}
            </span>
            <span>
              <b>Errores:</b> {res.errores?.length ?? 0}
            </span>
          </div>

          {!!res.errores?.length && (
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <h4 style={{ margin: 0 }}>Errores ({res.errores.length})</h4>
                <button onClick={downloadErroresCsv}>Descargar CSV</button>
              </div>
              <div
                style={{
                  maxHeight: 260,
                  overflow: "auto",
                  border: "1px solid #eee",
                  borderRadius: 6,
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th>Fila</th>
                      <th>Mensaje</th>
                    </tr>
                  </thead>
                  <tbody>
                    {res.errores.map((e, i) => (
                      <tr key={i} style={{ borderTop: "1px solid #eee" }}>
                        <td>{e.row}</td>
                        <td style={{ color: "crimson" }}>{e.msg}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
