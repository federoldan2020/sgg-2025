import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "./StatusBadge";
import { cn } from "@/lib/utils";

type EntitySummaryCardProps = {
  title: string;
  meta?: string | ReactNode; // DNI / sistema / ids
  status?: "active" | "inactive" | "pending" | "suspended";
  badges?: Array<{ label: string; variant?: "default" | "outline" | "secondary" }>;
  children?: ReactNode;
  className?: string;
};

/**
 * Card resumen de entidad
 * - Nombre (text-xl font-semibold)
 * - Línea meta (DNI / sistema / ids): text-xs muted
 * - Badges de estado
 */
export function EntitySummaryCard({
  title,
  meta,
  status,
  badges,
  children,
  className,
}: EntitySummaryCardProps) {
  return (
    <Card className={cn("rounded-xl", className)}>
      <CardContent className="p-5">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-semibold">{title}</h2>
              {meta && (
                <div className="mt-1 text-xs text-muted-foreground">
                  {meta}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {status && <StatusBadge status={status} />}
              {badges?.map((badge, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium"
                >
                  {badge.label}
                </span>
              ))}
            </div>
          </div>
          {children && <div className="pt-2">{children}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

