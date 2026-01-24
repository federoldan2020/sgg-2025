"use client";
import { useState, useRef } from "react";
import { getErrorMessage } from "@/servicios/api";
import styles from "../../../components/novedades/MonitorNovedades.module.css";

type ConciliacionResultado = {
  procesadas: number;
  errores: number;
  periodo: string;
  detalles: Array<{
    padron: string;
    centro?: number;
    codigos: string[];
  }>;
  erroresDetallados: Array<{
    padron?: string;
    motivo: string;
    linea?: string;
  }>;
};

type Progreso = {
  procesadas: number;
  errores: number;
  total: number;
  porcentaje: number;
  ultimoPadron?: string;
  detallesParciales: Array<{
    padron: string;
    centro?: number;
    codigos: string[];
  }>;
  erroresDetallados: Array<{
    padron?: string;
    motivo: string;
    linea?: string;
  }>;
};

export default function ConciliarNovedadesPage() {
  const [file, setFile] = useState<File | null>(null);
  const [periodo, setPeriodo] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ConciliacionResultado | null>(null);
  const [progreso, setProgreso] = useState<Progreso | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const periodoHoy = `${today.getFullYear()}-${pad(today.getMonth() + 1)}`;

  const procesar = async () => {
    if (!file) {
      setMsg("Seleccioná un archivo TXT");
      return;
    }

    setLoading(true);
    setMsg(null);
    setResultado(null);
    setProgreso(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      
      if (periodo.trim()) {
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo.trim())) {
          setMsg("Período inválido. Formato esperado: YYYY-MM (ej: 2025-12)");
          setLoading(false);
          return;
        }
      }

      const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000").replace(/\/+$/, "");
      const ORG = process.env.NEXT_PUBLIC_TENANT_ID || "3b883afc-f1ad-4d91-90c6-78654532ba9f";
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

      const queryParams = periodo.trim() ? `?periodo=${encodeURIComponent(periodo.trim())}` : "";
      const url = `${API_URL}/novedades/conciliar${queryParams}`;
      
      // Usar fetch para enviar el archivo y luego EventSource para recibir progreso
      // Nota: Para SSE, necesitamos una implementación diferente. 
      // Vamos a usar fetch con streaming o una aproximación híbrida.
      
      // Primero enviamos el archivo y recibimos la respuesta como stream
      const response = await fetch(url, {
        method: "POST",
        body: formData,
        headers: {
          "X-Organizacion-ID": ORG,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        cache: "no-store",
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Error ${response.status}`);
      }

      // Leer el stream de Server-Sent Events
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      if (!reader) {
        throw new Error("No se pudo obtener el stream de respuesta");
      }

      let buffer = "";
      const detallesParciales: Array<{ padron: string; centro?: number; codigos: string[] }> = [];
      const erroresAcumulados: Array<{ padron?: string; motivo: string; linea?: string }> = [];
      let currentEvent = "";

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        let currentData = "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.substring(7).trim();
          } else if (line.startsWith("data: ")) {
            currentData = line.substring(6).trim();
          } else if (line.trim() === "" && currentEvent && currentData) {
            // Línea vacía = fin de evento, procesar
            try {
              const data = JSON.parse(currentData);
              
              if (currentEvent === "progreso") {
                setProgreso(data);
                // Agregar detalles parciales nuevos (solo los del último lote)
                if (data.detallesParciales && data.detallesParciales.length > 0) {
                  detallesParciales.push(...data.detallesParciales);
                }
                // Agregar errores del lote
                if (data.erroresDetallados && data.erroresDetallados.length > 0) {
                  erroresAcumulados.push(...data.erroresDetallados);
                }
              } else if (currentEvent === "completado") {
                setResultado({
                  ...data,
                  detalles: data.detalles || detallesParciales,
                  erroresDetallados: data.erroresDetallados || erroresAcumulados,
                });
                setMsg(
                  `✅ Procesamiento completado. ` +
                  `Procesadas: ${data.procesadas}, ` +
                  `Errores: ${data.errores}. ` +
                  `Período: ${data.periodo}`
                );
                setProgreso(null);
                setFile(null);
                setLoading(false);
                return;
              } else if (currentEvent === "error") {
                throw new Error(data.mensaje || "Error desconocido");
              }
            } catch (e) {
              console.error("Error parseando SSE:", e, "Evento:", currentEvent, "Data:", currentData);
              if (currentEvent === "error") {
                throw e;
              }
            }
            // Reset para el próximo evento
            currentEvent = "";
            currentData = "";
          }
        }
      }
    } catch (e) {
      setMsg(getErrorMessage(e));
      setProgreso(null);
    } finally {
      setLoading(false);
    }
  };

  const money = (codigo: string) => {
    // Extraer monto de strings como "J17: 4842.43"
    const match = codigo.match(/: ([\d.,]+)$/);
    if (!match) return codigo;
    const num = parseFloat(match[1].replace(",", "."));
    return num.toLocaleString("es-AR", { minimumFractionDigits: 2 });
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Conciliación de Novedades</h1>
        <p style={{ marginTop: 8, color: "#666" }}>
          Procesa el archivo TXT devuelto por cómputos e impacta los montos efectivamente descontados en los padrones
        </p>
      </div>

      <div className={styles.content}>
        {/* Card de Carga */}
        <div className={styles.card}>
          <div className={styles.cardBody}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Período (opcional) */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>
                  Período (YYYY-MM) <span style={{ color: "#999", fontWeight: "normal" }}>(opcional)</span>
                </label>
                <input
                  className={styles.formControl}
                  type="text"
                  placeholder={`Ej: ${periodoHoy}`}
                  value={periodo}
                  onChange={(e) => setPeriodo(e.target.value)}
                />
                <small style={{ color: "#666", marginTop: 4, display: "block" }}>
                  Si no se indica, se extraerá automáticamente del archivo
                </small>
              </div>

              {/* Selección de archivo */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Archivo TXT de conciliación</label>
                <input
                  type="file"
                  accept=".txt,text/plain"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    setFile(f || null);
                    setMsg(null);
                    setResultado(null);
                  }}
                  style={{
                    width: "100%",
                    padding: "8px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                  }}
                />
                {file && (
                  <small style={{ color: "#666", marginTop: 4, display: "block" }}>
                    Archivo seleccionado: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(2)} KB)
                  </small>
                )}
              </div>

              {/* Botón de procesar */}
              <div>
                <button
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  onClick={procesar}
                  disabled={loading || !file}
                  style={{ width: "100%" }}
                >
                  {loading ? "⏳ Procesando..." : "📤 Procesar Conciliación"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Barra de progreso */}
        {loading && progreso && (
          <div className={styles.card}>
            <div className={styles.cardBody}>
              <h3 style={{ marginTop: 0, marginBottom: 16 }}>Procesando...</h3>
              
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span>Progreso: {progreso.procesadas + progreso.errores} / {progreso.total}</span>
                  <span style={{ fontWeight: "bold" }}>{progreso.porcentaje}%</span>
                </div>
                <div
                  style={{
                    width: "100%",
                    height: 24,
                    backgroundColor: "#e9ecef",
                    borderRadius: 12,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${progreso.porcentaje}%`,
                      height: "100%",
                      backgroundColor: progreso.errores > 0 ? "#ffc107" : "#28a745",
                      transition: "width 0.3s ease",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "white",
                      fontSize: 12,
                      fontWeight: "bold",
                    }}
                  >
                    {progreso.porcentaje}%
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 16 }}>
                <div style={{ padding: 8, backgroundColor: "#f8f9fa", borderRadius: 4 }}>
                  <div style={{ fontSize: 18, fontWeight: "bold", color: "#28a745" }}>
                    {progreso.procesadas}
                  </div>
                  <div style={{ color: "#666", fontSize: 12 }}>Procesadas</div>
                </div>
                <div style={{ padding: 8, backgroundColor: "#f8f9fa", borderRadius: 4 }}>
                  <div style={{ fontSize: 18, fontWeight: "bold", color: progreso.errores > 0 ? "#dc3545" : "#28a745" }}>
                    {progreso.errores}
                  </div>
                  <div style={{ color: "#666", fontSize: 12 }}>Errores</div>
                </div>
              </div>

              {progreso.ultimoPadron && (
                <div style={{ fontSize: 14, color: "#666", marginBottom: 12 }}>
                  Último padrón procesado: <strong>{progreso.ultimoPadron}</strong>
                </div>
              )}

              {/* Errores del lote actual */}
              {progreso.erroresDetallados && progreso.erroresDetallados.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <h4 style={{ fontSize: 14, marginBottom: 8, color: "#dc3545" }}>
                    Errores encontrados ({progreso.erroresDetallados.length}):
                  </h4>
                  <div style={{ maxHeight: 200, overflowY: "auto", fontSize: 12 }}>
                    {progreso.erroresDetallados.map((error, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: "8px",
                          marginBottom: 6,
                          backgroundColor: "#fff3cd",
                          borderRadius: 4,
                          borderLeft: "3px solid #ffc107",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <strong style={{ color: "#856404" }}>
                            {error.padron ? `Padrón: ${error.padron}` : "Sin padrón"}
                          </strong>
                        </div>
                        <div style={{ color: "#856404", fontSize: 11, marginBottom: 4 }}>
                          <strong>Motivo:</strong> {error.motivo}
                        </div>
                        {error.linea && (
                          <div style={{ color: "#666", fontSize: 10, fontFamily: "monospace", wordBreak: "break-all" }}>
                            Línea: {error.linea}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview de últimos padrones procesados */}
              {progreso.detallesParciales.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <h4 style={{ fontSize: 14, marginBottom: 8 }}>Últimos padrones procesados:</h4>
                  <div style={{ maxHeight: 200, overflowY: "auto", fontSize: 12 }}>
                    {progreso.detallesParciales.slice(-10).map((detalle, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: "6px 8px",
                          marginBottom: 4,
                          backgroundColor: "#f8f9fa",
                          borderRadius: 4,
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span>
                          <strong>{detalle.padron}</strong>
                          {detalle.centro && ` (Centro: ${detalle.centro})`}
                        </span>
                        <span style={{ color: "#666" }}>
                          {detalle.codigos.map((c) => c.split(":")[0]).join(", ")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Mensajes */}
        {msg && (
          <div
            className={styles.alert}
            style={{
              backgroundColor: msg.includes("✅") || msg.includes("exitos") ? "#d4edda" : "#f8d7da",
              color: msg.includes("✅") || msg.includes("exitos") ? "#155724" : "#721c24",
              borderColor: msg.includes("✅") || msg.includes("exitos") ? "#c3e6cb" : "#f5c6cb",
            }}
          >
            {msg}
          </div>
        )}

        {/* Resultados */}
        {resultado && (
          <div className={styles.card}>
            <div className={styles.cardBody}>
              <h2 style={{ marginTop: 0, marginBottom: 16 }}>Resultado del Procesamiento</h2>
              
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
                <div style={{ padding: 16, backgroundColor: "#f8f9fa", borderRadius: 8 }}>
                  <div style={{ fontSize: 24, fontWeight: "bold", color: "#28a745" }}>
                    {resultado.procesadas}
                  </div>
                  <div style={{ color: "#666", fontSize: 14 }}>Procesadas</div>
                </div>
                <div style={{ padding: 16, backgroundColor: "#f8f9fa", borderRadius: 8 }}>
                  <div style={{ fontSize: 24, fontWeight: "bold", color: resultado.errores > 0 ? "#dc3545" : "#28a745" }}>
                    {resultado.errores}
                  </div>
                  <div style={{ color: "#666", fontSize: 14 }}>Errores</div>
                </div>
                <div style={{ padding: 16, backgroundColor: "#f8f9fa", borderRadius: 8 }}>
                  <div style={{ fontSize: 24, fontWeight: "bold", color: "#007bff" }}>
                    {resultado.periodo}
                  </div>
                  <div style={{ color: "#666", fontSize: 14 }}>Período</div>
                </div>
              </div>

              {/* Errores detallados */}
              {resultado.erroresDetallados && resultado.erroresDetallados.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <h3 style={{ marginBottom: 12, color: "#dc3545" }}>
                    Errores ({resultado.erroresDetallados.length})
                  </h3>
                  <div className={styles.tableContainer}>
                    <table className={styles.table}>
                      <thead className={styles.tableHeader}>
                        <tr>
                          <th>Padrón</th>
                          <th>Motivo del Error</th>
                          <th>Línea (preview)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resultado.erroresDetallados.map((error, idx) => (
                          <tr key={idx} className={styles.tableRow}>
                            <td>
                              {error.padron ? (
                                <span className={styles.padronBadge}>{error.padron}</span>
                              ) : (
                                <span style={{ color: "#999" }}>—</span>
                              )}
                            </td>
                            <td style={{ color: "#dc3545" }}>{error.motivo}</td>
                            <td style={{ fontFamily: "monospace", fontSize: 11, wordBreak: "break-all", maxWidth: 300 }}>
                              {error.linea || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {resultado.detalles.length > 0 && (
                <div>
                  <h3 style={{ marginBottom: 12 }}>Detalles por Padrón</h3>
                  <div className={styles.tableContainer}>
                    <table className={styles.table}>
                      <thead className={styles.tableHeader}>
                        <tr>
                          <th>Padrón</th>
                          <th>Centro</th>
                          <th>Códigos Procesados</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resultado.detalles.map((detalle, idx) => (
                          <tr key={idx} className={styles.tableRow}>
                            <td>
                              <span className={styles.padronBadge}>{detalle.padron}</span>
                            </td>
                            <td>{detalle.centro ?? "—"}</td>
                            <td>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                {detalle.codigos.map((codigo, i) => (
                                  <span
                                    key={i}
                                    style={{
                                      padding: "4px 8px",
                                      backgroundColor: "#e7f3ff",
                                      borderRadius: 4,
                                      fontSize: 12,
                                      fontFamily: "monospace",
                                    }}
                                  >
                                    {codigo.split(":")[0]}: ${money(codigo)}
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
