// src/modulos/comercios/comercios.import.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { PrismaService } from 'src/common/prisma.service';

type ImportOpts = { dryRun?: boolean };
type Row = Record<string, string | undefined>;

@Injectable()
export class ComerciosImportService {
  constructor(private readonly prisma: PrismaService) {}

  // Mapa de columnas de la base vieja -> modelo actual
  private colMap = {
    CODIGO: 'codigo',
    RAZON_SOC: 'razonSocial',
    DOMICILIO: 'domicilio',
    LOCALIDAD: 'localidad',
    INGRESO: 'fechaIngreso',
    TELEFONO1: 'telefono1',
    TELEFONO2: 'telefono2',
    EMAIL: 'email',
    GRUPO: 'grupo',
    DEPARTAMEN: 'departamento',
    RUBRO: 'rubro',
    TIPO: 'tipo',
    CUOMAX: 'cuoMax',
    P_IVA: 'pIVA',
    P_GANANCIA: 'pGanancia',
    P_INGBRUTO: 'pIngresosBrutos',
    P_LOTEHOGA: 'pLoteHogar',
    P_RETENCIO: 'pRetencion',
    CUIT: 'cuit',
    INGBRUTOS: 'iibb',
    USOCONTABL: 'usoContable',
    BAJA: 'baja',
    CONFIRMA: 'confirma',
    I_CONFIRMA: 'confirma',
    SALDO_ACT: 'saldoActual',
  } as const;

  private normHeader(h: string) {
    return h
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toUpperCase()
      .replace(/\s+/g, '')
      .replace(/[^\w]/g, '');
  }

