import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import * as Papa from 'papaparse';
import * as ExcelJS from 'exceljs';
import { randomUUID } from 'crypto';
import {
  ImportMode,
  MergeStrategy,
  ImportOptionsDto,
  AfiliadoCsvRow,
  ValidationIssue,
  OperacionPreview,
  ImportPreviewResponse,
  ImportResultResponse,
  CambioDetectado,
} from './dto/import-afiliados.dto';

@Injectable()
export class AfiliadosImportService {
  private previews = new Map<string, { rows: AfiliadoCsvRow[]; options: ImportOptionsDto }>();

  constructor(private prisma: PrismaService) {}

  private static HEADER_ALIASES: Record<string, keyof AfiliadoCsvRow> = {
    // Afiliado
    documento: 'dni',
    dni: 'dni',
    ape_nom: 'apellidoNombre',
    apellidonombre: 'apellidoNombre',
    apellido: 'apellido',
    nombre: 'nombre',
    cuit: 'cuit',
    sexo: 'sexo',
    tipo: 'tipo',
    fecha_nac: 'fechaNacimiento',
    fechanac: 'fechaNacimiento',
    fecha_nacimiento: 'fechaNacimiento',
    telefono1: 'telefono',
    telefono: 'telefono',
    telefono2: 'celular',
    celular: 'celular',
    email: 'email',
    calle: 'calle',
    numero: 'numero',
    orientacion: 'orientacion',
    barrio: 'barrio',
    piso: 'piso',
    depto: 'depto',
    monoblock: 'monoblock',
    casa: 'casa',
    manzana: 'manzana',
    localidad: 'localidad',
    socio: 'numeroSocio',
    numero_socio: 'numeroSocio',
    nrosocio: 'numeroSocio',
    cupo_afiliado: 'cupo',
    observaciones: 'observaciones',
    obs: 'observaciones',
    // Padron
    padron: 'padron',
    sistema: 'sistema',
    centro: 'centro',
    sector: 'sector',
    clase: 'clase',
    situacion: 'situacion',
    fecha_ing: 'fechaAlta',
    fecha_alta: 'fechaAlta',
    fecha_eg: 'fechaBaja',
    fecha_baja: 'fechaBaja',
    activo: 'activo',
    motivo_eg: 'motivoBaja',
    motivo_baja: 'motivoBaja',
    caja_ahorro: 'cajaAhorro',
    beneficiario: 'beneficiarioJubilado',
    beneficiario_jubilado: 'beneficiarioJubilado',
    basico: 'sueldoBasico',
    sueldo_basico: 'sueldoBasico',
    padron_cupo: 'padronCupo',
    cupo: 'padronCupo',
    padron_saldo: 'padronSaldo',
    saldo: 'padronSaldo',
    j17: 'j17',
    j22: 'j22',
    j38: 'j38',
    j38a: 'j38a',
    j38b: 'j38b',
    j38c: 'j38c',
    k16: 'k16',
  };

  private normalizarHeader(h: string): string {
    const key = h
      .trim()
      .toLowerCase()
      .replace(/\./g, '')
      .replace(/\s+/g, '_');
    return (AfiliadosImportService.HEADER_ALIASES[key] as string) || key;
  }

  private normalizarFila(row: AfiliadoCsvRow): AfiliadoCsvRow {
    const apellido = row.apellido?.trim();
    const nombre = row.nombre?.trim();
    if ((!apellido || !nombre) && row.apellidoNombre) {
      const raw = row.apellidoNombre.trim();
      if (raw.includes(',')) {
        const [a, n] = raw.split(',').map((x) => x.trim());
        row.apellido = apellido || a;
        row.nombre = nombre || n;
      } else {
        const parts = raw.split(/\s+/g);
        if (parts.length > 1) {
          row.apellido = apellido || parts.slice(0, -1).join(' ');
          row.nombre = nombre || parts[parts.length - 1];
        } else {
          row.apellido = apellido || raw;
          row.nombre = nombre || raw;
        }
      }
    }
    row.dni = row.dni?.trim();
    row.padron = row.padron?.trim();
    return row;
  }

