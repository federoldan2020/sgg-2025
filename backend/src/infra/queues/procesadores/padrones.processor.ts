import { Processor } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { BaseProcessor } from '../base/base.processor';
import { PrismaService } from '../../../common/prisma.service';
import { QUEUE_NAMES, JOB_NAMES } from '../queues.constants';

type PropagarJ38Payload = {
  organizacionId: string;
  padronId: string | number | bigint;
  nuevoJ38: string | number;
  motivo?: string;
};

/**
 * Procesador de jobs de padrones.
 *
 * El job legacy `PROPAGAR_J38` se mantiene como no-op:
 *   - el campo `Padron.j38` será eliminado del schema (modelo nuevo).
 *   - el módulo nuevo de novedades detecta deltas vs último envío al
 *     generar el lote; no necesita registrar eventos puntuales.
 */
@Processor(QUEUE_NAMES.PADRONES)
export class PadronesProcessor extends BaseProcessor {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job): Promise<any> {
    switch (job.name) {
      case JOB_NAMES.PROPAGAR_J38:
        return this.safe(job, () => this.propagAR_J38(job as Job<PropagarJ38Payload>));
      default:
        return;
    }
  }

  private async propagAR_J38(_job: Job<PropagarJ38Payload>) {
    // No-op. Se conserva el job para no romper colas en curso.
    void this.prisma;
    return { ok: true, skipped: true, reason: 'legacy_noop' };
  }
}
