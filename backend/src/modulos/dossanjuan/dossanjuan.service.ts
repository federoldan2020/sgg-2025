import { Injectable, Logger } from '@nestjs/common';
import { DossanjuanAuthService } from './dossanjuan-auth.service';
import {
  CODIGO_SIN_COSEGURO,
  CODIGO_UDAP,
  getDossanjuanConfig,
} from './dossanjuan.config';

/**
 * Cliente SOAP del WS de coseguros UDAP en dossanjuan.online.
 *
 * Reglas de uso (NO violar):
 *   - Solo se opera con dos códigos: '02' (UDAP) y '' (sin coseguro).
 *   - NUNCA exponer una función que reciba `codigo` como parámetro
 *     arbitrario — el WS también acepta '01' (UPCN) y otros, pero por
 *     política UDAP-only deben quedar fuera del scope de este módulo.
 *
 * Si el WS contesta `text/html` en vez de XML, la sesión expiró →
 * `SesionExpiradaError`. El llamador (sync service) debe invalidar las
 * cookies y reintentar una vez.
 */

export class SesionExpiradaError extends Error {
  constructor(msg = 'Sesión dossanjuan expirada (respuesta HTML)') {
    super(msg);
    this.name = 'SesionExpiradaError';
  }
}

export type Persona = {
  dniConsultado: string;
  /** Código de coseguro PROPIO de la persona consultada (no del titular). */
  codigoPropio: string;
  coseguroPropio: string;
  /** Familiares según el WS. Estos solo indican pertenencia al grupo. */
  grupo: Array<{
    dni: string;
    apellido: string;
    nombre: string;
  }>;
};

@Injectable()
export class DossanjuanService {
  private readonly logger = new Logger(DossanjuanService.name);
  public readonly CODIGO_UDAP = CODIGO_UDAP;
  public readonly CODIGO_SIN_COSEGURO = CODIGO_SIN_COSEGURO;

  constructor(private readonly auth: DossanjuanAuthService) {}

  /** Consulta de estado de un DNI (idempotencia + verificación). */
  async buscarPersona(dni: string | number | bigint): Promise<Persona> {
    const dniStr = String(dni);
    const xml = await this.soapCall('BuscarAfiliados', { DNI: dniStr });
    return parsePersona(xml, dniStr);
  }

  /** Da alta UDAP en el WS (código '02'). */
  async darAltaUdap(dni: string | number | bigint): Promise<string> {
    const xml = await this.soapCall('CambiarCoseguro', {
      DNI: String(dni),
      coseguro: CODIGO_UDAP,
    });
    return extractTag(xml, 'CambiarCoseguroResult');
  }

  /** Da de baja en el WS (código ''). */
  async darBaja(dni: string | number | bigint): Promise<string> {
    const xml = await this.soapCall('CambiarCoseguro', {
      DNI: String(dni),
      coseguro: CODIGO_SIN_COSEGURO,
    });
    return extractTag(xml, 'CambiarCoseguroResult');
  }

  // ===========================================================================
  // SOAP plumbing
  // ===========================================================================

  /**
   * Auto re-login una vez si la sesión expiró. Más de una vez no — si pasa
   * dos veces seguidas hay un problema real (credenciales mal, etc.).
   */
  private async soapCall(
    method: string,
    params: Record<string, string>,
  ): Promise<string> {
    let cookies = await this.auth.getCookies();
    try {
      return await this.soapCallOnce(cookies, method, params);
    } catch (e) {
      if (!(e instanceof SesionExpiradaError)) throw e;
      this.logger.warn(`Sesión expirada en ${method} — re-logueando`);
      this.auth.invalidateCookies();
      cookies = await this.auth.getCookies();
      return this.soapCallOnce(cookies, method, params);
    }
  }

  private async soapCallOnce(
    cookies: Record<string, string>,
    method: string,
    params: Record<string, string>,
  ): Promise<string> {
    const cfg = getDossanjuanConfig();
    const body =
      `<?xml version="1.0" encoding="utf-8"?>\n` +
      `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">\n` +
      `  <soap:Body><${method} xmlns="http://tempuri.org/">\n` +
      Object.entries(params)
        .map(([k, v]) => `    <${k}>${escapeXml(v)}</${k}>`)
        .join('\n') +
      `\n  </${method}></soap:Body>\n` +
      `</soap:Envelope>`;

    const resp = await fetch(cfg.baseUrl, {
      method: 'POST',
      signal: AbortSignal.timeout(cfg.timeout),
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: `"http://tempuri.org/${method}"`,
        Cookie: this.auth.cookieHeader(cookies),
      },
      body,
    });

    const ct = resp.headers.get('content-type') || '';
    const text = await resp.text();
    if (ct.includes('text/html')) throw new SesionExpiradaError();
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status} en ${method}: ${text.slice(0, 200)}`);
    }
    return text;
  }
}

// =============================================================================
// Parsers
// =============================================================================

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function extractTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = xml.match(re);
  return (m?.[1] ?? '').trim();
}

function extractAllTags(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  const out: string[] = [];
  for (const m of xml.matchAll(re)) out.push(m[1].trim());
  return out;
}

/**
 * Parser de `BuscarAfiliados`. La respuesta trae filas <Afiliados> y filas
 * <Familiares>. Para el coseguro propio del DNI consultado nos quedamos con
 * la fila de <Afiliados> cuyo `dni` matchea — los <Familiares> solo dicen
 * "pertenece al grupo de X", NO el coseguro real de ellos.
 */
function parsePersona(xml: string, dniConsultado: string): Persona {
  const afiliados = extractAllTags(xml, 'Afiliados');
  let codigoPropio = '';
  let coseguroPropio = '';

  for (const fila of afiliados) {
    const dni = extractTag(fila, 'dni') || extractTag(fila, 'DNI');
    if (!dni) continue;
    if (String(dni).trim() === dniConsultado.trim()) {
      codigoPropio = extractTag(fila, 'coseguro') || extractTag(fila, 'Coseguro') || '';
      coseguroPropio = codigoPropio;
      break;
    }
  }

  const familiares = extractAllTags(xml, 'Familiares');
  const grupo = familiares.map((fila) => ({
    dni: (extractTag(fila, 'dni') || extractTag(fila, 'DNI') || '').trim(),
    apellido: (extractTag(fila, 'apellido') || '').trim(),
    nombre: (extractTag(fila, 'nombre') || '').trim(),
  }));

  return {
    dniConsultado,
    codigoPropio: codigoPropio.trim(),
    coseguroPropio: coseguroPropio.trim(),
    grupo,
  };
}
