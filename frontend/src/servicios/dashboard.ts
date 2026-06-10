import { api } from "./api";

export type DashboardStats = {
  afiliados: {
    total: number;
    activos: number;
    nuevosMes: number;
  };
  padrones: { total: number };
  caja: {
    abierta: boolean;
    cajaId: string | null;
    sede: string | null;
    fechaApertura: string | null;
    cobradoHoy: number;
    cantidadPagosHoy: number;
  };
  ordenes: {
    pendientes: number;
    enCurso: number;
  };
  tesoreria: {
    comprobantesPendientes: number;
    ordenesPagoBorrador: number;
  };
  novedades: { pendientes: number };
  reintegros: { pendientes: number };
  generadoEn: string;
};

export function fetchDashboardStats(): Promise<DashboardStats> {
  return api<DashboardStats>("/dashboard/stats");
}
