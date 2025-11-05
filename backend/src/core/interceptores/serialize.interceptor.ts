// src/core/bigint-serializer.interceptor.ts (renómbralo si querés a serialize.interceptor.ts)
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, Observable } from 'rxjs';

function plainify(value: unknown): unknown {
  if (value === null || value === undefined) return value;

  // BigInt → string
  if (typeof value === 'bigint') return value.toString();

  // Date → ISO string
  if (value instanceof Date) return value.toISOString();

  // Prisma.Decimal (duck-typing): tiene toNumber/toString
  const anyV = value as any;
  if (typeof anyV?.toNumber === 'function' && typeof anyV?.toString === 'function') {
    // devolvemos string para no perder precisión
    try {
      return anyV.toString();
    } catch {
      /* ignore */
    }
  }

  // Arrays / Objetos
  if (Array.isArray(value)) return value.map(plainify);

  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = plainify(v);
    return out;
  }

  return value;
}

@Injectable()
export class SerializeInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data) => plainify(data)));
  }
}
