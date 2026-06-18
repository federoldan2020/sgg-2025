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
    const url0 = `${cfg.loginUrl}?ReturnUrl=${encodeURIComponent(cfg.returnUrl)}`;
    const jar: CookieJar = {};

    // 1) GET del formulario. El primer hit responde 302 con
    //    AspxAutoDetectCookieSupport=1 y redirige a la misma URL con la flag
    //    en query. Hay que seguir el redirect manualmente preservando la
    //    cookie, sino se pierde el viewstate de la página correcta.
    const html = await this.fetchWithFollow(url0, jar, 'GET', null, cfg.timeout);
    const vs = hiddenValue(html, '__VIEWSTATE');
    const vsg = hiddenValue(html, '__VIEWSTATEGENERATOR');
    const ev = hiddenValue(html, '__EVENTVALIDATION');
    if (!vs) {
      throw new Error('Login dossanjuan: no se encontró __VIEWSTATE en el form');
    }

    // 2) POST del login. La URL que el server espera tiene AspxAutoDetectCookieSupport=1.
    const postUrl = `${url0}&AspxAutoDetectCookieSupport=1`;
    const form = new URLSearchParams({
      __VIEWSTATE: vs,
      __VIEWSTATEGENERATOR: vsg,
      __EVENTVALIDATION: ev,
      'Login1$UserName': cfg.usuario,
      'Login1$Password': cfg.password,
      'Login1$LoginButton': 'Inicio de sesión',
    });
    const postResp = await fetch(postUrl, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: this.cookieHeader(jar),
      },
      body: form.toString(),
      signal: AbortSignal.timeout(cfg.timeout),
    });
    Object.assign(jar, parseSetCookie(getRawSetCookies(postResp)));
    const locPost = postResp.headers.get('location');

    if (postResp.status !== 302 || !locPost) {
      this.logger.error(
        `Login dossanjuan POST inesperado — status=${postResp.status} loc=${locPost}`,
      );
      throw new Error(`Login dossanjuan falló (POST status=${postResp.status})`);
    }

    // 3) Seguir el redirect del POST. ASP.NET setea `.ASPROLESCOSEGURO`
    //    recién en el primer hit a una página protegida después del login.
    await this.fetchWithFollow(
      this.absolutize(locPost),
      jar,
      'GET',
      null,
      cfg.timeout,
    );

    if (!jar['.ASPROLESCOSEGURO']) {
      this.logger.error(
        `Login dossanjuan falló — sin .ASPROLESCOSEGURO tras follow. Cookies=${Object.keys(jar).join(',') || '(vacío)'}`,
      );
      throw new Error('Login dossanjuan falló (sin cookie .ASPROLESCOSEGURO)');
    }

    this.logger.log('Login dossanjuan OK');
    return jar;
  }

  /**
   * GET (o POST si quisiera, pero acá solo GET) siguiendo redirects 301/302/303/307
   * manualmente y preservando cookies en el `jar` provisto.
   * Devuelve el body del último hop no-redirect.
   */
  private async fetchWithFollow(
    url: string,
    jar: CookieJar,
    method: 'GET' | 'POST',
    body: string | null,
    timeoutMs: number,
    maxHops = 6,
  ): Promise<string> {
    let cur = url;
    for (let i = 0; i < maxHops; i++) {
      const resp = await fetch(cur, {
        method,
        redirect: 'manual',
        headers: {
          ...(method === 'POST'
            ? { 'Content-Type': 'application/x-www-form-urlencoded' }
            : {}),
          Cookie: this.cookieHeader(jar),
        },
        body: body ?? undefined,
        signal: AbortSignal.timeout(timeoutMs),
      });
      Object.assign(jar, parseSetCookie(getRawSetCookies(resp)));
      const isRedirect = [301, 302, 303, 307].includes(resp.status);
      const loc = resp.headers.get('location');
      if (!isRedirect || !loc) return await resp.text();
      cur = this.absolutize(loc);
      // Sólo el primer salto puede ser POST; los siguientes son GET.
      method = 'GET';
      body = null;
    }
    throw new Error('Demasiados redirects siguiendo login dossanjuan');
  }

  private absolutize(loc: string): string {
    if (loc.startsWith('http')) return loc;
    const base = 'https://dossanjuan.online';
    return loc.startsWith('/') ? `${base}${loc}` : `${base}/${loc}`;
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
