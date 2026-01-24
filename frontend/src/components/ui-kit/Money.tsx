import { cn } from "@/lib/utils";

type MoneyProps = {
  amount: number | null | undefined;
  className?: string;
  showDecimals?: boolean;
};

/**
 * Componente para formatear montos en ARS con tabular-nums
 * Formato: $ 1.234,56 o $ 1.234 según showDecimals
 */
export function Money({
  amount,
  className,
  showDecimals = true,
}: MoneyProps) {
  const value = Number(amount ?? 0);
  const formatted = value.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  });

  return (
    <span className={cn("tabular-nums", className)}>{formatted}</span>
  );
}

