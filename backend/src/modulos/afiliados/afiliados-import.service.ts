import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma.service';
import * as Papa from 'papaparse';
import { v4 as uuidv4 } from 'uuid';
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
} from '../dto/import-afiliados.dto';

@Injectable()
export class AfiliadosImportService {
  private previews = new Map<string, { rows: AfiliadoCsvRow[]; options: ImportOptionsDto }>();

  constructor(private prisma: PrismaService) {}

  /**
   * Genera CSV de plantilla vacía
   */
  generarPlantilla(): string {
    const headers = [
      'dni',
      'apellido',
      'nombre',
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
      '_modo',
    ];
    return headers.join(',');
  }

  /**
   * Genera CSV de ejemplo con datos ficticios
   */
  generarEjemplo(): string {
    const rows = [
      this.generarPlantilla(),
      '12345678,Pérez,Juan,20123456789,M,TITULAR,1980-05-15,3511234567,351155512345,juan@email.com,San Martín,123,2,A,,,,,,,SOC001,50000.00,Cliente VIP,upsert',
      '87654321,González,María,27876543210,F,FAMILIAR,1990-08-20,,3517654321,,Av. Colón,456,,,,,,,Alberdi,Córdoba,SOC002,30000.00,,create_only',
      '11223344,Rodríguez,Carlos,20112233449,M,JUBILADO,1955-03-10,3514567890,,,Belgrano,789,1,B,,,,,,,JUB001,20000.00,Jubilado activo,',
    ];
    return rows.join('\n');
  }

  /**
   * Preview de importación
   */
  async preview(
    organizacionId: string,
    fileBuffer: Buffer,
    options: ImportOptionsDto,
  ): Promise<ImportPreviewResponse> {
    const previewId = uuidv4();

    // Parsear CSV
    const csvText = fileBuffer.toString('utf-8');
    const parsed = Papa.parse<AfiliadoCsvRow>(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
    });

    if (parsed.errors.length > 0) {
      throw new Error(`Error al parsear CSV: ${parsed.errors[0].message}`);
    }

    const rows = parsed.data;

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

