import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

export interface AuditLogParams {
  usuarioId?: string;
  organizacionId?: string;
  accion: string;
  entidad: string;
  entidadId?: string;
  payloadAntes?: Record<string, unknown>;
  payloadDespues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: AuditLogParams): Promise<void> {
    try {
      await this.prisma.eventoAuditoria.create({
        data: {
          usuarioId: params.usuarioId,
          organizacionId: params.organizacionId || null,
          accion: params.accion,
          entidad: params.entidad,
          entidadId: params.entidadId || null,
          payloadAntes: params.payloadAntes ? (params.payloadAntes as object) : undefined,
          payloadDespues: params.payloadDespues ? (params.payloadDespues as object) : undefined,
          ipAddress: params.ipAddress || null,
          userAgent: params.userAgent || null,
          metadata: params.metadata ? (params.metadata as object) : undefined,
        },
      });
    } catch (err) {
      // No fallar la operación principal por un error de auditoría
      console.error('[AuditService] Error registrando evento:', err);
    }
  }
}
