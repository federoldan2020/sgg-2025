// =============================================================
// src/common/bigint.util.ts
// =============================================================
export function toJSONSafe<T = any>(data: T): T {
  return JSON.parse(JSON.stringify(data, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));
}
