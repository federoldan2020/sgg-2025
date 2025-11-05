"use client";
import { useState } from "react";

// Si ya tenés estos valores centralizados, podés importarlos.
// Los leo directo de env para no depender de otros helpers
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
const ORG = process.env.NEXT_PUBLIC_TENANT_ID ?? "";

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
    // Encabezados: cuenta	subcta	nombre	tipcta	tipo	UDAP
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
        setMsg("Seleccioná un archivo CSV/TSV.");
        return;
      }
      if (!API_URL) {
        setMsg("Falta configurar NEXT_PUBLIC_API_URL.");
        return;
      }
      if (!ORG) {
        setMsg("Falta configurar NEXT_PUBLIC_TENANT_ID.");
        return;
      }

      const fd = new FormData();
      fd.append("file", file);

      const resp = await fetch(`${API_URL}/contabilidad/plan/import`, {
        method: "POST",
        body: fd, // NO setear Content-Type manualmente
        headers: {
          "X-Organizacion-ID": ORG, // 👈 necesario para que el backend no tire “Falta organización”
        },
        cache: "no-store",
        // credentials: "include", // descomentá si usás cookies/sesión
      });

      const ct = resp.headers.get("content-type") || "";
      const payload = ct.includes("application/json")
        ? await resp.json()
        : await resp.text();

      if (!resp.ok) {
        const texto =
          typeof payload === "string" ? payload : JSON.stringify(payload);
        throw new Error(texto || `Falló la importación (${resp.status})`);
      }

      const data = payload as Resumen & { ok?: boolean };
      setResumen({ total: data.total, padres: data.padres, hijos: data.hijos });
      setMsg("Importación exitosa.");
    } catch (e) {
      const err = e as Error;
      setMsg(err?.message ?? "Error al importar");
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
          {loading ? "Importando…" : "Importar"}
        </button>
      </div>

      {msg && (
        <p
          style={{
            marginTop: 16,
            color: msg.includes("exitosa") ? "green" : "crimson",
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
            Detectamos automáticamente coma, punto y coma o tabulación como
            separador.
          </li>
          <li>
            <b>Jerarquía</b>: si <code>subcta = 000</code> es nodo padre; si no,
            se cuelga de <code>{`{cuenta}.000`}</code>.
          </li>
          <li>
            <b>Imputable</b>: es <code>true</code> cuando{" "}
            <code>tipcta = SIMPLE</code>; los padres <code>000</code> nunca son
            imputables.
          </li>
          <li>
            Si llega un hijo sin su padre, el backend crea el padre
            “placeholder” con el código como nombre.
          </li>
        </ul>
      </details>
    </main>
  );
}
