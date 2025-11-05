import { Processor } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { BaseProcessor } from '../base/base.processor';
import { PrismaService } from '../../../common/prisma.service';
import { QUEUE_NAMES, JOB_NAMES } from '../queues.constants';
import { Prisma } from '@prisma/client';
// ADD:
import { NovedadesService } from '../../../modulos/novedades/novedades.service';

type PropagarJ38Payload = {
  organizacionId: string;
  padronId: string | number | bigint;
  nuevoJ38: string | number; // lo convertimos a Decimal
  motivo?: string;
};

@Processor(QUEUE_NAMES.PADRONES)
export class PadronesProcessor extends BaseProcessor {
  // ADD: inyectamos NovedadesService (no rompe nada existente)
  constructor(
    private readonly prisma: PrismaService,
    private readonly novedades: NovedadesService, // ADD
  ) {
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

  private async propagAR_J38(job: Job<PropagarJ38Payload>) {
    const { organizacionId, padronId, nuevoJ38, motivo } = job.data;

    const padron = await this.prisma.padron.findFirst({
      where: { id: BigInt(String(padronId)), organizacionId },
      select: { id: true, j38: true, afiliadoId: true, padron: true },
    });
    if (!padron) return { ok: false, reason: 'Padrón no encontrado' };

    const anterior = padron.j38;
    const siguiente = new Prisma.Decimal(nuevoJ38 as any);

    if (anterior.equals(siguiente)) {
      // INFO opcional
      return { ok: true, skipped: true };
    }

    // 1) Actualizar j38
    await this.prisma.padron.update({
      where: { id: padron.id },
      data: { j38: siguiente },
    });

    // 2) Registrar NOVEDAD canal J38 (usa tu service)  ✅
    //    Se verá en el monitor y luego se consolida por período+padrón.
    await this.novedades.registrarModifColaterales({
      organizacionId,
      afiliadoId: padron.afiliadoId,
      padronId: padron.id,
      nuevoTotal: siguiente,
      observacion:
        motivo ??
        `Actualizado J38 padrón ${padron.padron} (id ${padron.id}) de ${anterior.toString()} → ${siguiente.toString()}`,
    });

    // (Histórico opcional, si tu tabla existe)
    const prismaAny = this.prisma as any;
    if (prismaAny?.padronCambio?.create) {
      try {
        await prismaAny.padronCambio.create({
          data: {
            organizacionId,
            padronId: padron.id,
            campo: 'j38',
            valorAnterior: anterior.toString(),
            valorNuevo: siguiente.toString(),
            motivo: motivo ?? 'Propagación J38 por publicación de reglas',
            fecha: new Date(),
          },
        });
      } catch {
        /* noop */
      }
    }

    return { ok: true };
  }
}
