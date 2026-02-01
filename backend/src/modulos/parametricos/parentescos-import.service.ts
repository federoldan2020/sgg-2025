import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import * as Papa from 'papaparse';
import * as ExcelJS from 'exceljs';
import { randomUUID } from 'crypto';
import {
  ImportMode,
  MergeStrategy,
  ImportOptionsDto,
  ParentescoCsvRow,
  ValidationIssue,
  OperacionPreview,
  ImportPreviewResponse,
  ImportResultResponse,
  CambioDetectado,
} from './dto/import-parentescos.dto';

@Injectable()
export class ParentescosImportService {
  private previews = new Map<string, { rows: ParentescoCsvRow[]; options: ImportOptionsDto }>();

  constructor(private prisma: PrismaService) {}

  private static HEADER_ALIASES: Record<string, keyof ParentescoCsvRow> = {
    codigo: 'codigo',
    cod: 'codigo',
    descripcio: 'descripcio',
    descripcion: 'descripcio',
    desc: 'descripcio',
    activo: 'activo',
  };

  private normalizarHeader(h: string): string {
    const key = h
      .trim()
      .toLowerCase()
      .replace(/\./g, '')
      .replace(/\s+/g, '_');
    return (ParentescosImportService.HEADER_ALIASES[key] as string) || key;
  }

  private normalizarFila(row: ParentescoCsvRow): ParentescoCsvRow {
    row.codigo = row.codigo?.trim();
    row.descripcio = row.descripcio || row.descripcion || row.desc;
    row.descripcio = row.descripcio?.trim();
    return row;
  }

  private async parseRows(
    fileBuffer: Buffer,
    fileName?: string,
    mimeType?: string,
  ): Promise<ParentescoCsvRow[]> {
    const lowerName = (fileName || '').toLowerCase();
    const isXlsx =
      lowerName.endsWith('.xlsx') ||
      (mimeType || '').includes(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );

    if (isXlsx) {
      return this.parseXlsxRows(fileBuffer);
    }

    const csvText = fileBuffer.toString('utf-8');
    const parsed = Papa.parse<ParentescoCsvRow>(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => this.normalizarHeader(h),
    });

    if (parsed.errors.length > 0) {
      throw new Error(`Error al parsear CSV: ${parsed.errors[0].message}`);
    }

