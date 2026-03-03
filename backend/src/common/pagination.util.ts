// =============================================================
// src/common/pagination.util.ts
// =============================================================
import { MAX_PAGE_LIMIT } from './sanitize';

export type PageQuery = { page?: string | number; limit?: string | number };
export function parsePage(q: PageQuery) {
  const page = Math.max(1, Number(q.page ?? 1) || 1);
  const limit = Math.min(MAX_PAGE_LIMIT, Math.max(1, Number(q.limit ?? 20) || 20));
  const skip = (page - 1) * limit;
  return { page, limit, skip, take: limit };
}
