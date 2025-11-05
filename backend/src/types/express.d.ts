import 'express-serve-static-core';

declare module 'express-serve-static-core' {
  interface Request {
    /** Id de la organización (tenant) resuelto desde el header */
    organizacionId?: string;
  }
}

export interface NominaPreviewRowIn {
  afiliadoId?: string;
  padron?: string;
  concepto?: string;
  periodo?: string; // YYYY-MM
  importe?: string;
  _linea: number;
}
export interface NominaPreviewRequest {
  filas: NominaPreviewRowIn[];
}

export interface NominaPreviewRow {
  afiliadoId?: number;
  padron?: string;
  concepto?: string;
  periodo?: string;
  importe?: number;
  linea: number;
  errores: string[];
}
export interface NominaPreviewResponse {
  filas: NominaPreviewRow[];
  totales: {
    ok: number;
    conErrores: number;
    importeOk: number;
  };
}

export interface NominaConfirmRequest {
  filas: NominaPreviewRow[];
  referenciaLote?: string;
  periodoLote?: string;
}
export interface NominaConfirmResponse {
  aceptadas: number;
  rechazadas: number;
  importeAceptado: number;
  mensaje: string;
}
