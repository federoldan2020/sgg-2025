"use client";
import { useState } from "react";
import { getErrorMessage, ORG } from "@/servicios/api";
import Link from "next/link";

type TipoImport = "prestadores" | "proveedores" | "terceros";

type PreviewRowOk = {
  idx: number;
  ok: true;
  nombre: string;
  cuit: string | null;
  roles: string[];
};
type PreviewRowErr = { idx: number; ok: false; error: string };
type PreviewResp = {
  total: number;
  preview: Array<PreviewRowOk | PreviewRowErr>;
};

type ImportResultado = {
  total: number;
  ok: number;
  fail: number;
  skip: number;
  resumen?: { creados: number; actualizados: number; errores: number };
  errores: {
    idx: number;
    error: string;
    nombre?: string;
    cuit?: string | null;
  }[];
  creados?: {
    idx: number;
    id: string | number | bigint;
    nombre: string;
    cuit: string | null;
  }[];
  actualizados?: {
    idx: number;
    id: string | number | bigint;
    nombre: string;
    cuit: string | null;
  }[];
};

export default function TercerosImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [tipo, setTipo] = useState<TipoImport>("terceros");
  const [preview, setPreview] = useState<PreviewResp | null>(null);
  const [resultado, setResultado] = useState<ImportResultado | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loadingPrev, setLoadingPrev] = useState(false);
  const [loadingRun, setLoadingRun] = useState(false);

  const API = process.env.NEXT_PUBLIC_API_URL;

  const doPreview = async () => {
    try {
      setLoadingPrev(true);
      setMsg(null);
      setResultado(null);
      setPreview(null);
      if (!file) throw new Error("Seleccioná un archivo CSV");

      const fd = new FormData();
      fd.append("file", file);

      const url = `${API}/terceros/import/preview?tipo=${encodeURIComponent(
        tipo
      )}`;
      const res = await fetch(url, { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      const r = (await res.json()) as PreviewResp;
      setPreview(r);
    } catch (e) {
      setMsg(getErrorMessage(e));
    } finally {
      setLoadingPrev(false);
    }
  };

  const doImport = async () => {
    try {
      setLoadingRun(true);
      setMsg(null);
      setResultado(null);
      if (!file) throw new Error("Seleccioná un archivo CSV");

      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch(
        `${API}/terceros/import?tipo=${encodeURIComponent(tipo)}`,
        {
          method: "POST",
          body: fd, // NO setear Content-Type manualmente
          headers: {
            "X-Organizacion-ID": ORG, // header org
          },
          cache: "no-store",
        }
      );
      if (!res.ok) throw new Error(await res.text());
      const r = (await res.json()) as ImportResultado;

      setResultado(r);

      const creados = r.resumen?.creados ?? r.creados?.length ?? 0;
      const actualizados =
        r.resumen?.actualizados ?? r.actualizados?.length ?? 0;
      const errores = r.fail ?? r.resumen?.errores ?? r.errores?.length ?? 0;

      setMsg(
        `Import terminado. OK ${r.ok}/${r.total}. ` +
          `Creados: ${creados}. Actualizados: ${actualizados}. Errores: ${errores}.`
      );
    } catch (e) {
      setMsg(getErrorMessage(e));
    } finally {
      setLoadingRun(false);
    }
  };

  // Helpers descarga CSV
  const toCsv = (rows: string[][]) =>
    rows
      .map((r) =>
        r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")
      )
      .join("\r\n");

  const downloadCsv = (
    filename: string,
    header: string[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rows: Array<Record<string, any>>
  ) => {
    const body = rows.map((r) => header.map((h) => r[h]));
    const csv = toCsv([header, ...body]);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main style={{ padding: 24, display: "grid", gap: 16, maxWidth: 1100 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h1 style={{ margin: 0 }}>Importar terceros (CSV)</h1>
        <Link href="/terceros" style={{ textDecoration: "none" }}>
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
        {/* Selector de tipo */}
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <label>¿Qué estás importando?</label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoImport)}
          >
            <option value="prestadores">Prestadores</option>
            <option value="proveedores">Proveedores</option>
            <option value="terceros">Terceros</option>
          </select>
        </div>

        {/* Archivo */}
        <div>
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
        </div>

        {/* Acciones */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={doPreview} disabled={!file || loadingPrev}>
            {loadingPrev ? "Analizando…" : "Preview"}
          </button>
          <button onClick={doImport} disabled={!file || loadingRun}>
            {loadingRun ? "Importando…" : "Importar"}
          </button>
        </div>

        <small style={{ opacity: 0.8 }}>
          Columnas flexibles: <code>codigo</code>, <code>nombre/razon</code>,{" "}
          <code>fantasia</code>, <code>cuit</code>, <code>iibb/ingbrutos</code>,{" "}
          <code>cond_iva/INSCRI</code>, <code>tipo_persona/TIPO</code>,{" "}
          <code>email</code>, <code>telefono</code>, <code>web</code>,{" "}
          <code>direccion/DOMICILIO</code>, <code>numero</code>,{" "}
          <code>ciudad/LOCALIDAD</code>, <code>provincia</code>,{" "}
          <code>cp/CODIGOPOST</code>, <code>pais</code>, <code>banco</code>,{" "}
          <code>cbu</code>, <code>alias</code>, <code>cvu</code>,{" "}
          <code>cci</code>, <code>titular</code>, <code>cuit_titular</code>,{" "}
          <code>proveedor</code>, <code>prestador</code>, <code>afiliado</code>,{" "}
          <code>rol</code>. Para <b>proveedores/prestadores</b> también{" "}
          <code>SALDO_ANT</code>, <code>SALDO_ACT</code>,{" "}
          <code>P_RETENCIO</code>.
        </small>

        {tipo === "terceros" && (
          <small style={{ opacity: 0.8 }}>
            Para <b>terceros</b>, si no hay CUIT/DNI se tomará{" "}
            <code>CODIGO</code> como identificador (solo para identificar, no
            para saldos).
          </small>
        )}
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

      {preview && (
        <section
          style={{ border: "1px solid #eee", borderRadius: 12, padding: 16 }}
        >
          <h3 style={{ marginTop: 0 }}>
            Preview (primeras 5 filas) — total {preview.total}
          </h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th>Linea</th>
                <th>Estado</th>
                <th>Nombre</th>
                <th>CUIT</th>
                <th>Roles</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {preview.preview.map((r, i) => (
                <tr key={i} style={{ borderTop: "1px solid #eee" }}>
                  <td>{r.idx}</td>
                  {"ok" in r && r.ok ? (
                    <>
                      <td style={{ color: "#127d2b" }}>OK</td>
                      <td>{(r as PreviewRowOk).nombre}</td>
                      <td>{(r as PreviewRowOk).cuit ?? "—"}</td>
                      <td>{(r as PreviewRowOk).roles?.join(", ") || "—"}</td>
                      <td>—</td>
                    </>
                  ) : (
                    <>
                      <td style={{ color: "crimson" }}>ERROR</td>
                      <td>—</td>
                      <td>—</td>
                      <td>—</td>
                      <td>{(r as PreviewRowErr).error}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {resultado && (
        <section
          style={{
            border: "1px solid #eee",
            borderRadius: 12,
            padding: 16,
            display: "grid",
            gap: 16,
          }}
        >
          <h3 style={{ margin: 0 }}>Resultado del import</h3>

          {/* Resumen */}
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <span>
              <b>Total:</b> {resultado.total}
            </span>
            <span>
              <b>OK:</b> {resultado.ok}
            </span>
            <span>
              <b>Errores:</b> {resultado.fail}
            </span>
            <span>
              <b>Creados:</b>{" "}
              {resultado.resumen?.creados ?? resultado.creados?.length ?? 0}
            </span>
            <span>
              <b>Actualizados:</b>{" "}
              {resultado.resumen?.actualizados ??
                resultado.actualizados?.length ??
                0}
            </span>
          </div>

          {/* Creados */}
          {(resultado.creados?.length ?? 0) > 0 && (
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <h4 style={{ margin: 0 }}>
                  Creados ({resultado.creados!.length})
                </h4>
                <button
                  onClick={() =>
                    downloadCsv(
                      `creados-${tipo}.csv`,
                      ["idx", "id", "nombre", "cuit"],
                      resultado.creados!.map((r) => ({
                        idx: r.idx,
                        id: String(r.id),
                        nombre: r.nombre,
                        cuit: r.cuit ?? "",
                      }))
                    )
                  }
                >
                  Descargar CSV
                </button>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th>Línea</th>
                    <th>ID</th>
                    <th>Nombre</th>
                    <th>CUIT</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.creados!.map((r, i) => (
                    <tr key={i} style={{ borderTop: "1px solid #eee" }}>
                      <td>{r.idx}</td>
                      <td>{String(r.id)}</td>
                      <td>{r.nombre}</td>
                      <td>{r.cuit ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Actualizados */}
          {(resultado.actualizados?.length ?? 0) > 0 && (
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <h4 style={{ margin: 0 }}>
                  Actualizados ({resultado.actualizados!.length})
                </h4>
                <button
                  onClick={() =>
                    downloadCsv(
                      `actualizados-${tipo}.csv`,
                      ["idx", "id", "nombre", "cuit"],
                      resultado.actualizados!.map((r) => ({
                        idx: r.idx,
                        id: String(r.id),
                        nombre: r.nombre,
                        cuit: r.cuit ?? "",
                      }))
                    )
                  }
                >
                  Descargar CSV
                </button>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th>Línea</th>
                    <th>ID</th>
                    <th>Nombre</th>
                    <th>CUIT</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.actualizados!.map((r, i) => (
                    <tr key={i} style={{ borderTop: "1px solid #eee" }}>
                      <td>{r.idx}</td>
                      <td>{String(r.id)}</td>
                      <td>{r.nombre}</td>
                      <td>{r.cuit ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Errores */}
          {(resultado.errores?.length ?? 0) > 0 && (
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <h4 style={{ margin: 0 }}>
                  Errores ({resultado.errores.length})
                </h4>
                <button
                  onClick={() =>
                    downloadCsv(
                      `errores-${tipo}.csv`,
                      ["idx", "nombre", "cuit", "error"],
                      resultado.errores.map((r) => ({
                        idx: r.idx,
                        nombre: r.nombre ?? "",
                        cuit: r.cuit ?? "",
                        error: r.error ?? "",
                      }))
                    )
                  }
                >
                  Descargar CSV
                </button>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th>Línea</th>
                    <th>Nombre</th>
                    <th>CUIT</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.errores.map((r, i) => (
                    <tr key={i} style={{ borderTop: "1px solid #eee" }}>
                      <td>{r.idx}</td>
                      <td>{r.nombre ?? "—"}</td>
                      <td>{r.cuit ?? "—"}</td>
                      <td style={{ color: "crimson" }}>{r.error}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