    return parsed.data;
  }

  private async parseXlsxRows(fileBuffer: Buffer): Promise<ParentescoCsvRow[]> {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(fileBuffer as any);
    const ws = wb.worksheets[0];
    if (!ws) throw new Error('El archivo XLSX no tiene hojas');

    const headerRow = ws.getRow(1);
    const headers: Array<string | null> = [];
    for (let i = 1; i <= headerRow.cellCount; i++) {
      const raw = this.cellToString(headerRow.getCell(i).value);
      headers[i] = raw ? this.normalizarHeader(raw) : null;
    }

    const rows: ParentescoCsvRow[] = [];
    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const obj: Record<string, string> = {};
      let hasValue = false;
      for (let c = 1; c <= headerRow.cellCount; c++) {
        const key = headers[c];
        if (!key) continue;
        const raw = this.cellToString(row.getCell(c).value);
        if (raw !== '') hasValue = true;
        obj[key] = raw;
      }
      if (!hasValue) continue;
      rows.push(obj as unknown as ParentescoCsvRow);
    }
    return rows;
  }

  private cellToString(value: ExcelJS.CellValue): string {
    if (value == null) return '';
    if (typeof value === 'number') return String(value);
    if (value instanceof Date) {
      const d = value.getDate().toString().padStart(2, '0');
      const m = (value.getMonth() + 1).toString().padStart(2, '0');
      const y = value.getFullYear();
      return `${d}/${m}/${y}`;
    }
    if (typeof value === 'object') {
      if ('result' in value) {
        return this.cellToString(value.result as ExcelJS.CellValue);
      }
      if ('text' in value) {
        return String((value as any).text ?? '');
      }
      if ('richText' in value) {
        return (value as any).richText?.map((t: any) => t.text).join('') ?? '';
      }
      if ('formula' in value) {
        return String((value as any).result ?? '');
      }
    }
    return String(value);
  }

  private parseIntStrict(value?: string | null): number | null {
    if (!value) return null;
    const v = String(value).trim().replace(/\D+/g, '');
    if (!v) return null;
    const n = Number(v);
    return isNaN(n) ? null : n;
  }

  private parseBoolean(value?: string | null): boolean | null {
    if (!value) return null;
    const v = String(value).trim();
    if (['1', 'true', 'si', 'sí', 's', 'activo', 'activa'].includes(v.toLowerCase())) return true;
    if (['0', 'false', 'no', 'n', 'baja', 'inactivo', 'inactiva'].includes(v.toLowerCase()))
      return false;
    return null;
  }

  private validarFila(
    row: ParentescoCsvRow,
    options: ImportOptionsDto,
    fila: number,
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Código obligatorio
    if (!row.codigo || row.codigo.trim() === '') {
      issues.push({
        fila,
        campo: 'codigo',
        tipo: 'ERROR',
        mensaje: 'Código es obligatorio',
      });
    } else {
      const codigo = this.parseIntStrict(row.codigo);
      if (!codigo || codigo < 1) {
        issues.push({
          fila,
          campo: 'codigo',
          tipo: 'ERROR',
          mensaje: 'Código debe ser un número positivo',
        });
      }
    }

    // Descripción obligatoria
    if (!row.descripcio || row.descripcio.trim() === '') {
      issues.push({
        fila,
        campo: 'descripcio',
        tipo: 'ERROR',
        mensaje: 'Descripción es obligatoria',
      });
    }

    return issues;
  }

  private getModoFila(row: ParentescoCsvRow, options: ImportOptionsDto): ImportMode {
    return options.mode || ImportMode.UPSERT;
  }

  private detectarCambios(
    existente: any,
    row: ParentescoCsvRow,
    options: ImportOptionsDto,
  ): Record<string, CambioDetectado> | null {
    const cambios: Record<string, CambioDetectado> = {};
    const descripcionNueva = row.descripcio?.trim() || '';
    const activoNuevo = this.parseBoolean(row.activo) ?? true;

    if (existente.descripcion !== descripcionNueva) {
      cambios.descripcion = {
        anterior: existente.descripcion,
        nuevo: descripcionNueva,
      };
    }

    if (existente.activo !== activoNuevo) {
      cambios.activo = {
        anterior: existente.activo,
        nuevo: activoNuevo,
      };
    }

    return Object.keys(cambios).length > 0 ? cambios : null;
  }

  /**
   * Genera CSV de plantilla vacía
   */
  private getHeaders(): string[] {
    return ['CODIGO', 'DESCRIPCIO', 'ACTIVO'];
  }

  generarPlantilla(): string {
    return this.getHeaders().join(',');
  }

  /**
   * Genera CSV de ejemplo con datos ficticios
   */
  generarEjemplo(): string {
    const rows = [
      this.generarPlantilla(),
      '1,CONYUGE,1',
      '2,HIJO/A,1',
      '3,PADRE/MADRE,1',
      '4,HERMANO/A,1',
      '6,HIJO DISCAPACITADO,1',
      '7,SUEGRO/A,1',
      '8,HIJO/A DISC(MAYOR 26 AÑOS),1',
      '9,NIETO/A MENOR TENENCIA,1',
      '10,HIJO DISC(21 A 26 AÑOS),1',
      '11,CONY.C/AP Y/O ADM.PUBL,1',
      '12,HIJO/A DISC,1',
      '13,HABILITADOS/OTROS,1',
    ];
    return rows.join('\n');
  }

  /**
   * Genera plantilla XLSX
   */
  async generarPlantillaXlsx(): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Parentescos');
    ws.addRow(this.getHeaders());
    ws.getRow(1).font = { bold: true };
    ws.columns.forEach((c) => {
      c.width = 25;
    });
    const out = await wb.xlsx.writeBuffer();
    return Buffer.isBuffer(out) ? out : Buffer.from(out as ArrayBuffer);
  }

  /**
   * Genera ejemplo XLSX
   */
  async generarEjemploXlsx(): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Parentescos');
    const rows = [
      this.getHeaders(),
      ['1', 'CONYUGE', '1'],
      ['2', 'HIJO/A', '1'],
      ['3', 'PADRE/MADRE', '1'],
      ['4', 'HERMANO/A', '1'],
      ['6', 'HIJO DISCAPACITADO', '1'],
      ['7', 'SUEGRO/A', '1'],
      ['8', 'HIJO/A DISC(MAYOR 26 AÑOS)', '1'],
      ['9', 'NIETO/A MENOR TENENCIA', '1'],
      ['10', 'HIJO DISC(21 A 26 AÑOS)', '1'],
      ['11', 'CONY.C/AP Y/O ADM.PUBL', '1'],
      ['12', 'HIJO/A DISC', '1'],
      ['13', 'HABILITADOS/OTROS', '1'],
    ];
    rows.forEach((r) => ws.addRow(r));
    ws.getRow(1).font = { bold: true };
    ws.columns.forEach((c) => {
      c.width = 25;
    });
    const out = await wb.xlsx.writeBuffer();
    return Buffer.isBuffer(out) ? out : Buffer.from(out as ArrayBuffer);
  }

  /**
   * Preview de importación
   */
  async preview(
    organizacionId: string,
    fileBuffer: Buffer,
    options: ImportOptionsDto,
    fileName?: string,
    mimeType?: string,
  ): Promise<ImportPreviewResponse> {
    const previewId = randomUUID();

    const rows = (await this.parseRows(fileBuffer, fileName, mimeType)).map((r) =>
      this.normalizarFila(r),
    );

    if (rows.length === 0) {
      throw new BadRequestException('El archivo está vacío');
    }

    // Guardar para confirm posterior
    this.previews.set(previewId, { rows, options });

    // Obtener parentescos existentes por código
    const codigos = rows
      .map((r) => this.parseIntStrict(r.codigo))
      .filter((c): c is number => c !== null && c > 0);
    const parentescos = await this.prisma.parentesco.findMany({
      where: {
        organizacionId,
        codigo: { in: codigos },
      },
      select: {
        id: true,
        codigo: true,
        descripcion: true,
        activo: true,
      },
    });
    const parentescosMap = new Map(parentescos.map((p) => [p.codigo, p]));

    // Validar y preparar operaciones
    const operaciones: OperacionPreview[] = [];
    let erroresCount = 0;
    let warningsCount = 0;
    let aCrear = 0;
    let aActualizar = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const fila = i + 2; // +2 porque +1 por header y +1 por 1-indexed

      // Validar campos obligatorios
      const issues = this.validarFila(row, options, fila);
      const errores = issues.filter((iss) => iss.tipo === 'ERROR');
      const warnings = issues.filter((iss) => iss.tipo === 'WARNING');

      if (errores.length > 0) {
        operaciones.push({
          fila,
          operacion: 'ERROR',
          codigo: row.codigo,
          descripcion: row.descripcio,
          status: 'ERROR',
          mensaje: errores.map((e) => e.mensaje).join('; '),
        });
        erroresCount++;
        continue;
      }

      const codigo = this.parseIntStrict(row.codigo);
      if (!codigo) {
        operaciones.push({
          fila,
          operacion: 'ERROR',
          codigo: row.codigo,
          descripcion: row.descripcio,
          status: 'ERROR',
          mensaje: 'Código inválido',
        });
        erroresCount++;
        continue;
      }

      const existe = parentescosMap.get(codigo);
      const modoFila = this.getModoFila(row, options);
      const descripcion = row.descripcio?.trim() || '';

      if (existe) {
        if (modoFila === ImportMode.CREATE_ONLY) {
          operaciones.push({
            fila,
            operacion: 'ERROR',
            codigo: String(codigo),
            descripcion,
            status: 'ERROR',
            mensaje: 'Parentesco ya existe y modo es CREATE_ONLY',
          });
          erroresCount++;
          continue;
        }

        // ACTUALIZAR
        const cambios = this.detectarCambios(existe, row, options);
        operaciones.push({
          fila,
          operacion: 'ACTUALIZAR',
          codigo: String(codigo),
          descripcion,
          status: warnings.length > 0 ? 'WARNING' : 'OK',
          mensaje: warnings.length > 0 ? warnings.map((w) => w.mensaje).join('; ') : undefined,
          cambios,
          continuar: true,
        });
        aActualizar++;
        if (warnings.length > 0) warningsCount++;
      } else {
        if (modoFila === ImportMode.UPDATE_ONLY) {
          operaciones.push({
            fila,
            operacion: 'ERROR',
            codigo: String(codigo),
            descripcion,
            status: 'ERROR',
            mensaje: 'Parentesco no existe y modo es UPDATE_ONLY',
          });
          erroresCount++;
          continue;
        }

        // CREAR
        operaciones.push({
          fila,
          operacion: 'CREAR',
          codigo: String(codigo),
          descripcion,
          status: warnings.length > 0 ? 'WARNING' : 'OK',
          mensaje: warnings.length > 0 ? warnings.map((w) => w.mensaje).join('; ') : undefined,
          cambios: null,
          continuar: true,
        });
        aCrear++;
        if (warnings.length > 0) warningsCount++;
      }
    }

    return {
      previewId,
      resumen: {
        total: rows.length,
        aCrear,
        aActualizar,
        errores: erroresCount,
        warnings: warningsCount,
      },
      operaciones,
      puedeConfirmar: erroresCount === 0,
    };
  }

  /**
   * Confirmar importación
   */
  async confirmar(
    organizacionId: string,
    previewId: string,
    ignoreWarnings: boolean,
  ): Promise<ImportResultResponse> {
    const preview = this.previews.get(previewId);
    if (!preview) {
      throw new NotFoundException('Preview no encontrado o expirado');
    }

    const { rows, options } = preview;
    this.previews.delete(previewId); // Limpiar preview usado

    let creados = 0;
    let actualizados = 0;
    const errores: Array<{ fila: number; mensaje: string }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const fila = i + 2;

      try {
        const codigo = this.parseIntStrict(row.codigo);
        if (!codigo || codigo < 1) {
          errores.push({ fila, mensaje: 'Código inválido' });
          continue;
        }

        const descripcion = row.descripcio?.trim() || '';
        if (!descripcion) {
          errores.push({ fila, mensaje: 'Descripción es obligatoria' });
          continue;
        }

        const activo = this.parseBoolean(row.activo) ?? true;

        // Buscar parentesco existente
        const existe = await this.prisma.parentesco.findFirst({
          where: {
            organizacionId,
            codigo,
          },
        });

        const modoFila = this.getModoFila(row, options);

        if (existe) {
          if (modoFila === ImportMode.CREATE_ONLY) {
            errores.push({ fila, mensaje: 'Parentesco ya existe y modo es CREATE_ONLY' });
            continue;
          }

          // ACTUALIZAR
          await this.prisma.parentesco.update({
            where: { id: existe.id },
            data: {
              descripcion,
              activo,
            },
          });
          actualizados++;
        } else {
          if (modoFila === ImportMode.UPDATE_ONLY) {
            errores.push({ fila, mensaje: 'Parentesco no existe y modo es UPDATE_ONLY' });
            continue;
          }

          // CREAR
          await this.prisma.parentesco.create({
            data: {
              organizacionId,
              codigo,
              descripcion,
              activo,
            },
          });
          creados++;
        }
      } catch (e: any) {
        errores.push({
          fila,
          mensaje: e?.message || 'Error desconocido al procesar la fila',
        });
      }
    }

    return {
      exitoso: errores.length === 0,
      resumen: {
        total: rows.length,
        creados,
        actualizados,
        errores: errores.length,
      },
      errores: errores.length > 0 ? errores : undefined,
    };
  }
}
