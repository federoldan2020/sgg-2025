// Entidades mínimas usadas en el front (podés ampliar luego)
export type IdLike = number | string;

export type Sexo = 'M' | 'F' | 'X';
export type AfiliadoTipo = 'TITULAR' | 'FAMILIAR' | 'JUBILADO' | 'OTRO';

export interface CrearAfiliadoDto {
  // requeridos
  dni: number;
  apellido: string;
  nombre: string;

  // opcionales
  cuit?: string;
  sexo?: Sexo;
  tipo?: AfiliadoTipo;

  telefono?: string;
  celular?: string;

  calle?: string;
  numero?: string;
  orientacion?: string;
  barrio?: string;
  piso?: string;
  depto?: string;
  monoblock?: string;
  casa?: string;
  manzana?: string;
  localidad?: string;

  fechaNacimiento?: string; // YYYY-MM-DD
  numeroSocio?: string;

  cupo?: string;  // Decimal (string)
  saldo?: string; // Decimal (string)

  observaciones?: string;
}

export interface CrearAfiliadoResp {
  id: string | number; // el backend devuelve BigInt serializado a string
  // podés ampliar según select del service
}

export interface Padron {
  id: IdLike;
  afiliadoId: IdLike;
  padron: string;
  centro?: number | null;
  sector?: number | null;
  clase?: string | null;
  situacion?: string | null;
  fechaAlta?: string | null; // ISO (yyyy-mm-dd) si usás @db.Date
  fechaBaja?: string | null;
  activo: boolean;
}

export interface Concepto {
  id: IdLike;
  codigo: string;      // CUOTA_SOC | COSEGURO | ...
  nombre: string;
  activo: boolean;
}

export interface Obligacion {
  id: IdLike;
  afiliadoId: IdLike;
  padronId?: IdLike | null;
  conceptoId: IdLike;
  periodo: string;      // "YYYY-MM" o ""
  origen: string;       // 'liquidacion' | 'orden_credito' | ...
  monto: number | string;
  saldo: number | string;
  estado: 'pendiente' | 'parcialmente_pagada' | 'pagada' | 'anulada';
}

export interface Caja {
  id: IdLike;
  estado: 'abierta' | 'cerrada';
  sede?: string | null;
}

export interface MetodoPago {
  id: IdLike;
  pagoId: IdLike;
  metodo: string;
  monto: number | string;
  ref?: string | null;
}

export interface Pago {
  id: IdLike;
  cajaId: IdLike;
  afiliadoId: IdLike;
  fecha: string;
  total: number | string;
  numeroRecibo?: string | null;
}

export interface Parentesco {
  id: IdLike;
  codigo: number;
  descripcion: string;
  activo: boolean;
}

export interface ReglaPrecioCoseguro {
  id: IdLike;
  vigenteDesde: string;      // ISO
  vigenteHasta: string | null;
  precioBase: number | string; // Decimal -> string en JSON
  activo: boolean;
}

export interface ReglaPrecioColateral {
  id: IdLike;
  parentescoId: IdLike;
  cantidadDesde: number;
  cantidadHasta: number | null;
  vigenteDesde: string;
  vigenteHasta: string | null;
  precioTotal: number | string; // Decimal
  activo: boolean;
}

export interface ReglaColateralExpandida extends ReglaPrecioColateral {
  parentesco: Pick<Parentesco, 'codigo' | 'descripcion'>;
}

export interface OrdenCreditoCuota {
  id: IdLike;
  ordenId: IdLike;
  numero: number;
  periodoVenc: string;                  // "YYYY-MM"
  importe: number | string;
  cancelado: number | string;
  saldo: number | string;
  estado: 'pendiente' | 'generada' | 'parcialmente_pagada' | 'pagada' | 'anulada';
  obligacionId?: IdLike | null;
  fechaGeneracionObligacion?: string | null; // ISO string si viene
  fechaCancelacion?: string | null;
}

export interface OrdenCredito {
  id: IdLike;
  organizacionId: string;
  afiliadoId: IdLike;
  padronId?: IdLike | null;
  descripcion: string;
  fechaAlta: string;
  enCuotas: boolean;
  cantidadCuotas?: number | null;
  cuotaActual?: number | null;
  importeTotal: number | string;
  saldoTotal: number | string;
  periodoPrimera?: string | null;
  tasaInteres?: number | string | null;
  sistemaAmortizacion?: string | null;
  preMaterializarMeses?: number | null;
  estado: 'pendiente' | 'en_curso' | 'cancelada' | 'anulada';
  referenciaExterna?: string | null;
  obligacionId?: IdLike | null;
  cuotas?: OrdenCreditoCuota[];
}
// === Sprint 3: Nómina / Conciliación ===
export interface ConciliarNominaDto {
  loteId: number;
  periodo: string; // "YYYY-MM"
  items: {
    afiliadoId: number;
    padronId?: number;
    canal: string; // "J22" | "K16" | ...
    importeCobrado: number;
  }[];
}

export interface ConciliarNominaResp {
  loteId: string;
  resultados: {
    pagoId: string;
    afiliadoId: number;
    total: string;
    excedente: string;
  }[];
}

// Tipos para conciliación de nómina (preview y confirmación)

export type NominaCampoEstandar =
  | 'afiliadoId'
  | 'padron'
  | 'concepto'
  | 'periodo'
  | 'importe';

export interface NominaPreviewRowIn {
  // fila cruda mapeada por el usuario (strings desde CSV/TXT)
  afiliadoId?: string;
  padron?: string;
  concepto?: string;
  periodo?: string; // YYYY-MM (o lo que venga; validamos del lado back)
  importe?: string; // parseable a número
  // meta
  _linea: number; // para rastrear
}

export interface NominaPreviewRow {
  // fila normalizada para preview
  afiliadoId?: number;
  padron?: string;
  concepto?: string;
  periodo?: string;
  importe?: number;
  linea: number;
  errores: string[];
}

export interface NominaPreviewRequest {
  filas: NominaPreviewRowIn[];
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
  // lo que el usuario confirma tras el preview
  filas: NominaPreviewRow[]; // solo las válidas o todas; el back filtrará
  referenciaLote?: string; // opcional, nombre de archivo, etc.
  periodoLote?: string; // opcional, YYYY-MM
}

export interface NominaConfirmResponse {
  aceptadas: number;
  rechazadas: number;
  importeAceptado: number;
  mensaje: string;
}


//TIPOS AFILIADOS