    // Volver a validar y ejecutar en transacción
    const resultado = await this.prisma.$transaction(async (tx) => {
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
              errores.push({ fila, mensaje: 'Ya existe (CREATE_ONLY)' });
              continue;
            }

            // Merge según estrategia
            const datosActualizados = this.aplicarMerge(existe, datos, options);

            await tx.afiliado.update({
              where: { id: existe.id },
              data: datosActualizados,
            });
            actualizados++;
          } else {
            if (modoFila === ImportMode.UPDATE_ONLY) {
              errores.push({ fila, mensaje: 'No existe (UPDATE_ONLY)' });
              continue;
            }

            await tx.afiliado.create({
              data: {
                organizacionId,
                ...datos,
              },
            });
            creados++;
          }
        } catch (error) {
          errores.push({ fila, mensaje: error.message });
        }
      }

      return { creados, actualizados, errores };
    });

    // Limpiar preview
    this.previews.delete(previewId);

    return {
      exitoso: resultado.errores.length === 0,
      resumen: {
        total: rows.length,
        creados: resultado.creados,
        actualizados: resultado.actualizados,
        errores: resultado.errores.length,
      },
      errores: resultado.errores.length > 0 ? resultado.errores : undefined,
    };
  }

  /**
   * Validar fila
   */
  private validarFila(row: AfiliadoCsvRow, options: ImportOptionsDto, fila: number): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Obligatorios
    if (!row.dni || row.dni.trim() === '') {
      issues.push({ fila, campo: 'dni', tipo: 'ERROR', mensaje: 'DNI es obligatorio' });
    } else if (!/^\d{7,8}$/.test(row.dni)) {
      issues.push({ fila, campo: 'dni', tipo: 'ERROR', mensaje: 'DNI debe tener 7-8 dígitos numéricos' });
    }

    if (!row.apellido || row.apellido.trim() === '') {
      issues.push({ fila, campo: 'apellido', tipo: 'ERROR', mensaje: 'Apellido es obligatorio' });
    }

    if (!row.nombre || row.nombre.trim() === '') {
      issues.push({ fila, campo: 'nombre', tipo: 'ERROR', mensaje: 'Nombre es obligatorio' });
    }

    // CUIT opcional pero validar si está
    if (row.cuit && row.cuit.trim() !== '') {
      if (!/^\d{11}$/.test(row.cuit.replace(/[-]/g, ''))) {
        issues.push({ fila, campo: 'cuit', tipo: 'ERROR', mensaje: 'CUIT debe tener 11 dígitos' });
      } else if (options.validateCuit && row.dni) {
        const cuitSinGuiones = row.cuit.replace(/[-]/g, '');
        const dniEnCuit = cuitSinGuiones.substring(2, 10);
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

    // Tipo
    if (row.tipo && !['TITULAR', 'FAMILIAR', 'JUBILADO', 'OTRO'].includes(row.tipo.toUpperCase())) {
      issues.push({
        fila,
        campo: 'tipo',
        tipo: 'ERROR',
        mensaje: 'Tipo debe ser TITULAR, FAMILIAR, JUBILADO u OTRO',
      });
    }

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
        issues.push({ fila, campo: 'fechaNacimiento', tipo: 'ERROR', mensaje: 'Fecha de nacimiento no puede ser futura' });
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
      const cupo = parseFloat(row.cupo);
      if (isNaN(cupo)) {
        issues.push({ fila, campo: 'cupo', tipo: 'ERROR', mensaje: 'Cupo debe ser numérico' });
      } else if (cupo > 1000000) {
        issues.push({ fila, campo: 'cupo', tipo: 'WARNING', mensaje: 'Cupo mayor a $1.000.000', continuar: true });
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
      const fechaExistente = existente.fechaNacimiento ? new Date(existente.fechaNacimiento) : null;
      if (!fechaExistente || fechaNueva.getTime() !== fechaExistente.getTime()) {
        cambios.fechaNacimiento = { anterior: fechaExistente, nuevo: fechaNueva };
      }
    }

    if (nuevo.cupo && nuevo.cupo.trim() !== '') {
      const cupoNuevo = parseFloat(nuevo.cupo);
      const cupoExistente = parseFloat(existente.cupo?.toString() || '0');
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
    return {
      dni: BigInt(row.dni),
      apellido: row.apellido,
      nombre: row.nombre,
      cuit: row.cuit && row.cuit.trim() !== '' ? row.cuit : null,
      sexo: row.sexo && row.sexo.trim() !== '' ? row.sexo.toUpperCase() : null,
      tipo: row.tipo && row.tipo.trim() !== '' ? row.tipo.toUpperCase() : null,
      fechaNacimiento: row.fechaNacimiento && row.fechaNacimiento.trim() !== '' ? new Date(row.fechaNacimiento) : null,
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
      cupo: row.cupo && row.cupo.trim() !== '' ? parseFloat(row.cupo) : 0,
      observaciones: row.observaciones && row.observaciones.trim() !== '' ? row.observaciones : null,
    };
  }

  /**
   * Aplicar estrategia de merge
   */
  private aplicarMerge(existente: any, nuevos: any, options: ImportOptionsDto): any {
    const resultado = { ...nuevos };

    if (options.mergeStrategy === MergeStrategy.KEEP_NEW_IF_PRESENT) {
      // Solo actualizar campos no vacíos
      for (const key of Object.keys(nuevos)) {
        if (nuevos[key] === null || nuevos[key] === undefined || nuevos[key] === '') {
          resultado[key] = existente[key];
        }
      }
    } else if (options.mergeStrategy === MergeStrategy.KEEP_EXISTING) {
      // Mantener valores existentes en conflicto
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
