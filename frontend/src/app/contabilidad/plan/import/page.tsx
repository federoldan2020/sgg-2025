"use client";

import { useState } from "react";
import { apiFetch, getErrorMessage } from "@/servicios/api";

type Resumen = { total: number; padres: number; hijos: number };

export default function ImportarPlanPage() {
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [loading, setLoading] = useState(false);

  const onSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMsg(null);
    setResumen(null);
    setFile(e.target.files?.[0] ?? null);
  };

  const descargarTemplate = () => {
    const contenido = [
      "cuenta\tsubcta\tnombre\ttipcta\ttipo\tUDAP",
      "10000\t000\tACTIVO CORRIENTE\tGRUPAL\t\t",
      "10101\t000\tCajas UDAP\tCOMPUESTA\t\t",
      "10101\t001\tCaja Udap Gremio\tSIMPLE\t\t",
    ].join("\n");

    const blob = new Blob([contenido], {
      type: "text/tab-separated-values;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plan_cuentas_template.tsv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const subir = async () => {
    try {
      setLoading(true);
      setMsg(null);
      setResumen(null);

      if (!file) {
        setMsg("Selecciona un archivo CSV/TSV.");
        return;
      }

      const fd = new FormData();
      fd.append("file", file);

      const resp = await apiFetch(
        "/contabilidad/plan/import",
        {
          method: "POST",
          body: fd,
          cache: "no-store",
        },
        { includeJsonContentType: false },
      );

      const ct = resp.headers.get("content-type") || "";
      const payload = ct.includes("application/json")
        ? await resp.json()
        : await resp.text();

      const data = payload as Resumen & { ok?: boolean };
      setResumen({ total: data.total, padres: data.padres, hijos: data.hijos });
      setMsg("Importacion exitosa.");
    } catch (e) {
      setMsg(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ padding: 24, maxWidth: 720 }}>
      <h1>Importar plan de cuentas (CSV / TSV)</h1>
      <p style={{ marginTop: 8 }}>
        Encabezados requeridos: <code>cuenta</code>, <code>subcta</code>,{" "}
        <code>nombre</code>, <code>tipcta</code>, <code>tipo</code>,{" "}
        <code>UDAP</code>.
      </p>

      <p>
        <button onClick={descargarTemplate} style={{ marginTop: 8 }}>
          Descargar template (TSV)
        </button>
      </p>

      <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
        <input
          type="file"
          accept=".csv,.tsv,text/csv,text/tab-separated-values"
          onChange={onSelect}
        />
        <button disabled={!file || loading} onClick={subir}>
          {loading ? "Importando..." : "Importar"}
        </button>
      </div>

      {msg && (
        <p
          style={{
            marginTop: 16,
            color: msg.toLowerCase().includes("exitosa") || msg.toLowerCase().includes("importacion exitosa")
              ? "green"
              : "crimson",
          }}
        >
          {msg}
        </p>
      )}

      {resumen && (
        <div style={{ marginTop: 12 }}>
          <strong>Resumen:</strong>
          <ul>
            <li>Total filas: {resumen.total}</li>
            <li>Padres creados/actualizados: {resumen.padres}</li>
            <li>Hijos creados/actualizados: {resumen.hijos}</li>
          </ul>
        </div>
      )}

      <hr style={{ margin: "24px 0" }} />
      <details>
        <summary>Notas</summary>
        <ul>
          <li>
            Detectamos automaticamente coma, punto y coma o tabulacion como separador.
          </li>
          <li>
            <b>Jerarquia</b>: si <code>subcta = 000</code> es nodo padre; si no,
            se cuelga de <code>{`{cuenta}.000`}</code>.
          </li>
          <li>
            <b>Imputable</b>: es <code>true</code> cuando <code>tipcta = SIMPLE</code>;
            los padres <code>000</code> nunca son imputables.
          </li>
          <li>
            Si llega un hijo sin su padre, el backend crea el padre "placeholder"
            con el codigo como nombre.
          </li>
        </ul>
      </details>
    </main>
  );
}
