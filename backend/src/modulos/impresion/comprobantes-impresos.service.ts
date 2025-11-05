// src/modulos/impresion/comprobantes-impresos.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ImpresionService, ImprimirComprobanteDto } from './impresion.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

@Injectable()
export class ComprobantesImpresosService {
  constructor(private impresion: ImpresionService) {}

  async resolveOrgFor(comprobanteId: string): Promise<string | null> {
    const r = await prisma.comprobante.findUnique({
      where: { id: comprobanteId },
      select: { organizacionId: true },
    });
    return r?.organizacionId ?? null;
  }

  private async savePdf(buffer: Buffer, filename: string) {
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    const dir = path.join(process.cwd(), 'storage', 'comprobantes');
    await fs.mkdir(dir, { recursive: true });
    const full = path.join(dir, filename);
    await fs.writeFile(full, buffer);
    return { storageKey: `file://${full}`, hash, fullPath: full };
  }

  private pathFromStorageKey(storageKey: string) {
    if (storageKey.startsWith('file://')) return storageKey.replace(/^file:\/\//, '');
    return storageKey;
  }

  private buildFallbackFilename(comp: {
    tipo: string;
    numeroCompleto: string | null;
    fechaEmision: Date;
  }) {
    const safe = (s: string) =>
      s
        .replace(/[^\w-]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
    const num = comp.numeroCompleto ? `-${safe(comp.numeroCompleto)}` : '';
    const fecha = new Date(comp.fechaEmision).toLocaleDateString('es-AR');
    return `${safe(comp.tipo)}${num}-${safe(fecha)}.pdf`.toUpperCase();
  }

  async getPdf(organizacionId: string, id: string) {
    const comp = await prisma.comprobante.findFirst({
      where: { id, organizacionId },
      select: {
        id: true,
        organizacionId: true,
        tipo: true,
        ptoVta: true,
        serie: true,
        numero: true,
        numeroCompleto: true,
        titulo: true,
        fechaEmision: true,
        terceroNombre: true,
        terceroCuit: true,
        subtotal: true,
        descuentos: true,
        percepciones: true,
        impuestos: true,
        total: true,
        notas: true,
        formato: true,
        copias: true,
        templateArchivo: true,
        templateCss: true,
        templateVersion: true,
        pdfStorageKey: true,
        pdfHash: true,
        payload: true,
        estado: true,
      },
    });

    if (!comp) throw new Error('Comprobante inexistente');

    // 1) Si hay archivo persistido, intentar leer
    if (comp.pdfStorageKey) {
      try {
        const fullPath = this.pathFromStorageKey(comp.pdfStorageKey);
        const buffer = await fs.readFile(fullPath);
        const filename = this.buildFallbackFilename(comp);
        return { buffer, filename };
      } catch {
        // seguir a re-render
      }
    }

    // 2) Re-render desde snapshot o fallback mínimo
    const snapshot = (comp.payload ?? null) as Partial<ImprimirComprobanteDto> | null;

    const dto: ImprimirComprobanteDto = snapshot
      ? {
          tipo: (snapshot.tipo ?? comp.tipo) as ImprimirComprobanteDto['tipo'],
          formato:
            snapshot.formato ??
            (comp.formato as unknown as ImprimirComprobanteDto['formato']) ??
            'A4',
          copias: snapshot.copias ?? comp.copias ?? 1,
          titulo: snapshot.titulo ?? comp.titulo ?? null,
          numero: snapshot.numero ?? comp.numeroCompleto ?? null,
          fecha: snapshot.fecha ?? comp.fechaEmision.toISOString(),
          tercero:
            snapshot.tercero ??
            (comp.terceroNombre || comp.terceroCuit
              ? { nombre: comp.terceroNombre ?? '', cuit: comp.terceroCuit ?? null }
              : null),
          items: snapshot.items ?? [],
          subtotal: snapshot.subtotal ?? (comp.subtotal ? Number(comp.subtotal) : 0),
          descuentos: snapshot.descuentos ?? (comp.descuentos ? Number(comp.descuentos) : 0),
          percepciones:
            snapshot.percepciones ?? (comp.percepciones ? Number(comp.percepciones) : 0),
          impuestos: snapshot.impuestos ?? (comp.impuestos ? Number(comp.impuestos) : 0),
          total: snapshot.total ?? Number(comp.total ?? 0),
          notas: snapshot.notas ?? comp.notas ?? null,
          logoBase64: snapshot.logoBase64 ?? null,
        }
      : {
          tipo: comp.tipo as ImprimirComprobanteDto['tipo'],
          formato: (comp.formato as unknown as ImprimirComprobanteDto['formato']) ?? 'A4',
          copias: comp.copias ?? 1,
          titulo: comp.titulo ?? null,
          numero: comp.numeroCompleto ?? null,
          fecha: comp.fechaEmision.toISOString(),
          tercero:
            comp.terceroNombre || comp.terceroCuit
              ? { nombre: comp.terceroNombre ?? '', cuit: comp.terceroCuit ?? null }
              : null,
          items: [],
          subtotal: comp.subtotal ? Number(comp.subtotal) : 0,
          descuentos: comp.descuentos ? Number(comp.descuentos) : 0,
          percepciones: comp.percepciones ? Number(comp.percepciones) : 0,
          impuestos: comp.impuestos ? Number(comp.impuestos) : 0,
          total: Number(comp.total ?? 0),
          notas: comp.notas ?? null,
        };

    const { buffer, filename } = await this.impresion.render(comp.organizacionId, dto);
    const saved = await this.savePdf(buffer as unknown as Buffer, filename);

    await prisma.comprobante.update({
      where: { id: comp.id },
      data: { pdfStorageKey: saved.storageKey, pdfHash: saved.hash },
    });

    return { buffer, filename };
  }
}
