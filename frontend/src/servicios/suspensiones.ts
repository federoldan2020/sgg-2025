import { api } from "./api";

export type ParametroVigencia = {
  id: string;
  organizacionId: string;
  valor: number;
  vigenteDesde: string;
  vigenteHasta: string | null;
  creadoPorId: string | null;
  creadoEn: string;
};

export type Cobertura = {
  id?: string;
  organizacionId?: string;
  afiliadoId: string;
  periodo: string;
  j17Esperado: number;
  j17Cobrado: number;
  j22Esperado: number;
  j22Cobrado: number;
  j38Esperado: number;
  j38Cobrado: number;
  k16Esperado: number;
  k16Cobrado: number;
  cubierto: boolean;
  /** Flags por concepto (modelo de gates separados). */
  j17Cubierto?: boolean;
  j22Cubierto?: boolean;
  j38Cubierto?: boolean;
  deudaTotal: number;
  calculadoEn?: string;
};

export type Suspension = {
  id: string;
  afiliadoId: string;
  periodoOrigen: string;
  estado: "provisoria" | "firme" | "revertida" | "rehabilitada";
  fechaInicio: string;
  fechaFirme: string | null;
  fechaFin: string | null;
  motivoFin: string | null;
  observacion: string | null;
};

export type Excepcion = {
  id: string;
  afiliadoId: string;
  motivo: string;
  vigenciaHasta: string | null;
  activa: boolean;
  creadoEn: string;
  desactivadoEn: string | null;
};

export type CierreMensual = {
  id: string;
  organizacionId: string;
  periodo: string;
  estado: "en_curso" | "completado" | "fallido" | "dry_run";
  iniciadoEn: string;
  finalizadoEn: string | null;
  totalSuspendidos: number;
  totalRehabilitados: number;
  totalPadronesMarcados: number;
  totalExcluidos: number;
  resumen?: unknown;
  errorMensaje?: string | null;
};

// -------- Parámetros --------

export function listarJ17Minimo() {
  return api<ParametroVigencia[]>("/parametros/j17-minimo");
}
export function vigenteJ17Minimo() {
  return api<ParametroVigencia | null>("/parametros/j17-minimo/vigente");
}
export function crearJ17Minimo(valor: number, vigenteDesde: string) {
  return api<ParametroVigencia>("/parametros/j17-minimo", {
    method: "POST",
    body: JSON.stringify({ valor, vigenteDesde }),
  });
}
export function eliminarUltimaJ17Minimo() {
  return api<{ ok: boolean }>("/parametros/j17-minimo/ultima", { method: "DELETE" });
}

export function listarCuota04() {
  return api<ParametroVigencia[]>("/parametros/j17-cuota-04");
}
export function vigenteCuota04() {
  return api<ParametroVigencia | null>("/parametros/j17-cuota-04/vigente");
}
export function crearCuota04(valor: number, vigenteDesde: string) {
  return api<ParametroVigencia>("/parametros/j17-cuota-04", {
    method: "POST",
    body: JSON.stringify({ valor, vigenteDesde }),
  });
}
export function eliminarUltimaCuota04() {
  return api<{ ok: boolean }>("/parametros/j17-cuota-04/ultima", { method: "DELETE" });
}

// -------- Cobertura --------

export function historialCobertura(afiliadoId: string | number, limit = 6) {
  return api<Cobertura[]>(`/afiliados/${afiliadoId}/cobertura/historial?limit=${limit}`);
}
export function recalcularCobertura(afiliadoId: string | number, periodo: string) {
  return api<Cobertura>(`/afiliados/${afiliadoId}/cobertura/recalcular`, {
    method: "POST",
    body: JSON.stringify({ periodo }),
  });
}

// -------- Suspensiones --------

export function historialSuspensiones(afiliadoId: string | number) {
  return api<Suspension[]>(`/afiliados/${afiliadoId}/suspension`);
}
export function suspenderAfiliado(
  afiliadoId: string | number,
  periodoOrigen: string,
  observacion?: string,
) {
  return api(`/afiliados/${afiliadoId}/suspension/suspender`, {
    method: "POST",
    body: JSON.stringify({ periodoOrigen, observacion }),
  });
}
export function rehabilitarAfiliado(afiliadoId: string | number, motivo?: string) {
  return api(`/afiliados/${afiliadoId}/suspension/rehabilitar`, {
    method: "POST",
    body: JSON.stringify({ motivo }),
  });
}
export function revertirSuspension(afiliadoId: string | number, motivo: string) {
  return api(`/afiliados/${afiliadoId}/suspension/revertir`, {
    method: "POST",
    body: JSON.stringify({ motivo }),
  });
}

// -------- Excepciones --------

