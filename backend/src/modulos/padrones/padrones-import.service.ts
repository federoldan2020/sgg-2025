import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import * as Papa from 'papaparse';
import { randomUUID } from 'crypto';
import {
  ImportMode,
  ImportOptionsDto,
  PadronCsvRow,
  ImportPreviewResponse,
  ImportResultResponse,
  OperacionPreview,
} from './dto/import-padrones.dto';

@Injectable()
export class PadronesImportService {
  private previews = new Map<string, { rows: PadronCsvRow[]; options: ImportOptionsDto }>();

  constructor(private prisma: PrismaService) {}

  generarPlantilla(): string {
    const headers = [
      'dni',
      'padron',
      'centro',
      'sector',
      'clase',
      'situacion',
      'fechaAlta',
      'fechaBaja',
      'activo',
      'j17',
      'j22',
      'j38',
      'k16',
      'sistema',
      'sueldoBasico',
      'cupo',
      '_modo',
    ];
    return headers.join(',');
  }

  generarEjemplo(): string {
    const rows = [
      this.generarPlantilla(),
      '12345678,ES0001234,100,10,A,TITULAR,2020-01-01,,SI,1500.00,800.00,0.00,0.00,ESC,45000.00,50000.00,upsert',
      '12345678,SG0005678,200,20,B,SUPLEMENTE,2021-06-01,,SI,0.00,0.00,0.00,0.00,SG,38000.00,30000.00,create_only',
    ];
    return rows.join('\n');
  }

  async preview(
    organizacionId: string,
    fileBuffer: Buffer,
    options: ImportOptionsDto,
  ): Promise<ImportPreviewResponse> {
    const previewId = randomUUID();

    const csvText = fileBuffer.toString('utf-8');
    const parsed = Papa.parse<PadronCsvRow>(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
    });
    if (parsed.errors.length > 0)
      throw new Error(`Error al parsear CSV: ${parsed.errors[0].message}`);
    const rows = parsed.data;
    this.previews.set(previewId, { rows, options });

    // Buscar afiliados por DNI y padrones existentes
    const dnis = rows.map((r) => BigInt(r.dni)).filter((d) => !isNaN(Number(d)));
    const afiliados = await this.prisma.afiliado.findMany({
      where: { organizacionId, dni: { in: dnis } },
      select: { id: true, dni: true },
    });
    const afiliadoByDni = new Map(afiliados.map((a) => [a.dni.toString(), a]));

    const padronIds = rows.map((r) => r.padron).filter(Boolean);
    const padronesExist = await this.prisma.padron.findMany({
      where: { organizacionId, padron: { in: padronIds } },
      select: { id: true, padron: true },
    });
    const padronMap = new Map(padronesExist.map((p) => [p.padron, p]));

    const operaciones: OperacionPreview[] = [];
    let errores = 0;
    const warnings = 0;
    let aCrear = 0;
    let aActualizar = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const fila = i + 2;

      if (!row.dni || !/^\d{7,8}$/.test(row.dni)) {
        operaciones.push({
          fila,
          operacion: 'ERROR',
          padron: row.padron,
          dni: row.dni || '',
          status: 'ERROR',
          mensaje: 'DNI inválido',
        });
        errores++;
        continue;
      }
      if (!row.padron || row.padron.trim() === '') {
        operaciones.push({
          fila,
          operacion: 'ERROR',
          padron: row.padron || '',
          dni: row.dni,
          status: 'ERROR',
          mensaje: 'Padrón es obligatorio',
        });
        errores++;
        continue;
      }

      const af = afiliadoByDni.get(row.dni);
      if (!af) {
        operaciones.push({
          fila,
          operacion: 'ERROR',
          padron: row.padron,
          dni: row.dni,
          status: 'ERROR',
          mensaje: 'Afiliado (DNI) no existe',
        });
        errores++;
        continue;
      }

      const existe = padronMap.get(row.padron);
      const modo = (row._modo as ImportMode) || options.mode || ImportMode.UPSERT;

