import { api } from "./api";

// =============================================================================
// Farmacias (CRUD admin del gremio)
// =============================================================================

export type Farmacia = {
  id: string;
  codigo: string;
  nombre: string;
  cuit: string | null;
  direccion: string | null;
  localidad: string | null;
  telefono: string | null;
  email: string | null;
  esInterna: boolean;
  usuario: string | null;
  activo: boolean;
  creadoEn: string;
};

export function listarFarmacias() {
  return api<Farmacia[]>("/farmacias");
}

export function obtenerFarmacia(id: string) {
  return api<Farmacia>(`/farmacias/${id}`);
}

export function crearFarmacia(body: {
  codigo: string;
  nombre: string;
  cuit?: string;
  direccion?: string;
  localidad?: string;
  telefono?: string;
  email?: string;
  esInterna?: boolean;
  usuario?: string;
  password?: string;
  activo?: boolean;
}) {
  return api<{
    id: string;
    codigo: string;
    usuario: string | null;
    esInterna: boolean;
    /** Solo viene en el alta de farmacias externas. */
    passwordTemporal: string | null;
  }>("/farmacias", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function actualizarFarmacia(
  id: string,
  body: Partial<{
    nombre: string;
    cuit: string;
    direccion: string;
    localidad: string;
    telefono: string;
    email: string;
    usuario: string;
    activo: boolean;
  }>,
) {
  return api<{ id: string; ok: true }>(`/farmacias/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function cambiarPasswordFarmacia(id: string, password: string) {
  return api<{ ok: true }>(`/farmacias/${id}/password`, {
    method: "PATCH",
    body: JSON.stringify({ password }),
  });
}

export function resetPasswordFarmacia(id: string) {
  return api<{ ok: true; passwordTemporal: string }>(
    `/farmacias/${id}/reset-password`,
    { method: "POST" },
  );
}

export function eliminarFarmacia(id: string) {
  return api<{ ok: true }>(`/farmacias/${id}`, { method: "DELETE" });
}

// =============================================================================
// Órdenes de farmacia (admin desde el gremio)
// =============================================================================

export type SaldoOrdenes = {
  periodo: string;
  cupo: number;
  consumidas: number;
  disponibles: number;
};

export type ConsumoOrden = {
  id: string;
  numeroOrdenEnMes: number;
  consumidaEn: string;
  monto: number | null;
  observacion: string | null;
  anuladaEn: string | null;
  anuladaPor: string | null;
  anuladaMotivo: string | null;
  farmacia: {
    id: string;
    codigo: string;
    nombre: string;
    esInterna: boolean;
  } | null;
  integrante: {
    id: string;
    nombre: string;
    dni: string | null;
  } | null;
};

export function obtenerSaldoOrdenes(afiliadoId: string, periodo?: string) {
  const qs = periodo ? `?periodo=${encodeURIComponent(periodo)}` : "";
  return api<SaldoOrdenes>(`/coseguro/afiliados/${afiliadoId}/ordenes/saldo${qs}`);
}

export function listarConsumosOrdenes(afiliadoId: string, periodo?: string) {
  const qs = periodo ? `?periodo=${encodeURIComponent(periodo)}` : "";
  return api<ConsumoOrden[]>(`/coseguro/afiliados/${afiliadoId}/ordenes${qs}`);
}

export function anularConsumoAdmin(consumoId: string, motivo: string) {
  return api<{ ok: true }>(`/coseguro/afiliados/ordenes/${consumoId}/anular`, {
    method: "POST",
    body: JSON.stringify({ motivo }),
  });
}
