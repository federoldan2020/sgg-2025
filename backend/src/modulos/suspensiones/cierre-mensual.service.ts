import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/audit.service';
import { CoberturaService } from './cobertura.service';
import { SuspensionesService, ESTADOS_AFILIADO } from './suspensiones.service';

/**
 * Cierre mensual del día 10. Evalúa cobertura del período anterior (= período
 * que acaba de cerrar Cómputos/ANSES/04), suspende a los morosos sin excepción,
 * rehabilita a los que cancelaron deuda y marca padrones inactivos.
 *
 * Soporta `dryRun`: en modo simulación NO escribe estados, sólo arma el
 * informe. Útil para correrlo antes del día 10 y ver qué pasaría.
 */

export type DetalleCierre = {
  suspendidos: Array<{ afiliadoId: string; dni: string; apellido: string; nombre: string; periodo: string; deuda: number }>;
  rehabilitados: Array<{ afiliadoId: string; dni: string; apellido: string; nombre: string }>;
  excluidosExcepcion: Array<{ afiliadoId: string; dni: string; apellido: string; nombre: string; motivo: string }>;
  padronesMarcados: Array<{ padronId: string; padron: string; afiliadoId: string }>;
};

@Injectable()
export class CierreMensualService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly cobertura: CoberturaService,
    private readonly suspensiones: SuspensionesService,
  ) {}

  /**
   * Período inmediatamente anterior al actual en formato YYYY-MM.
   */
  static periodoCierreActual(referencia: Date = new Date()): string {
    const ref = new Date(referencia.getUTCFullYear(), referencia.getUTCMonth() - 1, 1);
    const y = ref.getFullYear();
    const m = String(ref.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  /**
   * Ejecuta el cierre.
   *  - dryRun=true: NO escribe estados ni suspensiones/rehabilitaciones,
   *    sólo recalcula coberturas y arma informe.
   */
  async ejecutar(opts: {
    organizacionId: string;
    periodo: string;
    dryRun?: boolean;
    usuarioId?: string;
  }) {
    const { organizacionId, periodo, dryRun = false, usuarioId } = opts;

    const corrida = await this.prisma.cierreMensual.create({
      data: {
        organizacionId,
        periodo,
        estado: dryRun ? 'dry_run' : 'en_curso',
        iniciadoPorId: usuarioId ?? null,
      },
    });

    const detalle: DetalleCierre = {
      suspendidos: [],
      rehabilitados: [],
      excluidosExcepcion: [],
      padronesMarcados: [],
    };

    try {
      const afiliados = await this.prisma.afiliado.findMany({
        where: { organizacionId },
        select: {
          id: true,
          dni: true,
          apellido: true,
          nombre: true,
          estado: true,
          padrones: { select: { id: true, padron: true, ultimoPeriodoCobranzaJ17: true, activo: true } },
        },
      });

      for (const af of afiliados) {
        // Recalcula cobertura del período evaluado (siempre, también en dry).
        const cob = await this.cobertura.calcular(organizacionId, af.id, periodo);

        const tieneExcepcion = await this.suspensiones.tieneExcepcionVigente(organizacionId, af.id);

        // El cierre mensual suspende SÓLO por J17 (cuota societaria), no por
        // J22/J38/K16. Los gates de coseguro/colaterales son dinámicos y se
        // evalúan al momento del consumo de cada servicio.
        const deudaJ17 = Math.max(0, cob.j17Esperado - cob.j17Cobrado);
        if (!cob.j17Cubierto && af.estado === ESTADOS_AFILIADO.ACTIVO) {
          if (tieneExcepcion) {
            detalle.excluidosExcepcion.push({
              afiliadoId: af.id.toString(),
              dni: af.dni.toString(),
              apellido: af.apellido,
              nombre: af.nombre,
              motivo: 'excepcion_admin_activa',
            });
            continue;
          }
          if (!dryRun) {
            await this.suspensiones.suspender(organizacionId, af.id, periodo, {
              usuarioId,
              estadoInicial: 'provisoria',
            });
          }
          detalle.suspendidos.push({
            afiliadoId: af.id.toString(),
            dni: af.dni.toString(),
            apellido: af.apellido,
            nombre: af.nombre,
            periodo,
            deuda: deudaJ17,
          });
        } else if (
          cob.j17Cubierto &&
          (af.estado === ESTADOS_AFILIADO.SUSP_PROVISORIO ||
            af.estado === ESTADOS_AFILIADO.SUSP_FIRME)
        ) {
          if (!dryRun) {
            // Sólo rehabilita si TODAS las suspensiones abiertas quedaron saldadas.
            try {
              await this.suspensiones.rehabilitar(organizacionId, af.id, 'cobranza_periodo', {
                usuarioId,
              });
              detalle.rehabilitados.push({
                afiliadoId: af.id.toString(),
                dni: af.dni.toString(),
                apellido: af.apellido,
                nombre: af.nombre,
              });
            } catch {
              // Período evaluado OK pero otros períodos previos siguen en mora → no rehabilita.
            }
          } else {
            detalle.rehabilitados.push({
              afiliadoId: af.id.toString(),
              dni: af.dni.toString(),
              apellido: af.apellido,
              nombre: af.nombre,
            });
          }
        }

        // Padrones inactivos: si en los últimos 3 meses calendario respecto
        // a HOY no cobraron J17, los marca inactivos + BajaInformable a
        // Cómputos (decisión 35).
        //
        // Reglas (revisadas para evitar falsos positivos del cierre):
        //   - Sólo se considera "candidato a inactivo" si `ultimoPeriodoCobranzaJ17`
        //     existe y es **anterior** al período (hoy - 3 meses).
        //   - Si `ultimoPeriodoCobranzaJ17` es NULL/vacío, NO se marca
        //     inactivo automáticamente (puede ser un padrón recién cargado
        //     que aún no recibió cobranza; eso necesita revisión manual,
        //     no auto-baja).
        //   - El límite se calcula sobre el mes calendario actual, no
        //     sobre el período evaluado. Eso evita que correr un cierre
        //     "del futuro" marque inactivos a padrones que sí cobraron
        //     recientemente.
        const limite = this.periodoActual(); // YYYY-MM de HOY
        const limite3MesesAtras = this.restarMeses(limite, 3);
        for (const p of af.padrones) {
          if (!p.activo) continue;
          const ultimo = p.ultimoPeriodoCobranzaJ17;
          // Sólo marcamos si hay un período concreto y es estrictamente
          // más viejo que (hoy - 3 meses).
          if (!ultimo || ultimo >= limite3MesesAtras) continue;

          if (!dryRun) {
            await this.prisma.padron.update({
              where: { id: p.id },
              data: { activo: false, evaluadoCoberturaEn: new Date() },
            });
            const yaPendiente = await this.prisma.bajaInformable.findFirst({
              where: {
                organizacionId,
                padronId: p.id,
                codigo: 'PADRON_COMPLETO',
                estado: 'pendiente',
              },
              select: { id: true },
            });
            if (!yaPendiente) {
              await this.prisma.bajaInformable.create({
                data: {
                  organizacionId,
                  padronId: p.id,
                  codigo: 'PADRON_COMPLETO',
                  motivo: 'cierre_inactivo_3m',
                  observacion: `Padrón sin cobranza J17 desde ${ultimo} (límite ${limite3MesesAtras}, hoy ${limite}).`,
                  solicitadoPorId: usuarioId ?? null,
                },
              });
            }
          }
          detalle.padronesMarcados.push({
            padronId: p.id.toString(),
            padron: p.padron,
            afiliadoId: af.id.toString(),
          });
        }
      }

      const finalizada = await this.prisma.cierreMensual.update({
        where: { id: corrida.id },
        data: {
          estado: dryRun ? 'dry_run' : 'completado',
          finalizadoEn: new Date(),
          totalSuspendidos: detalle.suspendidos.length,
          totalRehabilitados: detalle.rehabilitados.length,
          totalExcluidos: detalle.excluidosExcepcion.length,
          totalPadronesMarcados: detalle.padronesMarcados.length,
          resumen: detalle as any,
        },
      });

      await this.audit.log({
        organizacionId,
        usuarioId,
        accion: dryRun ? 'CIERRE_MENSUAL_DRY_RUN' : 'CIERRE_MENSUAL_EJECUTAR',
        entidad: 'CierreMensual',
        entidadId: corrida.id.toString(),
        metadata: {
          periodo,
          totalSuspendidos: detalle.suspendidos.length,
          totalRehabilitados: detalle.rehabilitados.length,
        },
      });

      return {
        id: finalizada.id.toString(),
        periodo,
        dryRun,
        totalSuspendidos: detalle.suspendidos.length,
        totalRehabilitados: detalle.rehabilitados.length,
        totalExcluidos: detalle.excluidosExcepcion.length,
        totalPadronesMarcados: detalle.padronesMarcados.length,
        resumen: detalle,
      };
    } catch (err) {
      await this.prisma.cierreMensual.update({
        where: { id: corrida.id },
        data: {
          estado: 'fallido',
          finalizadoEn: new Date(),
          errorMensaje: (err as Error).message,
        },
      });
      throw err;
    }
  }

  async listar(organizacionId: string, limit = 12) {
    const items = await this.prisma.cierreMensual.findMany({
      where: { organizacionId },
      orderBy: { iniciadoEn: 'desc' },
      take: limit,
    });
    return items.map((c) => ({ ...c, id: c.id.toString() }));
  }

  async detalle(organizacionId: string, id: bigint) {
    const c = await this.prisma.cierreMensual.findFirst({
      where: { organizacionId, id },
    });
    return c ? { ...c, id: c.id.toString() } : null;
  }

  private restarMeses(periodo: string, n: number): string {
    const [y, m] = periodo.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 - n, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  /** Mes calendario actual en formato YYYY-MM. */
  private periodoActual(): string {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  }
}