      if (existe) {
        if (modo === ImportMode.CREATE_ONLY) {
          operaciones.push({
            fila,
            operacion: 'ERROR',
            padron: row.padron,
            dni: row.dni,
            status: 'ERROR',
            mensaje: 'Ya existe (CREATE_ONLY)',
          });
          errores++;
          continue;
        }
        operaciones.push({
          fila,
          operacion: 'ACTUALIZAR',
          padron: row.padron,
          dni: row.dni,
          status: 'OK',
        });
        aActualizar++;
      } else {
        if (modo === ImportMode.UPDATE_ONLY) {
          operaciones.push({
            fila,
            operacion: 'ERROR',
            padron: row.padron,
            dni: row.dni,
            status: 'ERROR',
            mensaje: 'No existe (UPDATE_ONLY)',
          });
          errores++;
          continue;
        }
        operaciones.push({
          fila,
          operacion: 'CREAR',
          padron: row.padron,
          dni: row.dni,
          status: 'OK',
        });
        aCrear++;
      }
    }

    return {
      previewId,
      resumen: { total: rows.length, aCrear, aActualizar, errores, warnings },
      operaciones,
      puedeConfirmar: errores === 0,
    };
  }

  async confirmar(organizacionId: string, previewId: string): Promise<ImportResultResponse> {
    const cached = this.previews.get(previewId);
    if (!cached) throw new Error('Preview no encontrado o expirado');
    const { rows, options } = cached;

    const result = await this.prisma.$transaction(async (tx) => {
      let creados = 0,
        actualizados = 0;
      const errores: Array<{ fila: number; mensaje: string }> = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const fila = i + 2;

        try {
          const afiliado = await tx.afiliado.findFirst({
            where: { organizacionId, dni: BigInt(row.dni) },
          });
          if (!afiliado) {
            errores.push({ fila, mensaje: 'Afiliado inexistente' });
            continue;
          }

          const existe = await tx.padron.findFirst({
            where: { organizacionId, padron: row.padron },
          });
          const data: any = {
            organizacionId,
            afiliadoId: afiliado.id,
            padron: row.padron,
            centro: row.centro ? parseInt(row.centro) : null,
            sector: row.sector ? parseInt(row.sector) : null,
            clase: row.clase || null,
            situacion: row.situacion || null,
            fechaAlta: row.fechaAlta ? new Date(row.fechaAlta) : null,
            fechaBaja: row.fechaBaja ? new Date(row.fechaBaja) : null,
            activo: (row.activo || 'SI').toUpperCase() === 'SI',
            j17: row.j17 ? parseFloat(row.j17) : 0,
            j22: row.j22 ? parseFloat(row.j22) : 0,
            j38: row.j38 ? parseFloat(row.j38) : 0,
            k16: row.k16 ? parseFloat(row.k16) : 0,
            sistema: row.sistema || null,
            sueldoBasico: row.sueldoBasico ? parseFloat(row.sueldoBasico) : 0,
            cupo: row.cupo ? parseFloat(row.cupo) : 0,
          };

          const modo = (row._modo as ImportMode) || options.mode || ImportMode.UPSERT;

          if (existe) {
            if (modo === ImportMode.CREATE_ONLY) {
              errores.push({ fila, mensaje: 'Ya existe (CREATE_ONLY)' });
              continue;
            }
            await tx.padron.update({ where: { id: existe.id }, data });
            actualizados++;
          } else {
            if (modo === ImportMode.UPDATE_ONLY) {
              errores.push({ fila, mensaje: 'No existe (UPDATE_ONLY)' });
              continue;
            }
            await tx.padron.create({ data });
            creados++;
          }
        } catch (e: any) {
          errores.push({ fila, mensaje: e.message || 'Error inesperado' });
        }
      }

      return { creados, actualizados, errores };
    });

    this.previews.delete(previewId);
    return {
      exitoso: result.errores.length === 0,
      resumen: {
        total: rows.length,
        creados: result.creados,
        actualizados: result.actualizados,
        errores: result.errores.length,
      },
      errores: result.errores.length ? result.errores : undefined,
    };
  }
}
