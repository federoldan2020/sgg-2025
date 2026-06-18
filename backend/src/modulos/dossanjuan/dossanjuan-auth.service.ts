import { Injectable, Logger } from '@nestjs/common';
import { getDossanjuanConfig } from './dossanjuan.config';

type CookieJar = Record<string, string>;

/**
 * Autenticación contra Login.Aspx (WebForms con __VIEWSTATE) + caché en
 * memoria de las cookies de sesión.
 *
 * Cookie principal: `.ASPROLESCOSEGURO` (HttpOnly, Secure). Sin esa cookie
 * el WS responde HTML (sesión expirada).
 *
 * - `getCookies()` devuelve cookies vigentes; si la caché está vacía,
 *   loguea y guarda. Si hay un login en curso, todos los callers esperan
 *   la misma promesa (no se disparan N logins concurrentes).
 * - `invalidateCookies()` se llama desde el servicio cuando el WS contesta
 *   HTML — fuerza un re-login en el próximo `getCookies()`.
 */
@Injectable()
export class DossanjuanAuthService {
  private readonly logger = new Logger(DossanjuanAuthService.name);
  private cookiesCache: CookieJar | null = null;
  private loginPromise: Promise<CookieJar> | null = null;

  async getCookies(): Promise<CookieJar> {
    if (this.cookiesCache) return this.cookiesCache;
    if (this.loginPromise) return this.loginPromise;
    this.loginPromise = this.doLogin()
      .then((c) => {
        this.cookiesCache = c;
        return c;
      })
      .finally(() => {
        this.loginPromise = null;
      });
    return this.loginPromise;
  }

  invalidateCookies(): void {
    this.cookiesCache = null;
  }

  cookieHeader(cookies: CookieJar): string {
    return Object.entries(cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  private async doLogin(): Promise<CookieJar> {
    const cfg = getDossanjuanConfig();
    if (!cfg.usuario || !cfg.password) {
      throw new Error(
        'dossanjuan: credenciales no configuradas (DOSSANJUAN_USER / DOSSANJUAN_PASS)',
      );
    }

    const url = `${cfg.loginUrl}?ReturnUrl=${encodeURIComponent(cfg.returnUrl)}`;

    // 1) GET del formulario de login para sacar __VIEWSTATE etc.
    const getResp = await fetch(url, { signal: AbortSignal.timeout(cfg.timeout) });
    const html = await getResp.text();
    const cookiesIniciales = parseSetCookie(getRawSetCookies(getResp));

    const form = new URLSearchParams({
      __VIEWSTATE: hiddenValue(html, '__VIEWSTATE'),
      __VIEWSTATEGENERATOR: hiddenValue(html, '__VIEWSTATEGENERATOR'),
      __EVENTVALIDATION: hiddenValue(html, '__EVENTVALIDATION'),
      'Login1$UserName': cfg.usuario,
      'Login1$Password': cfg.password,
      'Login1$LoginButton': 'Inicio de sesión',
    });

    // 2) POST del login con las cookies iniciales
    const postResp = await fetch(url, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: this.cookieHeader(cookiesIniciales),
      },
      body: form.toString(),
      signal: AbortSignal.timeout(cfg.timeout),
    });

    const cookiesFinales: CookieJar = {
      ...cookiesIniciales,
      ...parseSetCookie(getRawSetCookies(postResp)),
    };

    if (!cookiesFinales['.ASPROLESCOSEGURO']) {
      this.logger.error(
        `Login dossanjuan falló — status=${postResp.status} cookies=${Object.keys(cookiesFinales).join(',') || '(vacío)'}`,
      );
      throw new Error('Login dossanjuan falló (sin cookie .ASPROLESCOSEGURO)');
    }

    this.logger.log('Login dossanjuan OK');
    return cookiesFinales;
  }
}

// ============================================================================
// Helpers de parseo
// ============================================================================

function hiddenValue(html: string, name: string): string {
  const re = new RegExp(
    `<input[^>]*name="${escapeRegex(name)}"[^>]*value="([^"]*)"`,
    'i',
  );
  const m = html.match(re);
  return m?.[1] ?? '';
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Saca el array de `Set-Cookie` de la respuesta. Node 18+ expone
 * `headers.getSetCookie()` para múltiples valores. Si no existe, hacemos
 * fallback al header singular (puede colapsar).
 */
function getRawSetCookies(resp: Response): string[] {
  const anyHeaders = resp.headers as unknown as {
    getSetCookie?: () => string[];
  };
  if (typeof anyHeaders.getSetCookie === 'function') {
    return anyHeaders.getSetCookie();
  }
  const single = resp.headers.get('set-cookie');
  return single ? [single] : [];
}

function parseSetCookie(rawList: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of rawList) {
    const head = raw.split(';')[0]?.trim();
    if (!head) continue;
    const eq = head.indexOf('=');
    if (eq < 0) continue;
    const name = head.slice(0, eq).trim();
    const value = head.slice(eq + 1).trim();
    if (name) out[name] = value;
  }
  return out;
}