  private parseDate(d?: string) {
    if (!d) return undefined;
    const s = d.trim();
    const m1 = s.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/); // dd/mm/yyyy o dd-mm-yyyy
    if (m1) return new Date(Number(m1[3]), Number(m1[2]) - 1, Number(m1[1]));
    const m2 = s.match(/^(\d{4})[/-](\d{2})[/-](\d{2})$/); // yyyy-mm-dd
    if (m2) return new Date(Number(m2[1]), Number(m2[2]) - 1, Number(m2[3]));
    const t = Date.parse(s);
    return Number.isFinite(t) ? new Date(t) : undefined;
  }

  private parseBool(v?: string) {
    if (v == null) return undefined;
    const s = v.toString().trim().toLowerCase();
    if (['1', 'true', 't', 'si', 'sí', 'y', 'yes'].includes(s)) return true;
    if (['0', 'false', 'f', 'no', 'n'].includes(s)) return false;
    return undefined;
  }
  private parseIntOrUndef(v?: string) {
    if (!v?.trim()) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : undefined;
  }
  private parseDecOrUndef(v?: string) {
    if (!v?.trim()) return undefined;
    const s = v.replace(',', '.');
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
  }

  /**
   * Repara líneas donde hay comillas dentro de campos NO entrecomillados.
   * Ej: CIRC.HELADERA 6)"G"  ->  "CIRC.HELADERA 6)""G"""
   * Respeta campos ya entrecomillados y sus comas internas.
   */
  private repairCsv(buf: Buffer): string {
    // decodificar manejando BOM
    let text = buf.toString('utf8');
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

    const lines = text.split(/\r?\n/);
    if (lines.length === 0) return text;

    const repaired: string[] = [];
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      if (!line) {
        repaired.push(line);
        continue;
      }

      // split por comas respetando comillas (dobles comillas escapadas)
      const fields: string[] = [];
      let cur = '';
      let inQ = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          // manejar escape ""
          if (inQ && line[i + 1] === '"') {
            cur += '""';
            i++; // consumir el segundo
          } else {
            inQ = !inQ;
            cur += '"';
          }
        } else if (ch === ',' && !inQ) {
          fields.push(cur);
          cur = '';
        } else {
          cur += ch;
        }
      }
      fields.push(cur);

      // reparar: si el campo NO está entrecomillado pero tiene " adentro → envolver y duplicar comillas
      for (let fi = 0; fi < fields.length; fi++) {
        let f = fields[fi];
        const trimmed = f.trim();
        const isQuoted = trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"');

        if (!isQuoted && f.includes('"')) {
          const inner = f.replace(/"/g, '""'); // duplicar comillas
          f = `"${inner}"`;
          fields[fi] = f;
        }
      }

      repaired.push(fields.join(','));
    }

    return repaired.join('\n');
  }

  async importCsv(organizacionId: string, buf: Buffer, opts: ImportOpts) {
    if (!buf?.length) throw new BadRequestException('Falta archivo CSV.');

    // Reparamos comillas internas “sucias” y luego parseamos normalmente.
    const fixed = this.repairCsv(buf);

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const rows = parse(fixed, {
      bom: true,
      delimiter: ',',
      record_delimiter: ['\r\n', '\n'],
      columns: (hdrs: string[]) => hdrs.map((h) => this.normHeader(h)),
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
      relax_column_count: true,
      quote: '"',
      escape: '"',
    }) as Row[];

    // helper para limpiar comillas basura al comienzo/fin
    const sanitizeStr = (v?: string) =>
      v
        ? v
            .replace(/^\s*"+/, '')
            .replace(/"+\s*$/, '')
            .trim()
        : undefined;

    let insertados = 0;
    let actualizados = 0;
    let saltados = 0;
    const errores: Array<{ row: number; msg: string }> = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      try {
        const dst: Record<string, unknown> = { organizacionId };

        for (const [normKey, value] of Object.entries(r)) {
          const field = (this.colMap as any)[normKey];
          if (!field) continue;

          const val = typeof value === 'string' ? sanitizeStr(value) : value;

          switch (field) {
            case 'codigo':
              dst.codigo = String(val ?? '').trim();
              break;

            // strings opcionales → undefined si están vacías (no null)
            case 'razonSocial':
            case 'domicilio':
            case 'localidad':
            case 'telefono1':
            case 'telefono2':
            case 'email':
            case 'cuit':
            case 'iibb':
              {
                const s = (val ?? '').toString().trim();
                dst[field] = s.length ? s : undefined;
              }
              break;

            case 'fechaIngreso':
              dst.fechaIngreso = this.parseDate(val as string) ?? undefined;
              break;

            case 'grupo':
            case 'departamento':
            case 'rubro':
            case 'tipo':
            case 'cuoMax':
              dst[field] = this.parseIntOrUndef(val as string);
              break;

            case 'pIVA':
            case 'pGanancia':
            case 'pIngresosBrutos':
            case 'pLoteHogar':
            case 'pRetencion':
            case 'saldoActual':
              dst[field] = this.parseDecOrUndef(val as string);
              break;

            case 'usoContable':
            case 'baja':
            case 'confirma':
              dst[field] = this.parseBool(val as string);
              break;
          }
        }

        if (!dst['codigo']) {
          saltados++;
          continue;
        }

        // Valor obligatorio para create
        const razonObligatoria = (dst.razonSocial as string | undefined) || (dst.codigo as string);

        if (opts.dryRun) {
          const exists = await this.prisma.comercio.findFirst({
            where: { organizacionId, codigo: dst['codigo'] as string },
            select: { id: true },
          });
          if (exists) actualizados++;
          else insertados++;
          continue;
        }

        // Construyo update sólo con propiedades definidas; importante: razonSocial no puede ser null en update
        const updateData: any = {
          updatedAt: new Date(),
        };
        if (dst.razonSocial !== undefined) updateData.razonSocial = dst.razonSocial as string;
        if (dst.domicilio !== undefined) updateData.domicilio = (dst.domicilio as string) ?? null;
        if (dst.localidad !== undefined) updateData.localidad = (dst.localidad as string) ?? null;
        if (dst.telefono1 !== undefined) updateData.telefono1 = (dst.telefono1 as string) ?? null;
        if (dst.telefono2 !== undefined) updateData.telefono2 = (dst.telefono2 as string) ?? null;
        if (dst.email !== undefined) updateData.email = (dst.email as string) ?? null;
        if (dst.grupo !== undefined) updateData.grupo = (dst.grupo as number) ?? null;
        if (dst.departamento !== undefined)
          updateData.departamento = (dst.departamento as number) ?? null;
        if (dst.rubro !== undefined) updateData.rubro = (dst.rubro as number) ?? null;
        if (dst.tipo !== undefined) updateData.tipo = (dst.tipo as number) ?? null;
        if (dst.cuoMax !== undefined) updateData.cuoMax = (dst.cuoMax as number) ?? null;
        if (dst.pIVA !== undefined) updateData.pIVA = (dst.pIVA as number) ?? null;
        if (dst.pGanancia !== undefined) updateData.pGanancia = (dst.pGanancia as number) ?? null;
        if (dst.pIngresosBrutos !== undefined)
          updateData.pIngresosBrutos = (dst.pIngresosBrutos as number) ?? null;
        if (dst.pLoteHogar !== undefined)
          updateData.pLoteHogar = (dst.pLoteHogar as number) ?? null;
        if (dst.pRetencion !== undefined)
          updateData.pRetencion = (dst.pRetencion as number) ?? null;
        if (dst.cuit !== undefined) updateData.cuit = (dst.cuit as string) ?? null;
        if (dst.iibb !== undefined) updateData.iibb = (dst.iibb as string) ?? null;
        if (dst.usoContable !== undefined)
          updateData.usoContable = (dst.usoContable as boolean) ?? null;
        if (dst.baja !== undefined) updateData.baja = (dst.baja as boolean) ?? null;
        if (dst.confirma !== undefined) updateData.confirma = (dst.confirma as boolean) ?? null;
        if (dst.fechaIngreso !== undefined)
          updateData.fechaIngreso = (dst.fechaIngreso as Date) ?? null;
        if (dst.saldoActual !== undefined)
          updateData.saldoActual = (dst.saldoActual as number) ?? null;

        await this.prisma.comercio.upsert({
          where: {
            organizacionId_codigo: {
              organizacionId,
              codigo: dst['codigo'] as string,
            },
          },
          update: updateData,
          create: {
            organizacionId,
            codigo: dst.codigo as string,
            // requerido
            razonSocial: razonObligatoria,
            // opcionales
            domicilio: (dst.domicilio as string | null | undefined) ?? null,
            localidad: (dst.localidad as string | null | undefined) ?? null,
            telefono1: (dst.telefono1 as string | null | undefined) ?? null,
            telefono2: (dst.telefono2 as string | null | undefined) ?? null,
            email: (dst.email as string | null | undefined) ?? null,
            grupo: (dst.grupo as number | null | undefined) ?? null,
            departamento: (dst.departamento as number | null | undefined) ?? null,
            rubro: (dst.rubro as number | null | undefined) ?? null,
            tipo: (dst.tipo as number | null | undefined) ?? null,
            cuoMax: (dst.cuoMax as number | null | undefined) ?? null,
            pIVA: (dst.pIVA as number | null | undefined) ?? null,
            pGanancia: (dst.pGanancia as number | null | undefined) ?? null,
            pIngresosBrutos: (dst.pIngresosBrutos as number | null | undefined) ?? null,
            pLoteHogar: (dst.pLoteHogar as number | null | undefined) ?? null,
            pRetencion: (dst.pRetencion as number | null | undefined) ?? null,
            cuit: (dst.cuit as string | null | undefined) ?? null,
            iibb: (dst.iibb as string | null | undefined) ?? null,
            usoContable: (dst.usoContable as boolean | null | undefined) ?? null,
            baja: (dst.baja as boolean | null | undefined) ?? null,
            confirma: (dst.confirma as boolean | null | undefined) ?? null,
            fechaIngreso: (dst.fechaIngreso as Date | null | undefined) ?? null,
            saldoActual: (dst.saldoActual as number | null | undefined) ?? null,
          },
          select: { id: true },
        });

        actualizados++;
      } catch (e: any) {
        errores.push({ row: i + 2, msg: e?.message ?? String(e) });
      }
    }

    return {
      dryRun: !!opts.dryRun,
      procesados: rows.length,
      insertados,
      actualizados,
      saltados,
      errores,
    };
  }
}
