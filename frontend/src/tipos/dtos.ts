// =============================================================
// DTOs de requests/responses (MVP Sprint 1) - FRONTEND
// =============================================================

// ---------- Afiliados ----------
export interface CrearAfiliadoDto {
  dni: number;
  apellido: string;
  nombre: string;

  cuit?: string;
  sexo?: "M" | "F" | "X";
  tipo?: "TITULAR" | "FAMILIAR" | "JUBILADO" | "OTRO";

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

  cupo?: string; // Decimal (string)
  saldo?: string; // Decimal (string)

  observaciones?: string;
}

export interface CrearAfiliadoResp {
  id: number | string;
}

// ---------- Coseguro / Colaterales ----------
export type Sistema = "ESC" | "SGR" | "SG";

export interface ColateralMinDto {
  parentescoId: number;
  nombre: string;
  fechaNacimiento?: string; // YYYY-MM-DD
  activo?: boolean;
}

// ---------- Padrones ----------
/** Campos comunes del padrón (base) */
interface CrearPadronBase {
  padron: string;

  centro?: number;
  sector?: number;
  clase?: string;
  situacion?: string;

  fechaAlta?: string; // YYYY-MM-DD
  fechaBaja?: string; // YYYY-MM-DD
  activo?: boolean;

  // Códigos / importes
  j17?: string;
  j22?: string;
  j38?: string;
  k16?: string;

  // Jubilados / bancarios
  motivoBaja?: string;
  cajaAhorro?: string;
  beneficiarioJubilado?: string;

  // Sistema / importes
  sistema?: Sistema;
  sueldoBasico?: string;
  cupo?: string;
  saldo?: string;

  /** Extras de flujo */
  crearCoseguro?: boolean;
  colaterales?: ColateralMinDto[];
}

/** Variante A: usando afiliado existente */
export interface CrearPadronConAfiliadoId extends CrearPadronBase {
  afiliadoId: number;
  afiliadoNuevo?: never;
}

/** Variante B: alta combinada (crear afiliado en el acto) */
export interface CrearPadronConAfiliadoNuevo extends CrearPadronBase {
  afiliadoNuevo: CrearAfiliadoDto;
  afiliadoId?: never;
}

/** DTO final como unión discriminada */
export type CrearPadronDto =
  | CrearPadronConAfiliadoId
  | CrearPadronConAfiliadoNuevo;

export interface CrearPadronResp {
  id: number | string;
}

// ---------- Obligaciones / Caja / Cobros ----------
export interface CrearObligacionDto {
  afiliadoId: number;
  padronId?: number;
  conceptoCodigo: string;
  periodo: string; // YYYY-MM
  monto: number;
  origen?: string;
}
export interface CrearObligacionResp {
  id: number | string;
}

export interface AbrirCajaDto {
  sede?: string;
}
export interface AbrirCajaResp {
  id: number | string;
}

export interface CobrarDto {
  cajaId: number;
  afiliadoId: number;
  metodos: { metodo: string; monto: number; ref?: string }[];
  aplicaciones: { obligacionId: number; monto: number }[];
}
export interface CobrarResp {
  id: number | string;
  total: number | string;
}

// ---------- Coseguro configuraciones / resumen ----------
export interface ConfigurarCoseguroDto {
  afiliadoId: number;
  imputacionPadronIdCoseguro?: number;
  imputacionPadronIdColaterales?: number;
  fechaAlta?: string; // YYYY-MM-DD
}

export interface AltaColateralesDto {
  afiliadoId: number;
  items: {
    parentescoCodigo: string;
    nombre: string;
    fechaNacimiento?: string; // YYYY-MM-DD
  }[];
}

export interface ResumenCoseguroResp {
  afiliadoId: string;
  fechaCorte: string;
  precioBase: string;
  colaterales: {
    parentescoCodigo: string;
    cantidad: number;
    precioTotal: string;
  }[];
  totalCoseguro: string;
  totalColaterales: string;
  total: string;
  imputaciones: { padronCoseguroId?: string; padronColateralesId?: string };
}

export interface GenerarObligacionesDto {
  afiliadoId: number;
  periodo: string; // YYYY-MM
}
