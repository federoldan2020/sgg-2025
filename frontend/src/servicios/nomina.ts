import { apiFetch } from "./api";

export type PreviewCobranza = {
  ok: boolean;
  hash: string;
  periodo: string;
  resumen: {
    totalLineas: number;
    padronesEnTxt: number;
    padronesEncontrados: number;
    padronesFaltantes: number;
    afiliadosAfectados: number;
    cobranzasPorCodigo: Record<string, number>;
  };
  periodosDetectados: string[];
  padronesFaltantes: Array<{
    padron: string;
    centro: string;
    dni: number;
    apellidoNombre: string;
    cobranzas: Partial<Record<"J17" | "J22" | "J38" | "K16", number>>;
  }>;
  erroresParseo: Array<{ linea: number; raw: string; motivo: string }>;
};

export type ConfirmacionCobranza = {
  loteId: string;
  periodo: string;
  padronesActualizados: number;
  afiliadosTocados: number;
  rehabilitados: Array<{ afiliadoId: string; dni: string; apellidoNombre: string }>;
};

async function uploadFile<T>(path: string, file: File): Promise<T> {
  const fd = new FormData();
  fd.append("archivo", file);
  const res = await apiFetch(path, {
    method: "POST",
    body: fd,
  }, { includeJsonContentType: false });
  return (await res.json()) as T;
}

export function previewCobranza(file: File) {
  return uploadFile<PreviewCobranza>("/nomina/importar-cobranza/preview", file);
}

export function confirmarCobranza(file: File) {
  return uploadFile<ConfirmacionCobranza>("/nomina/importar-cobranza/confirmar", file);
}

// ─────────────────────────────────────────────────────────────────
//  ANSES (jubilados)
// ─────────────────────────────────────────────────────────────────

export type PreviewCobranzaAnses = {
  ok: boolean;
  hash: string;
  periodo: string;
  resumen: {
    totalLineas: number;
    beneficiosEnTxt: number;
    beneficiosEncontrados: number;
    beneficiosFaltantes: number;
    montoTotalJ17: number;
  };
  periodosDetectados: string[];
  beneficiosFaltantes: Array<{
    beneficio: string;
    apellidoNombre: string;
    dni: string;
    cuit: string;
    monto: number;
  }>;
  erroresParseo: Array<{ linea: number; raw: string; motivo: string }>;
  warnings: Array<{ linea: number; mensaje: string }>;
};

export type ConfirmacionCobranzaAnses = {
  loteId: string;
  periodo: string;
  beneficiosAplicados: number;
  afiliadosTocados: number;
  montoTotal: number;
  rehabilitados: Array<{ afiliadoId: string; dni: string; apellidoNombre: string }>;
};

export function previewCobranzaAnses(file: File) {
  return uploadFile<PreviewCobranzaAnses>("/nomina/importar-cobranza-anses/preview", file);
}

export function confirmarCobranzaAnses(file: File) {
  return uploadFile<ConfirmacionCobranzaAnses>("/nomina/importar-cobranza-anses/confirmar", file);
}