export function listarExcepciones(afiliadoId: string | number) {
  return api<Excepcion[]>(`/afiliados/${afiliadoId}/excepciones-suspension`);
}
export function crearExcepcion(
  afiliadoId: string | number,
  motivo: string,
  vigenciaHasta?: string,
) {
  return api<Excepcion>(`/afiliados/${afiliadoId}/excepciones-suspension`, {
    method: "POST",
    body: JSON.stringify({ motivo, vigenciaHasta }),
  });
}
export function desactivarExcepcion(afiliadoId: string | number, id: string | number) {
  return api(`/afiliados/${afiliadoId}/excepciones-suspension/${id}`, { method: "DELETE" });
}
export function listarExcepcionesActivas() {
  return api<(Excepcion & { afiliado: { id: string; dni: string; apellido: string; nombre: string } })[]>(
    "/excepciones-suspension/activas",
  );
}

// -------- Cierre mensual --------

export function listarCierres(limit = 12) {
  return api<CierreMensual[]>(`/cierre-mensual?limit=${limit}`);
}
export function detalleCierre(id: string | number) {
  return api<CierreMensual>(`/cierre-mensual/${id}`);
}
export function periodoSugeridoCierre() {
  return api<{ periodo: string }>("/cierre-mensual/periodo-sugerido");
}
export function ejecutarCierre(periodo: string, dryRun: boolean) {
  return api<CierreMensual & { resumen: any }>("/cierre-mensual/ejecutar", {
    method: "POST",
    body: JSON.stringify({ periodo, dryRun }),
  });
}
export function convertirFirmes() {
  return api<{ convertidas: number }>("/cierre-mensual/convertir-firmes", { method: "POST" });
}

// -------- Materialización mensual (ex-ante) --------

export type ResumenMaterializacion = {
  organizacionId: string;
  periodo: string;
  dryRun: boolean;
  vencimiento: string;
  j22: {
    afiliadosConsiderados: number;
    creadas: number;
    yaExistentes: number;
    sinReglaVigente: number;
    montoTotal: number;
  };
  j38: {
    afiliadosConsiderados: number;
    creadas: number;
    yaExistentes: number;
    sinReglaVigente: number;
    montoTotal: number;
  };
  j17_04: {
    padronesConsiderados: number;
    creadas: number;
    yaExistentes: number;
    sinParametro: number;
    montoTotal: number;
  };
};

export function materializarMes(periodo: string, dryRun: boolean) {
  return api<ResumenMaterializacion>("/obligaciones-mensuales/materializar", {
    method: "POST",
    body: JSON.stringify({ periodo, dryRun }),
  });
}

// -------- Reglas de precio coseguro (valor J22 vigente) --------

export type ReglaJ22 = {
  id: string;
  organizacionId: string;
  vigenteDesde: string;
  vigenteHasta: string | null;
  precioBase: string | number;
  activo: boolean;
};

export function listarReglasJ22() {
  return api<ReglaJ22[]>("/coseguro/reglas");
}

export function crearReglaJ22(precioBase: number, vigenteDesde: string, vigenteHasta?: string) {
  return api<ReglaJ22>("/coseguro/reglas", {
    method: "POST",
    body: JSON.stringify({
      precioBase,
      vigenteDesde,
      vigenteHasta: vigenteHasta || null,
      activo: true,
    }),
  });
}

export function toggleReglaJ22(id: string, activo: boolean) {
  return api<ReglaJ22>(`/coseguro/reglas/${id}/estado`, {
    method: "PATCH",
    body: JSON.stringify({ activo }),
  });
}

export function eliminarReglaJ22(id: string) {
  return api(`/coseguro/reglas/${id}`, { method: "DELETE" });
}

// -------- Marcado inicial de coseguros desde movimientos históricos --------

export type ResultadoMarcadoCoseguros = {
  dryRun: boolean;
  afiliadosConJ22: number;
  yaActivos: number;
  reactivados: number;
  nuevosActivos: number;
};

export function marcarCosegurosIniciales(dryRun: boolean) {
  return api<ResultadoMarcadoCoseguros>(
    "/coseguro/marcar-iniciales-desde-movimientos",
    {
      method: "POST",
      body: JSON.stringify({ dryRun }),
    },
  );
}

// -------- Obligaciones pendientes del afiliado --------

export type ObligacionPendiente = {
  id: string;
  obligacionId?: string;
  cuotaId?: string;
  ordenId?: string;
  tipo: "obligacion" | "cuota";
  padronLabel: string;
  concepto: string;
  saldo: number;
  periodo: string;
  monto: number;
};

export function obligacionesPendientes(
  afiliadoId: string | number,
  padronId?: string,
) {
  const qs = new URLSearchParams({ afiliadoId: String(afiliadoId) });
  if (padronId) qs.set("padronId", padronId);
  return api<ObligacionPendiente[]>(`/obligaciones/pendientes?${qs.toString()}`);
}
