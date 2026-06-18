import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { DossanjuanService, SesionExpiradaError } from './dossanjuan.service';
import { DossanjuanAuthService } from './dossanjuan-auth.service';
import { CODIGO_UDAP, getDossanjuanConfig } from './dossanjuan.config';
import type { SyncDossanjuanAccion, SyncDossanjuan } from '@prisma/client';

type IdLike = string | number | bigint;
const toBig = (v: IdLike): bigint => (typeof v === 'bigint' ? v : BigInt(v));
const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Cola persistente + worker para sincronizar coseguro local ↔ dossanjuan.
 *
 * API pública:
 *   - encolarAlta(organizacionId, coseguroId, dni)  → fire-and-forget
 *   - encolarBaja(organizacionId, coseguroId, dni)  → fire-and-forget
 *
 * Comportamiento:
 *   - Cada `encolar*` crea fila PENDIENTE e intenta procesarla en el momento
 *     (sin await, no bloquea el flujo local).
 *   - Si falla, queda en PENDIENTE para el cron interno (cada N min).
 *   - Idempotencia: antes de cada llamada se hace `buscarPersona(dni)` y se
 *     compara con el estado deseado.
 *   - SesionExpiradaError → no consume intento; invalida cookies y reintenta.
 *   - Otros errores → suman intento; al llegar a `maxIntentos` pasa a
 *     ERROR_PERMANENTE.
 */
@Injectable()
export class DossanjuanSyncService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(DossanjuanSyncService.name);
  private cronHandle: NodeJS.Timeout | null = null;
  private workerCorriendo = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ds: DossanjuanService,
    private readonly auth: DossanjuanAuthService,
  ) {}

  // =====================================================================
  // Lifecycle: cron
  // =====================================================================

  onApplicationBootstrap(): void {
    const cfg = getDossanjuanConfig();
    if (!cfg.usuario || !cfg.password) {
      this.logger.warn(
        'dossanjuan: credenciales no configuradas — el cron no arranca, las acciones quedan en cola hasta que se completen DOSSANJUAN_USER/PASS.',
      );
      return;
    }
    if (this.cronHandle) return;
    this.cronHandle = setInterval(() => {
      void this.procesarPendientes();
    }, cfg.syncIntervalMs);
    // El proceso puede terminar sin esperar al timer.
    this.cronHandle.unref?.();
    this.logger.log(
      `Cron dossanjuan iniciado (interval=${cfg.syncIntervalMs}ms, batch=${cfg.batchSize}, maxIntentos=${cfg.maxIntentos})`,
    );
  }

  onApplicationShutdown(): void {
    if (this.cronHandle) {
      clearInterval(this.cronHandle);
      this.cronHandle = null;
    }
  }

  // =====================================================================
  // API pública: encolar
  // =====================================================================

  encolarAlta(organizacionId: string, coseguroId: IdLike | null, dni: IdLike): void {
    void this.encolar('ALTA', organizacionId, coseguroId, dni);
  }

  encolarBaja(organizacionId: string, coseguroId: IdLike | null, dni: IdLike): void {
    void this.encolar('BAJA', organizacionId, coseguroId, dni);
  }

  /** Para tests / endpoint admin: dispara un tick manual. */
  async procesarPendientesAhora() {
    await this.procesarPendientes();
  }

  // =====================================================================
  // Internals
  // =====================================================================

  private async encolar(
    accion: SyncDossanjuanAccion,
    organizacionId: string,
    coseguroId: IdLike | null,
    dni: IdLike,
  ): Promise<void> {
    // Toda la sincronización es best-effort: NUNCA debe romper el flujo local
    // del coseguro. Cualquier excepción se loggea y se traga.
    try {
      const dniBig = toBig(dni);
      if (dniBig <= 0n) return;

      const fila = await this.prisma.syncDossanjuan.create({
        data: {
          organizacionId,
          coseguroId: coseguroId != null ? toBig(coseguroId) : null,
          dni: dniBig,
          accion,
          estado: 'PENDIENTE',
        },
      });

      // Intento inmediato (no await — el caller no espera).
      void this.procesarFila(fila).catch((e) => {
        this.logger.warn(
          `Procesado inmediato falló para fila ${fila.id.toString()}: ${e?.message ?? e}`,
        );
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`Error encolando ${accion} dni=${dni}: ${msg}`);
    }
  }

  private async procesarPendientes(): Promise<void> {
    if (this.workerCorriendo) return;
    this.workerCorriendo = true;
    try {
      const cfg = getDossanjuanConfig();
      const filas = await this.prisma.syncDossanjuan.findMany({
        where: { estado: 'PENDIENTE' },
        orderBy: { creadoEn: 'asc' },
        take: cfg.batchSize,
      });
      if (filas.length === 0) return;

      this.logger.log(`Cron dossanjuan: ${filas.length} pendientes`);
      for (const fila of filas) {
        try {
          await this.procesarFila(fila);
        } catch (e) {
          this.logger.error(
            `procesarFila ${fila.id.toString()} explotó: ${e instanceof Error ? e.message : e}`,
          );
        }
        await delay(cfg.rateLimitMs);
      }
    } finally {
      this.workerCorriendo = false;
    }
  }

  private async procesarFila(filaInicial: SyncDossanjuan): Promise<void> {
    const cfg = getDossanjuanConfig();
    // Re-leer fila por si fue actualizada por otra corrida concurrente.
    const fila = await this.prisma.syncDossanjuan.findUnique({
      where: { id: filaInicial.id },
    });
    if (!fila || fila.estado !== 'PENDIENTE') return;

    const dniStr = fila.dni.toString();
    const esperado = fila.accion === 'ALTA' ? CODIGO_UDAP : '';

    try {
      // Idempotencia: consultar estado remoto del DNI individual.
      const persona = await this.ds.buscarPersona(dniStr);
      if (persona.codigoPropio === esperado) {
        await this.prisma.syncDossanjuan.update({
          where: { id: fila.id },
          data: {
            estado: 'OK',
            respuestaWs: 'Idempotente: estado remoto ya coincide',
            ejecutadoEn: new Date(),
          },
        });
        return;
      }

      // Ejecutar el cambio.
      const resp =
        fila.accion === 'ALTA'
          ? await this.ds.darAltaUdap(dniStr)
          : await this.ds.darBaja(dniStr);

      await this.prisma.syncDossanjuan.update({
        where: { id: fila.id },
        data: {
          estado: 'OK',
          respuestaWs: resp.slice(0, 4000),
          ejecutadoEn: new Date(),
        },
      });
      this.logger.log(
        `Sync OK dni=${dniStr} accion=${fila.accion} → '${esperado}'`,
      );
    } catch (e: unknown) {
      if (e instanceof SesionExpiradaError) {
        // No consume intento. Las cookies ya fueron invalidadas en service.
        await this.prisma.syncDossanjuan.update({
          where: { id: fila.id },
          data: { ultimoError: 'SesionExpiradaError' },
        });
        return;
      }
      const msg = e instanceof Error ? e.message : String(e);
      const nuevosIntentos = fila.intentos + 1;
      const llegaAlMax = nuevosIntentos >= cfg.maxIntentos;
      await this.prisma.syncDossanjuan.update({
        where: { id: fila.id },
        data: {
          intentos: nuevosIntentos,
          ultimoError: msg.slice(0, 2000),
          estado: llegaAlMax ? 'ERROR_PERMANENTE' : 'PENDIENTE',
        },
      });
      this.logger.warn(
        `Sync error dni=${dniStr} accion=${fila.accion} intento=${nuevosIntentos}/${cfg.maxIntentos}: ${msg}`,
      );
    }
  }
}
