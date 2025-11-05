// src/modulos/impresion/impresion.service.ts
import { Injectable } from '@nestjs/common';
import * as nunjucks from 'nunjucks';
import { chromium, type Browser } from 'playwright';

// Tipos de comprobantes que soportamos hoy
export type TipoImprimible = 'ORDEN_PAGO' | 'RECIBO_AFILIADO' | 'REINTEGRO_AFILIADO';

export type ImprimirComprobanteDto = {
  tipo: TipoImprimible;
  formato?: 'A4' | 'A5' | 'TICKET_80MM'; // override del tamaño
  copias?: number; // cantidad de copias (p.ej. 2 = Original/Duplicado)
  titulo?: string | null;
  numero?: string | null;
  fecha?: string; // ISO
  tercero?: { nombre: string; cuit?: string | null } | null;
  items?: Array<{ desc: string; cantidad?: number; pUnit?: number; importe?: number }>;
  subtotal?: number | null;
  descuentos?: number | null;
  percepciones?: number | null;
  impuestos?: number | null;
  total?: number | null; // si no viene, se calcula
  notas?: string | null;
  // Recursos opcionales
  logoBase64?: string | null; // "data:image/png;base64,...."
};

const fmtMoney = (n: number | null | undefined) =>
  Number(n ?? 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });

const fmtDate = (iso?: string) => {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleDateString('es-AR');
};

// Configurar Nunjucks para cargar templates desde /templates/impresion
const env = new nunjucks.Environment(
  new nunjucks.FileSystemLoader('src/modulos/impresion/templates', { noCache: true }),
  { autoescape: true },
);

// Helpers disponibles en las plantillas
env.addFilter('money', fmtMoney);
env.addFilter('dateAR', fmtDate);

@Injectable()
export class ImpresionService {
  private browserPromise: Promise<Browser> | null = null;

  private async getBrowser(): Promise<Browser> {
    if (!this.browserPromise) this.browserPromise = chromium.launch({ args: ['--no-sandbox'] });
    return this.browserPromise;
  }

  private calcTotal(dto: ImprimirComprobanteDto) {
    const base = (dto.items ?? []).reduce((a, it) => {
      const imp = it.importe ?? Number(it.cantidad ?? 1) * Number(it.pUnit ?? 0);
      return a + imp;
    }, 0);
    return (
      (dto.subtotal ?? base) -
      (dto.descuentos ?? 0) +
      (dto.percepciones ?? 0) +
      (dto.impuestos ?? 0)
    );
  }

  // Mapea tipo + formato a archivos de plantilla y css
  private resolveTemplate(dto: ImprimirComprobanteDto) {
    const formato = dto.formato ?? 'A4';
    const base = dto.tipo.toLowerCase(); // 'orden_pago' | 'recibo_afiliado' | 'reintegro_afiliado'
    const name = formato === 'TICKET_80MM' ? `${base}.ticket.njk` : `${base}.a4.njk`; // ejemplo de convención
    const css = formato === 'TICKET_80MM' ? `ticket-80mm.css` : `a4.css`;
    return { template: name, css };
  }

  async render(organizacionId: string, dtoIn: ImprimirComprobanteDto) {
    // Aquí podrías obtener logo/nombre org desde BD; uso defaults
    const ORG_FIJA = {
      nombre: 'UDAP - UNIÓN DOCENTES AGREMIADOS PROVINCIALES',
      domicilio: 'Salta Nte. 181, J5400 San Juan',
      cuit: 'CUIT: 30-56067945-5', // mostrable
    };

    // opcional: logo en base64 (data:image/png;base64,....)
    const org = {
      ...ORG_FIJA,
      logoBase64: dtoIn.logoBase64 ?? null,
    };

    const dto: ImprimirComprobanteDto = {
      ...dtoIn,
      fecha: dtoIn.fecha ?? new Date().toISOString(),
      copias: dtoIn.copias ?? (dtoIn.formato === 'TICKET_80MM' ? 1 : 2), // A4 => Original/Duplicado
    };
    const total = dto.total ?? this.calcTotal(dto);
    const { template, css } = this.resolveTemplate(dto);

    // Render HTML con Nunjucks
    const html = env.render(template, {
      org,
      dto: { ...dto, total, fmtMoney, fmtDate },
      ui: { titulo: dto.titulo ?? this.defaultTitle(dto.tipo) },
      cssFile: css,
      copies: Array.from({ length: dto.copias! }, (_, i) => (i === 0 ? 'ORIGINAL' : 'DUPLICADO')),
    });

    // Render PDF con Playwright
    const browser = await this.getBrowser();
    const page = await (await browser.newContext()).newPage();
    await page.setContent(html, { waitUntil: 'load' });
    await page.emulateMedia({ media: 'print' });

    // Tamaño: respetar @page de CSS
    const buffer = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true, // usa @page size de CSS
    });

    await page.context().close();

    const filename = this.filename(dto);
    return { buffer, filename };
  }

  private defaultTitle(tipo: ImprimirComprobanteDto['tipo']) {
    switch (tipo) {
      case 'ORDEN_PAGO':
        return 'ORDEN DE PAGO';
      case 'RECIBO_AFILIADO':
        return 'RECIBO';
      case 'REINTEGRO_AFILIADO':
        return 'REINTEGRO';
    }
  }

  private filename(dto: ImprimirComprobanteDto) {
    const safe = (s?: string | null) =>
      (s ?? '')
        .replace(/[^\w-]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
    const num = dto.numero ? `-${safe(dto.numero)}` : '';
    return `${safe(dto.tipo)}${num}-${safe(fmtDate(dto.fecha))}.pdf`.toUpperCase();
  }
}
