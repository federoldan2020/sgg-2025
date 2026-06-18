/**
 * Configuración de dossanjuan.online (WS SOAP coseguros UDAP).
 *
 * Lee variables de entorno con defaults razonables. NO contiene lógica.
 *
 * Mientras `usuario` / `password` estén vacíos, el cron NO arranca y el
 * encolado sigue funcionando — las filas se procesarán cuando se completen
 * las credenciales y se reinicie el proceso.
 */
export interface DossanjuanConfig {
  usuario: string;
  password: string;
  baseUrl: string;
  loginUrl: string;
  returnUrl: string;
  timeout: number;
  rateLimitMs: number;
  syncIntervalMs: number;
  maxIntentos: number;
  batchSize: number;
}

export function getDossanjuanConfig(): DossanjuanConfig {
  return {
    usuario: process.env.DOSSANJUAN_USER ?? '',
    password: process.env.DOSSANJUAN_PASS ?? '',
    baseUrl:
      process.env.DOSSANJUAN_BASE_URL ??
      'https://dossanjuan.online/coseguros/WS_Coseguros.asmx',
    loginUrl:
      process.env.DOSSANJUAN_LOGIN_URL ??
      'https://dossanjuan.online/Coseguros/Login.Aspx',
    returnUrl: process.env.DOSSANJUAN_RETURN_URL ?? '/coseguros/afiliados.aspx',
    timeout: Number(process.env.DOSSANJUAN_TIMEOUT ?? 15000),
    rateLimitMs: Number(process.env.DOSSANJUAN_RATE_LIMIT_MS ?? 350),
    syncIntervalMs: Number(process.env.DOSSANJUAN_SYNC_INTERVAL_MS ?? 300000),
    maxIntentos: Number(process.env.DOSSANJUAN_MAX_INTENTOS ?? 10),
    batchSize: Number(process.env.DOSSANJUAN_BATCH_SIZE ?? 50),
  };
}

/** Códigos de coseguro permitidos del WS. NO usar otro código. */
export const CODIGO_UDAP = '02';
export const CODIGO_SIN_COSEGURO = '';
