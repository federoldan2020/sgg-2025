import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { ColateralesService } from './colaterales.service';
import * as Papa from 'papaparse';
import * as ExcelJS from 'exceljs';
import { randomUUID } from 'crypto';
import {
  ImportMode,
  MergeStrategy,
  ImportOptionsDto,
  ColateralCsvRow,
  ValidationIssue,
  OperacionPreview,
  ImportPreviewResponse,
  ImportResultResponse,
  CambioDetectado,
} from './dto/import-colaterales.dto';

@Injectable()
export class ColateralesImportService {
  private previews = new Map<string, { rows: ColateralCsvRow[]; options: ImportOptionsDto }>();

  constructor(
    private prisma: PrismaService,
    private colateralesService: ColateralesService,
  ) {}

  private static HEADER_ALIASES: Record<string, keyof ColateralCsvRow> = {
    doc_titula: 'doc_titula',
    dni_titular: 'doc_titula',
    titular_dni: 'doc_titula',
    cod_par: 'cod_par',
    codigo_parentesco: 'cod_par',
    parentesco_codigo: 'cod_par',
    ape_nom: 'ape_nom',
    apellido_nombre: 'ape_nom',
    nombre: 'nombre',
    apellido: 'apellido',
    sexo: 'sexo',
    documento: 'documento',
    dni: 'documento',
    fecha_nac: 'fecha_nac',
    fecha_nacimiento: 'fecha_nac',
    fecha_ing: 'fecha_ing',
    fecha_ingreso: 'fecha_ing',
    fecha_eg: 'fecha_eg',
    fecha_egreso: 'fecha_eg',
    motivo_eg: 'motivo_eg',
    motivo_egreso: 'motivo_eg',
    c: 'c',
    es_colateral: 'c',
    activo: 'activo',
  };

  private normalizarHeader(h: string): string {
    const key = h
      .trim()
      .toLowerCase()
      .replace(/\./g, '')
      .replace(/\s+/g, '_');
    return (ColateralesImportService.HEADER_ALIASES[key] as string) || key;
  }

  private normalizarFila(row: ColateralCsvRow): ColateralCsvRow {
    // Separar ape_nom en apellido y nombre si viene junto
    if (row.ape_nom && (!row.nombre || !row.apellido)) {
      const raw = row.ape_nom.trim();
      if (raw.includes(',')) {
        const [a, n] = raw.split(',').map((x) => x.trim());
        row.apellido = row.apellido || a;
        row.nombre = row.nombre || n;
      } else {
        const parts = raw.split(/\s+/g);
        if (parts.length > 1) {
          row.apellido = row.apellido || parts.slice(0, -1).join(' ');
          row.nombre = row.nombre || parts[parts.length - 1];
        } else {
          row.nombre = row.nombre || raw;
        }
      }
    }
    row.documento = row.documento?.trim();
    row.doc_titula = row.doc_titula?.trim();
    row.cod_par = row.cod_par?.trim();
    return row;
  }

  private async parseRows(
    fileBuffer: Buffer,
    fileName?: string,
    mimeType?: string,
  ): Promise<ColateralCsvRow[]> {
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
    const parsed = Papa.parse<ColateralCsvRow>(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => this.normalizarHeader(h),
    });

    if (parsed.errors.length > 0) {
      throw new Error(`Error al parsear CSV: ${parsed.errors[0].message}`);
    }

