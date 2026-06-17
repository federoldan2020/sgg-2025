import { Processor } from '@nestjs/bullmq';
import type { Job, Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { BaseProcessor } from '../base/base.processor';
import { PrismaService } from '../../../common/prisma.service';
import { JOB_NAMES, QUEUE_NAMES } from '../queues.constants';
import { PublicacionEstado, Prisma } from '@prisma/client';
import {
  seleccionarReglaJ38,
  aplicarPrecioRegla,
  type ReglaColateralCandidata,
} from '../../../modulos/colaterales/colaterales-precio.util';

type RecalcPublicacionPayload = {
  publicacionId: string;
  organizacionId: string;
};

// Helper para IDs de job (BullMQ no admite ':')
const jobIdSafe = (...parts: Array<string | number | bigint>) =>
  parts
    .map((p) => String(p))
    .join('-')
    .replace(/[:]/g, '-')
    .slice(0, 256);

@Processor(QUEUE_NAMES.COLATERALES)
export class PublicacionesProcessor extends BaseProcessor {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.PADRONES) private readonly padronesQueue: Queue,
  ) {
    super();
  }

  // No devolvemos el resultado para evitar TS2322 y no-unsafe-return en callers genéricos
  async process(job: Job): Promise<void> {
    switch (job.name) {
      case JOB_NAMES.RECALC_PUBLICACION: {
        await this.safe(job, () => this.recalcPublicacion(job as Job<RecalcPublicacionPayload>));
        return;
      }
      default:
        return;
    }
  }

  private async recalcPublicacion(
    job: Job<RecalcPublicacionPayload>,
  ): Promise<{ ok: true; impactos: number } | { ok: false; reason: string }> {
    const { publicacionId, organizacionId } = job.data;

    const pub = await this.prisma.publicacionReglas.findFirst({
      where: { id: BigInt(String(publicacionId)), organizacionId },
      include: { drafts: true },
    });
    if (!pub) return { ok: false as const, reason: 'Publicación no encontrada' };
    if (pub.estado !== PublicacionEstado.draft) {
      return { ok: false as const, reason: `Estado no válido: ${pub.estado}` };
    }

    // 1) Aplicar drafts
    const afectados = await this.aplicarDraftsColaterales(organizacionId, pub.id);

    // 2) Recalcular J38
    const impactos = await this.calcularImpactosJ38(organizacionId, afectados);

    // 3) Encolar impacto por padrón (IDs sin ':')
    for (const it of impactos) {
      const padronIdStr = String(it.padronId);
      const j38Str = it.j38.toString();

      await this.padronesQueue.add(
        JOB_NAMES.PROPAGAR_J38,
        {
          organizacionId,
          padronId: padronIdStr,
          nuevoJ38: j38Str,
          motivo: `Publicación ${String(pub.id)}`,
        },
        { jobId: jobIdSafe('padron', organizacionId, padronIdStr, 'j38', j38Str) },
      );
    }

    // 4) Marcar publicada (+ novedad informativa best-effort)
    await this.prisma.publicacionReglas.update({
      where: { id: pub.id },
      data: { estado: PublicacionEstado.publicada, publicadoAt: new Date() },
    });

    await this.marcarNovedad(
      organizacionId,
      `Publicación ${String(pub.id)} aplicada: ${impactos.length} padrón(es) encolado(s)`,
    );

    return { ok: true as const, impactos: impactos.length };
  }

  /**
   * Aplica los drafts. Devuelve el set de parentescos afectados explícitamente.
   * Si algún draft toca una regla comodín (parentescoId=null), incluimos un
   * sentinel `null` en el set para indicar "el cambio afecta a todos los
   * parentescos" — el cálculo de impacto debe expandir a todos los parentescos
   * con colaterales activos en esa org.
   */
  private async aplicarDraftsColaterales(
    organizacionId: string,
    publicacionId: bigint,
  ): Promise<Set<bigint | null>> {
    const drafts = await this.prisma.reglaPrecioColateralDraft.findMany({
      where: { publicacionId },
    });
    const afectados = new Set<bigint | null>();
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      for (const d of drafts) {
        // El draft puede traer parentescoId explícito (incluye null = comodín).
        if (d.parentescoId) afectados.add(BigInt(d.parentescoId));

        if (d.op === 'create') {
          // Validaciones mínimas: vigenteDesde + cantidadDesde + exactamente
          // un precio. parentescoId puede ser null (comodín).
          const tienePorCol = d.precioPorColateral != null;
          const tieneTotal = d.precioTotal != null;
          if (
            d.cantidadDesde == null ||
            d.vigenteDesde == null ||
            tienePorCol === tieneTotal
          ) {
            continue;
          }
          if (d.parentescoId == null) afectados.add(null);

          await tx.reglaPrecioColateral.create({
            data: {
              organizacionId,
              parentescoId: d.parentescoId ?? null,
              cantidadDesde: d.cantidadDesde,
              cantidadHasta: d.cantidadHasta ?? null,
              vigenteDesde: d.vigenteDesde,
              vigenteHasta: d.vigenteHasta ?? null,
              precioPorColateral: d.precioPorColateral ?? null,
              precioTotal: d.precioTotal ?? null,
              activo: d.activo ?? true,
            },
          });
        }

        if (d.op === 'update' && d.targetId) {
          const target = await tx.reglaPrecioColateral.findFirst({
            where: { id: d.targetId, organizacionId },
            select: { parentescoId: true },
          });
          if (target?.parentescoId) afectados.add(BigInt(target.parentescoId));
          else afectados.add(null);

          await tx.reglaPrecioColateral.update({
            where: { id: d.targetId },
            data: {
              parentescoId: d.parentescoId ?? undefined,
              cantidadDesde: d.cantidadDesde ?? undefined,
              cantidadHasta: d.cantidadHasta === undefined ? undefined : d.cantidadHasta,
              vigenteDesde: d.vigenteDesde ?? undefined,
              vigenteHasta: d.vigenteHasta === undefined ? undefined : d.vigenteHasta,
              precioPorColateral: d.precioPorColateral ?? undefined,
              precioTotal: d.precioTotal ?? undefined,
              activo: d.activo ?? undefined,
            },
          });
        }

        if (d.op === 'delete' && d.targetId) {
          const target = await tx.reglaPrecioColateral.findFirst({
            where: { id: d.targetId, organizacionId },
            select: { parentescoId: true },
          });
          if (target?.parentescoId) afectados.add(BigInt(target.parentescoId));
          else afectados.add(null);

          await tx.reglaPrecioColateral.update({
            where: { id: d.targetId },
            data: { activo: false, vigenteHasta: now },
          });
        }
      }
    });

    return afectados;
  }

  private async calcularImpactosJ38(
    organizacionId: string,
    parentescosAfectados: Set<bigint | null>,
  ): Promise<Array<{ padronId: bigint; j38: Prisma.Decimal }>> {
    const hoy = new Date();

    // Reglas vigentes (incluye comodín parentescoId=null)
    const reglas: ReglaColateralCandidata[] =
      await this.prisma.reglaPrecioColateral.findMany({
        where: {
          organizacionId,
          activo: true,
          vigenteDesde: { lte: hoy },
          OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: hoy } }],
        },
        select: {
          id: true,
          parentescoId: true,
          cantidadDesde: true,
          cantidadHasta: true,
          vigenteDesde: true,
          precioPorColateral: true,
          precioTotal: true,
        },
      });

    // Map afiliado -> padrón de imputación (Colaterales)
    const coseguros = await this.prisma.coseguroAfiliado.findMany({
      where: { organizacionId, estado: 'activo', imputacionPadronIdColaterales: { not: null } },
      select: { afiliadoId: true, imputacionPadronIdColaterales: true },
    });
    const padronPorAfiliado = new Map<bigint, bigint>();
    for (const c of coseguros) {
      padronPorAfiliado.set(BigInt(c.afiliadoId), BigInt(c.imputacionPadronIdColaterales!));
    }

    // ¿Hay un cambio que afecta a "todos" (comodín, parentescoId=null)?
    const afectaATodos = parentescosAfectados.has(null);
    const parentescosFijos = new Set<bigint>();
    for (const p of parentescosAfectados) if (p !== null) parentescosFijos.add(p);

    // Colaterales activos. Si el cambio es comodín → necesitamos TODOS;
    // sino, acotamos por los parentescos puntualmente afectados.
    const whereParentesco: Prisma.BigIntFilter | undefined =
      !afectaATodos && parentescosFijos.size
        ? { in: Array.from(parentescosFijos) }
        : undefined;

    const colats = await this.prisma.colateral.findMany({
      where: {
        activo: true,
        esColateral: true,
        ...(whereParentesco ? { parentescoId: whereParentesco } : {}),
        afiliado: { is: { organizacionId } },
      },
      select: { afiliadoId: true, parentescoId: true },
    });

    // Conteos por afiliado/parentesco
    const counts = new Map<string, number>();
    const afiliadosTocados = new Set<bigint>();
    for (const c of colats) {
      const aid = BigInt(c.afiliadoId);
      const pid = BigInt(c.parentescoId);
      afiliadosTocados.add(aid);
      const k = `${aid}:${pid}`;
      counts.set(k, (counts.get(k) || 0) + 1);
    }

    // Afiliados objetivo
    const afiliadosObjetivo: bigint[] = [];
    for (const [aid] of padronPorAfiliado) {
      if (afectaATodos || parentescosFijos.size === 0 || afiliadosTocados.has(aid)) {
        afiliadosObjetivo.push(aid);
      }
    }

    // Calcular J38 por padrón usando el helper común
    const impactos: Array<{ padronId: bigint; j38: Prisma.Decimal }> = [];
    for (const afiliadoId of afiliadosObjetivo) {
      const padronId = padronPorAfiliado.get(afiliadoId);
      if (!padronId) continue;

      // Parentescos a considerar: si afectaATodos, todos los del afiliado;
      // sino, sólo los explícitamente afectados (intersectados con los que
      // realmente tiene).
      const parentescosDelAfi = new Set<bigint>();
      for (const c of colats) {
        if (BigInt(c.afiliadoId) === afiliadoId) parentescosDelAfi.add(BigInt(c.parentescoId));
      }
      const parentescosParaAfiliado = afectaATodos
        ? Array.from(parentescosDelAfi)
        : Array.from(parentescosFijos).filter((p) => parentescosDelAfi.has(p));

      let total = new Prisma.Decimal(0);
      for (const parId of parentescosParaAfiliado) {
        const cant = counts.get(`${afiliadoId}:${parId}`) || 0;
        if (cant <= 0) continue;
        const ganadora = seleccionarReglaJ38(reglas, parId, cant);
        if (!ganadora) continue;
        total = total.add(aplicarPrecioRegla(ganadora, cant));
      }

      impactos.push({ padronId, j38: total });
    }

    return impactos;
  }

  // Best-effort informativo (el monitor consume las MODIF de J38 en PadronesProcessor)
  private async marcarNovedad(organizacionId: string, descripcion: string): Promise<void> {
    const prismaAny = this.prisma as any;

    if (prismaAny?.novedadPendiente?.create) {
      try {
        await prismaAny.novedadPendiente.create({
          data: {
            organizacionId,
            tipo: 'REGLAS_COLATERAL_PUBLICADAS',
            referenciaId: undefined,
            descripcion,
          },
        });
        return;
      } catch {
        /* noop */
      }
    }
    if (prismaAny?.novedadCalendario?.create) {
      try {
        await prismaAny.novedadCalendario.create({
          data: {
            organizacionId,
            titulo: 'Publicación aplicada',
            detalle: descripcion,
            referencia: undefined,
            fecha: new Date(),
          },
        });
        return;
      } catch {
        /* noop */
      }
    }
  }
}
