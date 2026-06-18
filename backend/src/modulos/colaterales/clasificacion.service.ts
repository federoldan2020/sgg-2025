import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import type { ClasifResultado } from '@prisma/client';

/**
 * Sugerencia de clasificación para un integrante del grupo familiar.
 *
 * IMPORTANTE: este servicio SOLO sugiere. La fuente de verdad es
 * `Colateral.esColateral` (decisión del operario). La UI compara la
 * sugerencia contra el flag marcado y muestra un chip ⚠ cuando difieren.
 *
 * Evaluación: reglas `ReglaClasificacionIntegrante` activas vigentes a la
 * fecha, ordenadas por `prioridad ASC`. La primera regla cuyas condiciones
 * matcheen define el resultado. Si ninguna matchea → SIN_COBERTURA
 * (fail-closed).
 *
 * Condiciones evaluadas por regla:
 *   - parentescoId null  → cualquier parentesco
 *   - sexoTitular null   → cualquier sexo del titular
 *   - edadDesde/Hasta    → null = sin tope; inclusive
 *   - requiereEstudiante / requiereAportes / requiereDiscapacidad:
 *       null  → no importa
 *       true  → el flag debe ser true
 *       false → el flag debe ser false
 */

export type Sugerencia = {
  resultado: ClasifResultado | 'SIN_COBERTURA';
  reglaId: string | null;
  reglaDescripcion: string | null;
  reglaPrioridad: number | null;
  evaluadoAt: string; // ISO date
};

@Injectable()
export class ClasificacionService {
  constructor(private readonly prisma: PrismaService) {}

  /** Calcula sugerencia para un integrante específico. */
  async sugerirParaColateral(
    organizacionId: string,
    colateralId: string | number | bigint,
    at?: Date,
  ): Promise<Sugerencia> {
    const colateral = await this.prisma.colateral.findFirst({
      where: {
        id: BigInt(colateralId),
        afiliado: { organizacionId },
      },
      include: {
        afiliado: { select: { sexo: true } },
      },
    });
    if (!colateral) throw new NotFoundException('Integrante no encontrado');

    const fecha = at ?? new Date();
    const edad = edadDesde(colateral.fechaNacimiento, fecha);

    const reglas = await this.prisma.reglaClasificacionIntegrante.findMany({
      where: {
        organizacionId,
        activo: true,
        vigenteDesde: { lte: fecha },
        OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: fecha } }],
      },
      orderBy: { prioridad: 'asc' },
    });

    const sexoTit = colateral.afiliado?.sexo ?? null;

    for (const r of reglas) {
      // 1) Parentesco (null = comodín)
      if (r.parentescoId != null && r.parentescoId !== colateral.parentescoId) continue;
      // 2) Sexo titular
      if (r.sexoTitular != null && r.sexoTitular !== sexoTit) continue;
      // 3) Edad
      if (r.edadDesde != null && (edad == null || edad < r.edadDesde)) continue;
      if (r.edadHasta != null && (edad == null || edad > r.edadHasta)) continue;
      // 4) Flags
      if (r.requiereEstudiante != null && r.requiereEstudiante !== colateral.esEstudiante) continue;
      if (r.requiereAportes != null && r.requiereAportes !== colateral.tieneAportes) continue;
      if (
        r.requiereDiscapacidad != null &&
        r.requiereDiscapacidad !== colateral.esDiscapacitado
      ) {
        continue;
      }

      return {
        resultado: r.resultado,
        reglaId: r.id.toString(),
        reglaDescripcion: r.descripcion,
        reglaPrioridad: r.prioridad,
        evaluadoAt: fecha.toISOString(),
      };
    }

    // Sin regla → fail-closed
    return {
      resultado: 'SIN_COBERTURA',
      reglaId: null,
      reglaDescripcion: null,
      reglaPrioridad: null,
      evaluadoAt: fecha.toISOString(),
    };
  }

  /** Sugerencia masiva para todos los colaterales activos de un afiliado. */
  async sugerirParaAfiliado(
    organizacionId: string,
    afiliadoId: string | number | bigint,
    at?: Date,
  ): Promise<Array<Sugerencia & { colateralId: string }>> {
    const colaterales = await this.prisma.colateral.findMany({
      where: { afiliadoId: BigInt(afiliadoId), activo: true },
      select: { id: true },
    });

    const out: Array<Sugerencia & { colateralId: string }> = [];
    for (const c of colaterales) {
      const s = await this.sugerirParaColateral(organizacionId, c.id, at);
      out.push({ colateralId: c.id.toString(), ...s });
    }
    return out;
  }
}

function edadDesde(fechaNac: Date | null | undefined, at: Date): number | null {
  if (!fechaNac) return null;
  let edad = at.getFullYear() - fechaNac.getFullYear();
  const m = at.getMonth() - fechaNac.getMonth();
  if (m < 0 || (m === 0 && at.getDate() < fechaNac.getDate())) edad--;
  return edad;
}