    return parsed.data;
  }

  private async parseXlsxRows(fileBuffer: Buffer): Promise<ColateralCsvRow[]> {
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

    const rows: ColateralCsvRow[] = [];
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
      rows.push(obj as unknown as ColateralCsvRow);
    }
    return rows;
  }

  private cellToString(value: ExcelJS.CellValue): string {
    if (value == null) return '';
    if (value instanceof Date) {
      // Formato DD/MM/YYYY para Excel
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

  private parseDateFlexible(value?: string | null): Date | null {
    if (!value) return null;
    const v = String(value).trim();
    if (!v) return null;
    // Formato DD/MM/YYYY
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) {
      const [d, m, y] = v.split('/').map((x) => Number(x));
      const dt = new Date(y, m - 1, d);
      return isNaN(dt.getTime()) ? null : dt;
    }
    // Formato ISO YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      const dt = new Date(v);
      return isNaN(dt.getTime()) ? null : dt;
    }
    // Intentar parsear como fecha
    const dt = new Date(v);
    return isNaN(dt.getTime()) ? null : dt;
  }

  private parseBoolean(value?: string | null): boolean | null {
    if (!value) return null;
    const v = String(value).trim();
    if (['1', 'true', 'si', 'sí', 's', 'activo', 'activa'].includes(v.toLowerCase())) return true;
    if (['0', 'false', 'no', 'n', 'baja', 'inactivo', 'inactiva'].includes(v.toLowerCase()))
      return false;
    return null;
  }

  private parseIntStrict(value?: string | null): number | null {
    if (!value) return null;
    const v = String(value).trim().replace(/\D+/g, '');
    if (!v) return null;
    const n = Number(v);
    return isNaN(n) ? null : n;
  }

  private validarFila(
    row: ColateralCsvRow,
    options: ImportOptionsDto,
    fila: number,
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // DNI del titular obligatorio
    if (!row.doc_titula || row.doc_titula.trim() === '') {
      issues.push({
        fila,
        campo: 'doc_titula',
        tipo: 'ERROR',
        mensaje: 'DNI del titular es obligatorio',
      });
    }

    // Código de parentesco obligatorio
    if (!row.cod_par || row.cod_par.trim() === '') {
      issues.push({
        fila,
        campo: 'cod_par',
        tipo: 'ERROR',
        mensaje: 'Código de parentesco es obligatorio',
      });
    }

    // Nombre obligatorio
    const nombreCompleto = row.ape_nom || row.nombre || (row.apellido && row.nombre);
    if (!nombreCompleto || nombreCompleto.trim() === '') {
      issues.push({
        fila,
        campo: 'nombre',
        tipo: 'ERROR',
        mensaje: 'Nombre del familiar es obligatorio',
      });
    }

    // Validar formato de fecha de nacimiento
    if (row.fecha_nac) {
      const fecha = this.parseDateFlexible(row.fecha_nac);
      if (!fecha) {
        issues.push({
          fila,
          campo: 'fecha_nac',
          tipo: 'WARNING',
          mensaje: 'Fecha de nacimiento con formato inválido (usar DD/MM/YYYY)',
          continuar: true,
        });
      } else if (fecha > new Date()) {
        issues.push({
          fila,
          campo: 'fecha_nac',
          tipo: 'WARNING',
          mensaje: 'Fecha de nacimiento no puede ser futura',
          continuar: true,
        });
      }
    }

    // Validar formato de fecha de ingreso
    if (row.fecha_ing) {
      const fecha = this.parseDateFlexible(row.fecha_ing);
      if (!fecha) {
        issues.push({
          fila,
          campo: 'fecha_ing',
          tipo: 'WARNING',
          mensaje: 'Fecha de ingreso con formato inválido (usar DD/MM/YYYY)',
          continuar: true,
        });
      }
    }

    // Validar formato de fecha de egreso
    if (row.fecha_eg) {
      const fecha = this.parseDateFlexible(row.fecha_eg);
      if (!fecha) {
        issues.push({
          fila,
          campo: 'fecha_eg',
          tipo: 'WARNING',
          mensaje: 'Fecha de egreso con formato inválido (usar DD/MM/YYYY)',
          continuar: true,
        });
      }
    }

    return issues;
  }

  private getModoFila(row: ColateralCsvRow, options: ImportOptionsDto): ImportMode {
    return options.mode || ImportMode.UPSERT;
  }

  private detectarCambios(
    existente: any,
    row: ColateralCsvRow,
    options: ImportOptionsDto,
  ): Record<string, CambioDetectado> | null {
    const cambios: Record<string, CambioDetectado> = {};
    // Implementar lógica de detección de cambios si es necesario
    return Object.keys(cambios).length > 0 ? cambios : null;
  }

  /**
   * Genera CSV de plantilla vacía
   */
  private getHeaders(): string[] {
    return [
      'DOC_TITULA',
      'COD_PAR',
      'APE_NOM',
      'SEXO',
      'DOCUMENTO',
      'FECHA_NAC',
      'FECHA_ING',
      'FECHA_EG',
      'MOTIVO_EG',
      'C',
    ];
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
      '1586771,2,DEL ZOTTO ADRIANO,M,54823,19/06/1935,26/07/2024,,,1',
      '4875901,1,ESPINOSA ISMAEL,M,93988882,15/08/1938,,,,' +
        '1',
      '4875901,2,DOMINGUEZ LORENZO,M,68386,30/09/2022,,30/09/2022,Fallecimiento,0',
    ];
    return rows.join('\n');
  }

  /**
   * Genera plantilla XLSX
   */
  async generarPlantillaXlsx(): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Familiares');
    ws.addRow(this.getHeaders());
    ws.getRow(1).font = { bold: true };
    ws.columns.forEach((c) => {
      c.width = 18;
    });
    const out = await wb.xlsx.writeBuffer();
    return Buffer.isBuffer(out) ? out : Buffer.from(out as ArrayBuffer);
  }

  /**
   * Genera ejemplo XLSX
   */
  async generarEjemploXlsx(): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Familiares');
    const rows = [
      this.getHeaders(),
      ['1586771', '2', 'DEL ZOTTO ADRIANO', 'M', '54823', '19/06/1935', '26/07/2024', '', '', '1'],
      ['4875901', '1', 'ESPINOSA ISMAEL', 'M', '93988882', '15/08/1938', '', '', '', '1'],
      [
        '4875901',
        '2',
        'DOMINGUEZ LORENZO',
        'M',
        '68386',
        '30/09/2022',
        '',
        '30/09/2022',
        'Fallecimiento',
        '0',
      ],
    ];
    rows.forEach((r) => ws.addRow(r));
    ws.getRow(1).font = { bold: true };
    ws.columns.forEach((c) => {
      c.width = 18;
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

    // Obtener afiliados existentes por DNI del titular
    const dnisTitulares = rows
      .map((r) => r.doc_titula)
      .filter((d): d is string => !!d && d.trim() !== '')
      .map((d) => BigInt(d.trim()));
    const afiliados = await this.prisma.afiliado.findMany({
      where: {
        organizacionId,
        dni: { in: dnisTitulares },
      },
      select: {
        id: true,
        dni: true,
        apellido: true,
        nombre: true,
      },
    });
    const afiliadosMap = new Map(afiliados.map((a) => [a.dni.toString(), a]));

    // Obtener parentescos por código
    const codigosParentesco = rows
      .map((r) => r.cod_par)
      .filter((c): c is string => !!c && c.trim() !== '')
      .map((c) => parseInt(c.trim(), 10))
      .filter((n) => !isNaN(n));
    const parentescos = await this.prisma.parentesco.findMany({
      where: {
        organizacionId,
        codigo: { in: codigosParentesco },
        activo: true,
      },
      select: {
        id: true,
        codigo: true,
        descripcion: true,
      },
    });
    const parentescosMap = new Map(parentescos.map((p) => [p.codigo, p]));

    // Obtener colaterales existentes por (afiliadoId, dni)
    // Nota: si dni es null, solo podemos buscar por afiliadoId + nombre (aproximado)
    const afiliadosIds = new Set(afiliados.map((a) => a.id));
    const colateralesExistentes = await this.prisma.colateral.findMany({
      where: {
        afiliadoId: { in: Array.from(afiliadosIds) },
      },
      select: {
        id: true,
        afiliadoId: true,
        dni: true,
        nombre: true,
        parentescoId: true,
        activo: true,
        esColateral: true,
        fechaNacimiento: true,
      },
    });
    const colateralesMap = new Map<string, typeof colateralesExistentes[0]>();
    for (const col of colateralesExistentes) {
      // Clave: afiliadoId_dni (si dni es null, usar nombre como fallback)
      const dniKey = col.dni || '';
      const key = `${col.afiliadoId.toString()}_${dniKey}`;
      colateralesMap.set(key, col);
    }

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

      // Validar que el afiliado existe
      const dniTitular = row.doc_titula?.trim();
      if (!dniTitular) {
        operaciones.push({
          fila,
          operacion: 'ERROR',
          dniTitular: '',
          status: 'ERROR',
          mensaje: 'DNI del titular es obligatorio',
        });
        erroresCount++;
        continue;
      }

      const afiliado = afiliadosMap.get(dniTitular);
      if (!afiliado) {
        operaciones.push({
          fila,
          operacion: 'ERROR',
          dniTitular,
          status: 'ERROR',
          mensaje: `Afiliado con DNI ${dniTitular} no encontrado`,
        });
        erroresCount++;
        continue;
      }

      // Validar que el parentesco existe
      const codigoParentesco = row.cod_par ? parseInt(row.cod_par.trim(), 10) : null;
      if (!codigoParentesco || isNaN(codigoParentesco)) {
        operaciones.push({
          fila,
          operacion: 'ERROR',
          dniTitular,
          status: 'ERROR',
          mensaje: 'Código de parentesco inválido',
        });
        erroresCount++;
        continue;
      }

      const parentesco = parentescosMap.get(codigoParentesco);
      if (!parentesco) {
        operaciones.push({
          fila,
          operacion: 'ERROR',
          dniTitular,
          status: 'ERROR',
          mensaje: `Parentesco con código ${codigoParentesco} no encontrado`,
        });
        erroresCount++;
        continue;
      }

      if (errores.length > 0) {
        operaciones.push({
          fila,
          operacion: 'ERROR',
          dniTitular,
          nombreFamiliar: row.ape_nom || row.nombre,
          status: 'ERROR',
          mensaje: errores.map((e) => e.mensaje).join('; '),
        });
        erroresCount++;
        continue;
      }

      // Determinar si existe colateral
      const dniFamiliar = row.documento?.trim() || '';
      const keyColateral = `${afiliado.id.toString()}_${dniFamiliar}`;
      const existeColateral = colateralesMap.get(keyColateral);

      const modoFila = this.getModoFila(row, options);
      const nombreFamiliar = row.ape_nom || row.nombre || `${row.apellido || ''} ${row.nombre || ''}`.trim();

      if (existeColateral) {
        if (modoFila === ImportMode.CREATE_ONLY) {
          operaciones.push({
            fila,
            operacion: 'ERROR',
            dniTitular,
            nombreFamiliar,
            status: 'ERROR',
            mensaje: 'Familiar ya existe y modo es CREATE_ONLY',
          });
          erroresCount++;
          continue;
        }

        // ACTUALIZAR
        operaciones.push({
          fila,
          operacion: 'ACTUALIZAR',
          dniTitular,
          nombreFamiliar,
          status: warnings.length > 0 ? 'WARNING' : 'OK',
          mensaje: warnings.length > 0 ? warnings.map((w) => w.mensaje).join('; ') : undefined,
          continuar: true,
        });
        aActualizar++;
        if (warnings.length > 0) warningsCount++;
      } else {
        if (modoFila === ImportMode.UPDATE_ONLY) {
          operaciones.push({
            fila,
            operacion: 'ERROR',
            dniTitular,
            nombreFamiliar,
            status: 'ERROR',
            mensaje: 'Familiar no existe y modo es UPDATE_ONLY',
          });
          erroresCount++;
          continue;
        }

        // CREAR
        operaciones.push({
          fila,
          operacion: 'CREAR',
          dniTitular,
          nombreFamiliar,
          status: warnings.length > 0 ? 'WARNING' : 'OK',
          mensaje: warnings.length > 0 ? warnings.map((w) => w.mensaje).join('; ') : undefined,
          continuar: true,
        });
        aCrear++;
        if (warnings.length > 0) warningsCount++;
      }
    }

    // Permitir confirmar si hay al menos un registro válido para procesar
    // Los errores no bloquean la importación, solo se omiten esos registros
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
      puedeConfirmar: aCrear > 0 || aActualizar > 0,
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

    // Obtener datos necesarios
    const dnisTitulares = rows
      .map((r) => r.doc_titula)
      .filter((d): d is string => !!d && d.trim() !== '')
      .map((d) => BigInt(d.trim()));
    const afiliados = await this.prisma.afiliado.findMany({
      where: {
        organizacionId,
        dni: { in: dnisTitulares },
      },
      select: {
        id: true,
        dni: true,
      },
    });
    const afiliadosMap = new Map(afiliados.map((a) => [a.dni.toString(), a]));

    const codigosParentesco = rows
      .map((r) => r.cod_par)
      .filter((c): c is string => !!c && c.trim() !== '')
      .map((c) => parseInt(c.trim(), 10))
      .filter((n) => !isNaN(n));
    const parentescos = await this.prisma.parentesco.findMany({
      where: {
        organizacionId,
        codigo: { in: codigosParentesco },
        activo: true,
      },
      select: {
        id: true,
        codigo: true,
      },
    });
    const parentescosMap = new Map(parentescos.map((p) => [p.codigo, p]));

    let creados = 0;
    let actualizados = 0;
    const errores: Array<{ fila: number; mensaje: string }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const fila = i + 2;

      try {
        const dniTitular = row.doc_titula?.trim();
        if (!dniTitular) {
          errores.push({ fila, mensaje: 'DNI del titular es obligatorio' });
          continue;
        }

        const afiliado = afiliadosMap.get(dniTitular);
        if (!afiliado) {
          errores.push({ fila, mensaje: `Afiliado con DNI ${dniTitular} no encontrado` });
          continue;
        }

        const codigoParentesco = row.cod_par ? parseInt(row.cod_par.trim(), 10) : null;
        if (!codigoParentesco || isNaN(codigoParentesco)) {
          errores.push({ fila, mensaje: 'Código de parentesco inválido' });
          continue;
        }

        const parentesco = parentescosMap.get(codigoParentesco);
        if (!parentesco) {
          errores.push({ fila, mensaje: `Parentesco con código ${codigoParentesco} no encontrado` });
          continue;
        }

        const nombreFamiliar = row.ape_nom || row.nombre || `${row.apellido || ''} ${row.nombre || ''}`.trim();
        if (!nombreFamiliar) {
          errores.push({ fila, mensaje: 'Nombre del familiar es obligatorio' });
          continue;
        }

        const dniFamiliar = row.documento?.trim() || null;
        const fechaNacimiento = this.parseDateFlexible(row.fecha_nac);
        const esColateral = this.parseBoolean(row.c) ?? true; // Default true si no se especifica

        // Determinar activo: si tiene fecha_eg, está inactivo; si tiene fecha_ing o no tiene ninguna, está activo
        let activo = true;
        if (row.fecha_eg) {
          activo = false;
        } else if (row.fecha_ing) {
          activo = true;
        } else {
          activo = this.parseBoolean(row.activo) ?? true;
        }

        // Buscar colateral existente
        // Si tiene DNI, buscar por DNI; si no, buscar por nombre (aproximado)
        let existeColateral: { id: bigint } | null = null;
        if (dniFamiliar && dniFamiliar.trim() !== '') {
          existeColateral = await this.prisma.colateral.findFirst({
            where: {
              afiliadoId: afiliado.id,
              dni: dniFamiliar,
            },
            select: { id: true },
          });
        } else {
          // Si no tiene DNI, buscar por nombre exacto
          existeColateral = await this.prisma.colateral.findFirst({
            where: {
              afiliadoId: afiliado.id,
              nombre: nombreFamiliar,
              dni: null,
            },
            select: { id: true },
          });
        }

        const modoFila = this.getModoFila(row, options);

        if (existeColateral) {
          if (modoFila === ImportMode.CREATE_ONLY) {
            errores.push({ fila, mensaje: 'Familiar ya existe y modo es CREATE_ONLY' });
            continue;
          }

          // ACTUALIZAR
          await this.colateralesService.updateColateral(
            organizacionId,
            afiliado.id,
            existeColateral.id,
            {
              parentescoId: parentesco.id,
              nombre: nombreFamiliar,
              dni: dniFamiliar || undefined,
              fechaNacimiento: fechaNacimiento ? fechaNacimiento.toISOString().slice(0, 10) : undefined,
              activo,
              esColateral,
            },
          );
          actualizados++;
        } else {
          if (modoFila === ImportMode.UPDATE_ONLY) {
            errores.push({ fila, mensaje: 'Familiar no existe y modo es UPDATE_ONLY' });
            continue;
          }

          // CREAR
          await this.colateralesService.createColateral(organizacionId, afiliado.id, {
            parentescoId: parentesco.id,
            nombre: nombreFamiliar,
            dni: dniFamiliar || '',
            fechaNacimiento: fechaNacimiento ? fechaNacimiento.toISOString().slice(0, 10) : null,
            activo,
            esColateral,
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

    // La importación es exitosa si se procesó al menos un registro correctamente
    // Los errores se reportan pero no bloquean la importación de los válidos
    return {
      exitoso: creados > 0 || actualizados > 0,
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
