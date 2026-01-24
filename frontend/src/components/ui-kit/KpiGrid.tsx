import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Money } from "./Money";

type KpiItem = {
  label: string;
  value: number | string;
  hint?: string;
  isMoney?: boolean;
  variant?: "default" | "positive" | "negative";
};

type KpiGridProps = {
  items: KpiItem[];
  className?: string;
};

/**
 * Grid de KPIs consistente
 * - 4 columnas desktop, 2x2 tablet, 1 columna mobile
 * - label: text-xs muted
 * - valor: text-2xl font-semibold tabular-nums
 * - hint: text-xs muted opcional
 */
export function KpiGrid({ items, className }: KpiGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4",
        className
      )}
    >
      {items.map((item, idx) => (
        <Card key={idx} className="rounded-xl">
          <CardContent className="p-5">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">{item.label}</div>
              <div
                className={cn(
                  "text-2xl font-semibold tabular-nums",
                  item.variant === "positive" && "text-emerald-600",
                  item.variant === "negative" && "text-destructive"
                )}
              >
                {item.isMoney ? (
                  <Money amount={typeof item.value === "number" ? item.value : 0} />
                ) : (
                  item.value
                )}
              </div>
              {item.hint && (
                <div className="text-xs text-muted-foreground">{item.hint}</div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

