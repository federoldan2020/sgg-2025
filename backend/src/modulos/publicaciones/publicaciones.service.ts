import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { PrismaService } from '../../common/prisma.service';
import { CrearPublicacionDto, DraftColateralDto, DryRunResumen } from './dtos';
import { PublicacionEstado, Prisma } from '@prisma/client';
import { JOB_NAMES, QUEUE_NAMES } from '../../infra/queues/queues.constants';

@Injectable()
export class PublicacionesService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.COLATERALES) private readonly colateralesQueue: Queue,
  ) {}

  private requireOrg(headers: Record<string, unknown>): string {
    const h = Object.fromEntries(
      Object.entries(headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]),
    ) as Record<string, unknown>;
    const id = (h['x-organizacion-id'] as string) || (h['x-org-id'] as string);
    if (!id || !id.trim()) throw new BadRequestException('X-Organizacion-ID requerido');
    return id;
  }

  // Pequeño helper para IDs de job válidos en BullMQ (sin ':')
  private makeJobId(...parts: Array<string | number | bigint>): string {
    return parts
      .map((p) => String(p))
      .join('-')
      .replace(/[:]/g, '-') // 🔒 sin ':'
      .slice(0, 256); // por las dudas
  }

  async crearPublicacion(headers: Record<string, unknown>, dto: CrearPublicacionDto) {
    const organizacionId = this.requireOrg(headers);
    return this.prisma.publicacionReglas.create({
      data: { organizacionId, comentario: dto?.comentario ?? undefined },
      select: { id: true, estado: true, comentario: true, creadoAt: true },
    });
  }

  async getPublicacion(headers: Record<string, unknown>, id: string) {
    const organizacionId = this.requireOrg(headers);
    const pub = await this.prisma.publicacionReglas.findFirst({
      where: { id: BigInt(id), organizacionId },
      include: { drafts: true },
    });
    if (!pub) throw new NotFoundException('Publicación no encontrada');
    return pub;
  }

  async abrirPublicacion(headers: Record<string, unknown>, dto?: CrearPublicacionDto) {
    const organizacionId = this.requireOrg(headers);
    const existente = await this.prisma.publicacionReglas.findFirst({
      where: { organizacionId, estado: PublicacionEstado.draft },
      orderBy: { creadoAt: 'desc' },
      select: { id: true, estado: true, comentario: true, creadoAt: true },
    });
    if (existente) return existente;

    return this.prisma.publicacionReglas.create({
      data: { organizacionId, comentario: dto?.comentario ?? undefined },
      select: { id: true, estado: true, comentario: true, creadoAt: true },
    });
  }

  async getPublicacionAbierta(headers: Record<string, unknown>) {
    const organizacionId = this.requireOrg(headers);
    return (
      (await this.prisma.publicacionReglas.findFirst({
        where: { organizacionId, estado: PublicacionEstado.draft },
        orderBy: { creadoAt: 'desc' },
        select: { id: true, estado: true, comentario: true, creadoAt: true },
      })) ?? null
    );
  }

  async agregarDraftColateral(
    headers: Record<string, unknown>,
    id: string,
    body: DraftColateralDto,
  ) {
    const organizacionId = this.requireOrg(headers);
    const pub = await this.prisma.publicacionReglas.findFirst({
      where: { id: BigInt(id), organizacionId, estado: PublicacionEstado.draft },
      select: { id: true },
    });
    if (!pub) throw new BadRequestException('Publicación inexistente o no-draft');

    if (body.op !== 'delete' && !body.vigenteDesde) {
      throw new BadRequestException('vigenteDesde requerido');
    }
    // En create se exige al menos un precio (uno solo: por cabeza o total).
    if (body.op === 'create') {
      const tienePorCol = body.precioPorColateral != null;
      const tieneTotal = body.precioTotal != null;
      if (tienePorCol === tieneTotal) {
        throw new BadRequestException(
          'Debe enviar exactamente uno de precioPorColateral o precioTotal',
        );
      }
    }

    // 🔧 Normalizaciones de tipo
    // parentescoId: null explícito = comodín; undefined = no tocar (en update).
    const parentescoId =
      body.parentescoId === undefined
        ? undefined
        : body.parentescoId === null || (body.parentescoId as any) === ''
          ? null
          : BigInt(body.parentescoId as any);

    const cantidadDesde =
      body.cantidadDesde != null ? Number(body.cantidadDesde as any) : undefined;

    const cantidadHasta =
      body.cantidadHasta === undefined
        ? undefined
        : body.cantidadHasta === null || (body.cantidadHasta as any) === ''
          ? null
          : Number(body.cantidadHasta as any);

    const vigenteDesde = body.vigenteDesde != null ? new Date(body.vigenteDesde as any) : undefined;

    const vigenteHasta =
      body.vigenteHasta === undefined
        ? undefined
        : body.vigenteHasta === null || (body.vigenteHasta as any) === ''
          ? null
          : new Date(body.vigenteHasta as any);

    const precioPorColateral =
      body.precioPorColateral != null
        ? new Prisma.Decimal(String(body.precioPorColateral))
        : undefined;
    const precioTotal =
      body.precioTotal != null ? new Prisma.Decimal(String(body.precioTotal)) : undefined;

    return this.prisma.reglaPrecioColateralDraft.create({
      data: {
        publicacionId: BigInt(id),
        organizacionId,
        op: body.op,
        targetId: body.targetId ? BigInt(body.targetId as any) : undefined,
        parentescoId,
        cantidadDesde,
        cantidadHasta,
        vigenteDesde,
        vigenteHasta,
        precioPorColateral,
        precioTotal,
        activo: body.activo ?? undefined,
      },
    });
  }

  async eliminarDraft(headers: Record<string, unknown>, id: string, draftId: string) {
    const organizacionId = this.requireOrg(headers);
    const pub = await this.prisma.publicacionReglas.findFirst({
      where: { id: BigInt(id), organizacionId, estado: PublicacionEstado.draft },
      select: { id: true },
    });
    if (!pub) throw new BadRequestException('Publicación inexistente o no-draft');

    await this.prisma.reglaPrecioColateralDraft.deleteMany({
      where: { id: BigInt(draftId), publicacionId: BigInt(id), organizacionId },
    });
    return { ok: true as const };
  }

  async dryRun(headers: Record<string, unknown>, id: string): Promise<DryRunResumen> {
    const organizacionId = this.requireOrg(headers);
    const drafts = await this.prisma.reglaPrecioColateralDraft.findMany({
      where: { publicacionId: BigInt(id), organizacionId },
    });

    const parentescoIds = Array.from(
      new Set(
        drafts
          .map((d) => (d.parentescoId ? d.parentescoId.toString() : d.targetId?.toString()))
          .filter((x): x is string => !!x),
      ),
    );

    const reglasImpactadas = drafts.length;

    const aseguradosAfectados = parentescoIds.length
      ? await this.prisma.colateral.count({
          where: {
            activo: true,
            parentescoId: { in: parentescoIds.map((x) => BigInt(x)) },
            afiliado: { is: { organizacionId } },
          },
        })
      : 0;

    return {
      parentescosAfectados: parentescoIds.map((pid) => ({ parentescoId: pid })),
      reglasImpactadas,
      aseguradosAfectados,
      estimacionAjustes: 0,
    };
  }

  async publicar(headers: Record<string, unknown>, id: string, comentario?: string) {
    const organizacionId = this.requireOrg(headers);
    const pub = await this.prisma.publicacionReglas.findFirst({
      where: { id: BigInt(id), organizacionId, estado: PublicacionEstado.draft },
      select: { id: true, comentario: true },
    });
    if (!pub) throw new BadRequestException('Publicación inexistente o no-draft');

    if (comentario && comentario.trim()) {
      await this.prisma.publicacionReglas.update({
        where: { id: BigInt(id) },
        data: { comentario },
      });
    }

    // 🚫 Antes: `pub:${organizacionId}:${id}`  -> falla por ':'
    const jobId = this.makeJobId('pub', organizacionId, id);

    await this.colateralesQueue.add(
      JOB_NAMES.RECALC_PUBLICACION,
      { publicacionId: String(id), organizacionId },
      { jobId },
    );

    const prismaAny = this.prisma as any;
    if (prismaAny?.novedadPendiente?.create) {
      try {
        await prismaAny.novedadPendiente.create({
          data: {
            organizacionId,
            tipo: 'PUBLICACION_ENCOLADA',
            referenciaId: String(id),
            descripcion: 'Publicación encolada para recálculo de colaterales (J38).',
          },
        });
      } catch {
        /* noop */
      }
    }

    return { ok: true as const, encolado: true, jobId };
  }

  async cancelar(headers: Record<string, unknown>, id: string) {
    const organizacionId = this.requireOrg(headers);
    await this.prisma.publicacionReglas.updateMany({
      where: { id: BigInt(id), organizacionId, estado: PublicacionEstado.draft },
      data: { estado: PublicacionEstado.cancelada },
    });
    return { ok: true as const };
  }
}
