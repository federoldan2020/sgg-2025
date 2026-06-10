"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "debit" | "credit" | "neutral";
}) {
  return (
    <Card className="p-5">
      <div className="space-y-1">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div
          className={cn(
            "text-2xl font-semibold tabular-nums",
            tone === "debit" && "text-destructive",
            tone === "credit" && "text-emerald-600",
          )}
        >
          {value}
        </div>
      </div>
    </Card>
  );
}
