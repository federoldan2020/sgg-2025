export function getInitials(name: string): string {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function timeAgo(date: string | Date): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffDay > 30) {
    return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
  }
  if (diffDay > 1) return `hace ${diffDay} días`;
  if (diffDay === 1) return "ayer";
  if (diffHour >= 1) return `hace ${diffHour} h`;
  if (diffMin >= 1) return `hace ${diffMin} min`;
  return "recién";
}

export const moneyARS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

export function formatCurrency(value: number | string | undefined | null): string {
  if (value === undefined || value === null) return "$ 0,00";
  return moneyARS.format(Number(value));
}