  private async parseRows(
    fileBuffer: Buffer,
    fileName?: string,
    mimeType?: string,
  ): Promise<AfiliadoCsvRow[]> {
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
    const parsed = Papa.parse<AfiliadoCsvRow>(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => this.normalizarHeader(h),
    });

    if (parsed.errors.length > 0) {
      throw new Error(`Error al parsear CSV: ${parsed.errors[0].message}`);
    }

    return parsed.data;
  }

  private async parseXlsxRows(fileBuffer: Buffer): Promise<AfiliadoCsvRow[]> {
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

    const rows: AfiliadoCsvRow[] = [];
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
      rows.push(obj as unknown as AfiliadoCsvRow);
    }
    return rows;
  }

  private cellToString(value: ExcelJS.CellValue): string {
    if (value == null) return '';
    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
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

  private parseDecimal(value?: string | null): number | null {
    if (!value) return null;
    const v = String(value).trim();
    if (!v) return null;
    if (v.includes(',')) {
      const normalized = v.replace(/\./g, '').replace(',', '.');
      const n = Number(normalized);
      return isNaN(n) ? null : n;
    }
    const n = Number(v);
    return isNaN(n) ? null : n;
  }

  private parseIntStrict(value?: string | null): number | null {
    if (!value) return null;
    const v = String(value).trim().replace(/\D+/g, '');
    if (!v) return null;
    const n = Number(v);
    return isNaN(n) ? null : n;
  }

  private parseDateFlexible(value?: string | null): Date | null {
    if (!value) return null;
    const v = String(value).trim();
    if (!v) return null;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) {
      const [d, m, y] = v.split('/').map((x) => Number(x));
      const dt = new Date(y, m - 1, d);
      return isNaN(dt.getTime()) ? null : dt;
    }
    const dt = new Date(v);
    return isNaN(dt.getTime()) ? null : dt;
  }

  private normalizarSistema(value?: string | null): 'ESC' | 'SG' | 'SGR' | 'JUV' | null {
    if (!value) return null;
    const v = String(value).trim().toUpperCase();
    if (v === 'ES' || v === 'ESC') return 'ESC';
    if (v === 'SG' || v === 'SGR') return v as 'SG' | 'SGR';
    if (v === 'JUV') return 'JUV';
    return null;
  }

  private normalizarTipo(value?: string | null): 'TITULAR' | 'FAMILIAR' | 'JUBILADO' | 'OTRO' | null {
    if (!value) return null;
    const v = String(value).trim().toUpperCase();
    if (!v) return null;
    if (['T', 'TIT', 'TITULAR', 'TITULAR/A'].includes(v)) return 'TITULAR';
    if (['F', 'FAM', 'FAMILIAR'].includes(v)) return 'FAMILIAR';
    if (['J', 'JUB', 'JUBILADO'].includes(v)) return 'JUBILADO';
    if (['O', 'OTR', 'OTRO'].includes(v)) return 'OTRO';
    if (/^\d+$/.test(v)) {
      if (v === '1') return 'TITULAR';
      if (v === '2') return 'FAMILIAR';
      if (v === '3') return 'JUBILADO';
      if (v === '4') return 'OTRO';
    }
    return null;
  }

  private normalizeCuit(value?: string | null): string | null {
    if (!value) return null;
    const raw = String(value).replace(/[-]/g, '').trim();
    if (!/^\d{11}$/.test(raw)) return null;
    return raw;
  }

  private async resolveCuitConflict(
    tx: any,
    organizacionId: string,
    cuit: string | null,
    afiliadoId?: bigint,
  ): Promise<string | null> {
    if (!cuit) return null;
    const exists = await tx.afiliado.findFirst({
      where: { organizacionId, cuit },
      select: { id: true },
    });
    if (exists && (!afiliadoId || exists.id.toString() !== afiliadoId.toString())) {
      return null;
    }
    return cuit;
  }

  private parseActivo(value?: string | null, situacion?: string | null): boolean | null {
    if (value && value.trim() !== '') {
      const v = value.trim().toLowerCase();
      if (['1', 'true', 'si', 'sí', 's', 'activo', 'activa'].includes(v)) return true;
      if (['0', 'false', 'no', 'n', 'baja', 'inactivo', 'inactiva'].includes(v)) return false;
    }
    if (situacion) {
      const s = situacion.toLowerCase();
      if (s.includes('baja') || s.includes('inact')) return false;
    }
    return null;
  }

  private mapearPadron(row: AfiliadoCsvRow) {
    if (!row.padron || row.padron.trim() === '') return null;
    const j38List = [row.j38a, row.j38b, row.j38c]
      .map((x) => this.parseDecimal(x))
      .filter((x): x is number => x != null);
    const j38 =
      row.j38 && row.j38.trim() !== ''
        ? this.parseDecimal(row.j38)
        : j38List.length > 0
        ? j38List.reduce((a, b) => a + b, 0)
        : null;
    const activo = this.parseActivo(row.activo, row.situacion);
    return {
      padron: row.padron.trim(),
      sistema: this.normalizarSistema(row.sistema),
      centro: this.parseIntStrict(row.centro),
      sector: this.parseIntStrict(row.sector),
      clase: row.clase?.trim() || null,
      situacion: row.situacion?.trim() || null,
      fechaAlta: this.parseDateFlexible(row.fechaAlta),
      fechaBaja: this.parseDateFlexible(row.fechaBaja),
      activo: activo ?? true,
      motivoBaja: row.motivoBaja?.trim() || null,
      cajaAhorro: row.cajaAhorro?.trim() || null,
      beneficiarioJubilado: row.beneficiarioJubilado?.trim() || null,
      sueldoBasico: this.parseDecimal(row.sueldoBasico),
      cupo: this.parseDecimal(row.padronCupo),
      saldo: this.parseDecimal(row.padronSaldo),
      j17: this.parseDecimal(row.j17),
      j22: this.parseDecimal(row.j22),
      j38,
      k16: this.parseDecimal(row.k16),
    };
  }

  private async upsertPadronFromRow(
    tx: any,
    organizacionId: string,
    afiliadoId: bigint,
    row: AfiliadoCsvRow,
    options: ImportOptionsDto,
  ) {
    const padronData = this.mapearPadron(row);
    if (!padronData) return;

    const existing = await tx.padron.findFirst({
      where: { organizacionId, padron: padronData.padron },
      select: { id: true, afiliadoId: true },
    });

    if (existing && existing.afiliadoId.toString() !== afiliadoId.toString()) {
      throw new Error(`Padrón ${padronData.padron} ya pertenece a otro afiliado`);
    }

    const dataToPersist: Record<string, any> = { ...padronData };
    const nonNullableNumeric = [
      'sueldoBasico',
      'cupo',
      'saldo',
      'j17',
      'j22',
      'j38',
      'k16',
    ];
    for (const key of nonNullableNumeric) {
      if (dataToPersist[key] == null) delete dataToPersist[key];
    }
    if (options.skipEmptyFields) {
      for (const [k, v] of Object.entries(dataToPersist)) {
        if (v === null || v === undefined || v === '') delete dataToPersist[k];
      }
    }

    if (existing) {
      await tx.padron.update({
        where: { id: existing.id },
        data: dataToPersist,
      });
    } else {
      await tx.padron.create({
        data: {
          ...dataToPersist,
          organizacion: { connect: { id: organizacionId } },
          afiliado: { connect: { id: afiliadoId } },
        },
      });
    }
  }

  /**
   * Genera CSV de plantilla vacía
   */
  private getHeaders(): string[] {
    return [
      'dni',
      'apellido',
      'nombre',
      'apellidoNombre',
      'cuit',
      'sexo',
      'tipo',
      'fechaNacimiento',
      'telefono',
      'celular',
      'email',
      'calle',
      'numero',
      'piso',
      'depto',
      'orientacion',
      'barrio',
      'monoblock',
      'casa',
      'manzana',
      'localidad',
      'numeroSocio',
      'cupo',
      'observaciones',
      // Padron
      'padron',
      'sistema',
      'centro',
      'sector',
      'clase',
      'situacion',
      'fechaAlta',
      'fechaBaja',
      'activo',
      'motivoBaja',
      'cajaAhorro',
      'beneficiarioJubilado',
      'sueldoBasico',
      'padronCupo',
      'padronSaldo',
      'j17',
      'j22',
      'j38',
      'j38a',
      'j38b',
      'j38c',
      'k16',
      '_modo',
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
      '12345678,Pérez,Juan,,20123456789,M,TITULAR,1980-05-15,3511234567,351155512345,juan@email.com,San Martín,123,2,A,,,,,,,SOC001,50000.00,Cliente VIP,001-100,SG,60,6,002,ACTIVO,2020-01-01,,true,,12345-6,Juan Perez,750000,30000,0,1200,3500,0,,,450,upsert',
      '87654321,González,María,,27876543210,F,FAMILIAR,1990-08-20,,3517654321,,Av. Colón,456,,,,,,,Alberdi,Córdoba,SOC002,30000.00,,002-200,ESC,85,1,001,ACTIVO,2019-06-15,,true,,,María González,650000,15000,0,900,2500,0,,,0,create_only',
      '11223344,Rodríguez,Carlos,RODRIGUEZ CARLOS,20112233449,M,JUBILADO,1955-03-10,3514567890,,,Belgrano,789,1,B,,,,,,,JUB001,20000.00,Jubilado activo,003-300,ESC,13,2,004,BAJA,2010-03-10,2020-08-01,false,MOTIVO,778899,Domingo Rodriguez,0,0,0,0,0,0,,,0,',
    ];
    return rows.join('\n');
  }

  /**
   * Genera plantilla XLSX
   */
  async generarPlantillaXlsx(): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Afiliados');
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
    const ws = wb.addWorksheet('Afiliados');
    const rows = [
      this.getHeaders(),
      [
        '12345678',
        'Pérez',
        'Juan',
        '',
        '20123456789',
        'M',
        'TITULAR',
        '1980-05-15',
        '3511234567',
        '351155512345',
        'juan@email.com',
        'San Martín',
        '123',
        '2',
        'A',
        '',
        '',
        '',
        '',
        '',
        '',
        'SOC001',
        '50000.00',
        'Cliente VIP',
        '001-100',
        'SG',
        '60',
        '6',
        '002',
        'ACTIVO',
        '2020-01-01',
        '',
        'true',
        '',
        '12345-6',
        'Juan Perez',
        '750000',
        '30000',
        '0',
        '1200',
        '3500',
        '0',
        '',
        '',
        '450',
        'upsert',
      ],
      [
        '87654321',
        'González',
        'María',
        '',
        '27876543210',
        'F',
        'FAMILIAR',
        '1990-08-20',
        '',
        '3517654321',
        '',
        'Av. Colón',
        '456',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        'SOC002',
        '30000.00',
        '',
        '002-200',
        'ESC',
        '85',
        '1',
        '001',
        'ACTIVO',
        '2019-06-15',
        '',
        'true',
        '',
        '',
        'María González',
        '650000',
        '15000',
        '0',
        '900',
        '2500',
        '0',
        '',
        '',
        '0',
        'create_only',
      ],
      [
        '11223344',
        'Rodríguez',
        'Carlos',
        'RODRIGUEZ CARLOS',
        '20112233449',
        'M',
        'JUBILADO',
        '1955-03-10',
        '3514567890',
        '',
        '',
        'Belgrano',
        '789',
        '1',
        'B',
        '',
        '',
        '',
        '',
        '',
        '',
        'JUB001',
        '20000.00',
        'Jubilado activo',
        '003-300',
        'ESC',
        '13',
        '2',
        '004',
        'BAJA',
        '2010-03-10',
        '2020-08-01',
        'false',
        'MOTIVO',
        '778899',
        'Domingo Rodriguez',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '',
        '',
        '0',
        '',
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

    // Guardar para confirm posterior
    this.previews.set(previewId, { rows, options });

    // Obtener afiliados existentes por DNI
    const dnis = rows.map((r) => BigInt(r.dni)).filter((d) => !isNaN(Number(d)));
    const existentes = await this.prisma.afiliado.findMany({
      where: {
        organizacionId,
        dni: { in: dnis },
      },
      select: {
        id: true,
        dni: true,
        nombre: true,
        apellido: true,
        cuit: true,
        sexo: true,
        tipo: true,
        fechaNacimiento: true,
        telefono: true,
        celular: true,
        calle: true,
        numero: true,
        piso: true,
        depto: true,
        orientacion: true,
        barrio: true,
        monoblock: true,
        casa: true,
        manzana: true,
        localidad: true,
        numeroSocio: true,
        cupo: true,
        observaciones: true,
      },
    });

    const existentesMap = new Map(existentes.map((a) => [a.dni.toString(), a]));

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
          dni: row.dni,
          status: 'ERROR',
          mensaje: errores.map((e) => e.mensaje).join('; '),
        });
        erroresCount++;
        continue;
      }

      // Determinar operación
      const modoFila = this.getModoFila(row, options);
      const existe = existentesMap.get(row.dni);

      if (existe) {
        if (modoFila === ImportMode.CREATE_ONLY) {
          operaciones.push({
            fila,
            operacion: 'ERROR',
            dni: row.dni,
            padron: row.padron,
            status: 'ERROR',
            mensaje: 'Afiliado ya existe y modo es CREATE_ONLY',
          });
          erroresCount++;
          continue;
        }

        // ACTUALIZAR
        const cambios = this.detectarCambios(existe, row, options);
        operaciones.push({
          fila,
          operacion: 'ACTUALIZAR',
          dni: row.dni,
          padron: row.padron,
          nombre: `${row.nombre} ${row.apellido}`,
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
            dni: row.dni,
          padron: row.padron,
            status: 'ERROR',
            mensaje: 'Afiliado no existe y modo es UPDATE_ONLY',
          });
          erroresCount++;
          continue;
        }

        // CREAR
        operaciones.push({
          fila,
          operacion: 'CREAR',
          dni: row.dni,
          padron: row.padron,
          nombre: `${row.nombre} ${row.apellido}`,
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
    const cached = this.previews.get(previewId);
    if (!cached) {
      throw new Error('Preview no encontrado o expirado');
    }

    const { rows, options } = cached;

    // Procesar fila por fila para evitar abortar transacciones completas
    let creados = 0;
    let actualizados = 0;
    const errores: Array<{ fila: number; mensaje: string }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const fila = i + 2;

      try {
        // Validar nuevamente
        const issues = this.validarFila(row, options, fila);
        const erroresValidacion = issues.filter((iss) => iss.tipo === 'ERROR');
        if (erroresValidacion.length > 0) {
          errores.push({ fila, mensaje: erroresValidacion[0].mensaje });
          continue;
        }

        const warningsValidacion = issues.filter((iss) => iss.tipo === 'WARNING');
        if (!ignoreWarnings && warningsValidacion.length > 0) {
          errores.push({ fila, mensaje: `Warning: ${warningsValidacion[0].mensaje}` });
          continue;
        }

        await this.prisma.$transaction(
          async (tx) => {
            // Preparar datos
            const datos = this.mapearDatos(row);

            // Upsert
            const existe = await tx.afiliado.findFirst({
              where: {
                organizacionId,
                dni: BigInt(row.dni),
              },
            });

            const modoFila = this.getModoFila(row, options);

            if (existe) {
              if (modoFila === ImportMode.CREATE_ONLY) {
                throw new Error('Ya existe (CREATE_ONLY)');
              }

              // Merge según estrategia
              const datosActualizados = this.aplicarMerge(existe, datos, options);
              datosActualizados.cuit = await this.resolveCuitConflict(
                tx,
                organizacionId,
                datosActualizados.cuit ?? null,
                existe.id,
              );

              await tx.afiliado.update({
                where: { id: existe.id },
                data: datosActualizados,
              });
              actualizados++;

              // Upsert padrón si viene
              await this.upsertPadronFromRow(tx, organizacionId, existe.id, row, options);
            } else {
              if (modoFila === ImportMode.UPDATE_ONLY) {
                throw new Error('No existe (UPDATE_ONLY)');
              }

              const sanitizedCuit = await this.resolveCuitConflict(
                tx,
                organizacionId,
                datos.cuit ?? null,
              );
              const creado = await tx.afiliado.create({
                data: {
                  organizacionId,
                  ...datos,
                  cuit: sanitizedCuit,
                },
              });
              creados++;

              // Upsert padrón si viene
              await this.upsertPadronFromRow(tx, organizacionId, creado.id, row, options);
            }
          },
          { timeout: 10000, maxWait: 2000 },
        );
      } catch (error) {
        errores.push({ fila, mensaje: error.message });
      }
    }

    // Limpiar preview
    this.previews.delete(previewId);

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

  /**
   * Validar fila
   */
  private validarFila(
    row: AfiliadoCsvRow,
    options: ImportOptionsDto,
    fila: number,
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Obligatorios
    if (!row.dni || row.dni.trim() === '') {
      issues.push({ fila, campo: 'dni', tipo: 'ERROR', mensaje: 'DNI es obligatorio' });
    } else if (!/^\d{5,10}$/.test(row.dni)) {
      issues.push({
        fila,
        campo: 'dni',
        tipo: 'ERROR',
        mensaje: 'DNI debe tener 5-10 dígitos numéricos',
      });
    }

    if (!row.apellido || row.apellido.trim() === '') {
      issues.push({ fila, campo: 'apellido', tipo: 'ERROR', mensaje: 'Apellido es obligatorio' });
    }

    if (!row.nombre || row.nombre.trim() === '') {
      issues.push({ fila, campo: 'nombre', tipo: 'ERROR', mensaje: 'Nombre es obligatorio' });
    }

    // CUIT opcional: si no cumple, no bloquea (se ignora)
    if (row.cuit && row.cuit.trim() !== '') {
      const cuitNorm = this.normalizeCuit(row.cuit);
      if (!cuitNorm) {
        issues.push({
          fila,
          campo: 'cuit',
          tipo: 'WARNING',
          mensaje: 'CUIT inválido; se ignora y se carga vacío',
          continuar: true,
        });
      } else if (options.validateCuit && row.dni) {
        const dniEnCuit = cuitNorm.substring(2, 10);
        if (dniEnCuit !== row.dni.padStart(8, '0')) {
          issues.push({
            fila,
            campo: 'cuit',
            tipo: 'WARNING',
            mensaje: 'CUIT no coincide con DNI',
            continuar: true,
          });
        }
      }
    }

    // Sexo
    if (row.sexo && !['M', 'F', 'X'].includes(row.sexo.toUpperCase())) {
      issues.push({ fila, campo: 'sexo', tipo: 'ERROR', mensaje: 'Sexo debe ser M, F o X' });
    }

    // Tipo: sin validación (se definirá más adelante)

    // Fecha nacimiento
    if (row.fechaNacimiento && row.fechaNacimiento.trim() !== '') {
      const fecha = new Date(row.fechaNacimiento);
      if (isNaN(fecha.getTime())) {
        issues.push({
          fila,
          campo: 'fechaNacimiento',
          tipo: 'ERROR',
          mensaje: 'Fecha de nacimiento inválida (formato: YYYY-MM-DD)',
        });
      } else if (fecha > new Date()) {
        issues.push({
          fila,
          campo: 'fechaNacimiento',
          tipo: 'ERROR',
          mensaje: 'Fecha de nacimiento no puede ser futura',
        });
      } else {
        const edad = Math.floor((Date.now() - fecha.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
        if (edad < 18 && row.tipo === 'TITULAR') {
          issues.push({
            fila,
            campo: 'fechaNacimiento',
            tipo: 'WARNING',
            mensaje: 'Menor de 18 años con tipo TITULAR',
            continuar: true,
          });
        }
      }
    }

    // Cupo
    if (row.cupo && row.cupo.trim() !== '') {
      const cupo = this.parseDecimal(row.cupo);
      if (cupo == null) {
        issues.push({ fila, campo: 'cupo', tipo: 'ERROR', mensaje: 'Cupo debe ser numérico' });
      } else if (cupo > 1000000) {
        issues.push({
          fila,
          campo: 'cupo',
          tipo: 'WARNING',
          mensaje: 'Cupo mayor a $1.000.000',
          continuar: true,
        });
      }
    }

    // Padron (opcional)
    if (row.padron && row.padron.trim() !== '') {
      if (!row.padron.trim()) {
        issues.push({ fila, campo: 'padron', tipo: 'ERROR', mensaje: 'Padrón inválido' });
      }
      if (row.sistema && row.sistema.trim() !== '' && !this.normalizarSistema(row.sistema)) {
        issues.push({
          fila,
          campo: 'sistema',
          tipo: 'ERROR',
          mensaje: 'Sistema inválido (ESC | SG | SGR | JUV)',
        });
      }
      if (row.fechaAlta && !this.parseDateFlexible(row.fechaAlta)) {
        issues.push({
          fila,
          campo: 'fechaAlta',
          tipo: 'WARNING',
          mensaje: 'Fecha alta inválida (formato esperado YYYY-MM-DD o DD/MM/YYYY)',
          continuar: true,
        });
      }
      if (row.fechaBaja && !this.parseDateFlexible(row.fechaBaja)) {
        issues.push({
          fila,
          campo: 'fechaBaja',
          tipo: 'WARNING',
          mensaje: 'Fecha baja inválida (formato esperado YYYY-MM-DD o DD/MM/YYYY)',
          continuar: true,
        });
      }
      if (row.padronCupo && this.parseDecimal(row.padronCupo) == null) {
        issues.push({
          fila,
          campo: 'padronCupo',
          tipo: 'WARNING',
          mensaje: 'Cupo de padrón inválido',
          continuar: true,
        });
      }
      if (row.padronSaldo && this.parseDecimal(row.padronSaldo) == null) {
        issues.push({
          fila,
          campo: 'padronSaldo',
          tipo: 'WARNING',
          mensaje: 'Saldo de padrón inválido',
          continuar: true,
        });
      }
    }

    return issues;
  }

  /**
   * Detectar cambios entre existente y nuevo
   */
  private detectarCambios(
    existente: any,
    nuevo: AfiliadoCsvRow,
    options: ImportOptionsDto,
  ): Record<string, CambioDetectado> | null {
    const cambios: Record<string, CambioDetectado> = {};

    const campos = [
      'nombre',
      'apellido',
      'cuit',
      'sexo',
      'tipo',
      'telefono',
      'celular',
      'calle',
      'numero',
      'piso',
      'depto',
      'orientacion',
      'barrio',
      'monoblock',
      'casa',
      'manzana',
      'localidad',
      'numeroSocio',
      'observaciones',
    ];

    for (const campo of campos) {
      const valorNuevo = nuevo[campo as keyof AfiliadoCsvRow];
      const valorExistente = existente[campo];

      // Según estrategia de merge
      if (options.mergeStrategy === MergeStrategy.KEEP_NEW_IF_PRESENT) {
        if (valorNuevo && valorNuevo.trim() !== '' && valorNuevo !== valorExistente) {
          cambios[campo] = { anterior: valorExistente, nuevo: valorNuevo };
        }
      } else if (options.mergeStrategy === MergeStrategy.ALWAYS_KEEP_NEW) {
        if (valorNuevo !== valorExistente) {
          cambios[campo] = { anterior: valorExistente, nuevo: valorNuevo };
        }
      }
    }

    // Campos especiales
    if (nuevo.fechaNacimiento && nuevo.fechaNacimiento.trim() !== '') {
      const fechaNueva = new Date(nuevo.fechaNacimiento);
      const fechaExistente = existente.fechaNacimiento
        ? new Date(existente.fechaNacimiento as Date)
        : null;
      if (!fechaExistente || fechaNueva.getTime() !== fechaExistente.getTime()) {
        cambios.fechaNacimiento = { anterior: fechaExistente, nuevo: fechaNueva };
      }
    }

    if (nuevo.cupo && nuevo.cupo.trim() !== '') {
      const cupoNuevo = parseFloat(nuevo.cupo);
      const cupoExistente = parseFloat((existente.cupo?.toString() as string) || '0');
      if (cupoNuevo !== cupoExistente) {
        cambios.cupo = { anterior: cupoExistente, nuevo: cupoNuevo };
      }
    }

    return Object.keys(cambios).length > 0 ? cambios : null;
  }

  /**
   * Mapear datos de CSV a formato Prisma
   */
  private mapearDatos(row: AfiliadoCsvRow): any {
    const apellido = row.apellido?.trim() || '';
    const nombre = row.nombre?.trim() || '';
    return {
      dni: BigInt(row.dni),
      apellido,
      nombre,
      cuit: this.normalizeCuit(row.cuit),
      sexo: row.sexo && row.sexo.trim() !== '' ? row.sexo.toUpperCase() : null,
      tipo: this.normalizarTipo(row.tipo),
      fechaNacimiento:
        row.fechaNacimiento && row.fechaNacimiento.trim() !== ''
          ? this.parseDateFlexible(row.fechaNacimiento)
          : null,
      telefono: row.telefono && row.telefono.trim() !== '' ? row.telefono : null,
      celular: row.celular && row.celular.trim() !== '' ? row.celular : null,
      calle: row.calle && row.calle.trim() !== '' ? row.calle : null,
      numero: row.numero && row.numero.trim() !== '' ? row.numero : null,
      piso: row.piso && row.piso.trim() !== '' ? row.piso : null,
      depto: row.depto && row.depto.trim() !== '' ? row.depto : null,
      orientacion: row.orientacion && row.orientacion.trim() !== '' ? row.orientacion : null,
      barrio: row.barrio && row.barrio.trim() !== '' ? row.barrio : null,
      monoblock: row.monoblock && row.monoblock.trim() !== '' ? row.monoblock : null,
      casa: row.casa && row.casa.trim() !== '' ? row.casa : null,
      manzana: row.manzana && row.manzana.trim() !== '' ? row.manzana : null,
      localidad: row.localidad && row.localidad.trim() !== '' ? row.localidad : null,
      numeroSocio: row.numeroSocio && row.numeroSocio.trim() !== '' ? row.numeroSocio : null,
      cupo: row.cupo && row.cupo.trim() !== '' ? this.parseDecimal(row.cupo) ?? 0 : 0,
      observaciones:
        row.observaciones && row.observaciones.trim() !== '' ? row.observaciones : null,
    };
  }

  /**
   * Aplicar estrategia de merge
   */
  private aplicarMerge(existente: any, nuevos: any, options: ImportOptionsDto): any {
    const resultado = { ...nuevos };

    if (options.mergeStrategy === MergeStrategy.KEEP_NEW_IF_PRESENT) {
      // Solo actualizar campos no vacíos
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      for (const key of Object.keys(nuevos)) {
        if (nuevos[key] === null || nuevos[key] === undefined || nuevos[key] === '') {
          resultado[key] = existente[key];
        }
      }
    } else if (options.mergeStrategy === MergeStrategy.KEEP_EXISTING) {
      // Mantener valores existentes en conflicto
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      for (const key of Object.keys(existente)) {
        if (existente[key] !== null && existente[key] !== undefined && existente[key] !== '') {
          resultado[key] = existente[key];
        }
      }
    }
    // ALWAYS_KEEP_NEW no necesita lógica adicional

    return resultado;
  }

  /**
   * Obtener modo de importación para la fila
   */
  private getModoFila(row: AfiliadoCsvRow, options: ImportOptionsDto): ImportMode {
    if (row._modo && Object.values(ImportMode).includes(row._modo as ImportMode)) {
      return row._modo as ImportMode;
    }
    return options.mode || ImportMode.UPSERT;
  }
}
