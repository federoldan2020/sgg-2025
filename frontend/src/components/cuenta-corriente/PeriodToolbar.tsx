"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export function PeriodToolbar({
  selectedDate,
  onDateChange,
  disabled,
}: {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  disabled: boolean;
}) {
  const isCurrentMonth = useMemo(() => {
    const now = new Date();
    return (
      selectedDate.getFullYear() === now.getFullYear() &&
      selectedDate.getMonth() === now.getMonth()
    );
  }, [selectedDate]);

  const monthYear = useMemo(() => {
    return selectedDate.toLocaleString("es-AR", { month: "long", year: "numeric" });
  }, [selectedDate]);

  const goToPrevMonth = () => {
    const d = new Date(selectedDate);
    d.setMonth(d.getMonth() - 1);
    onDateChange(d);
  };

  const goToNextMonth = () => {
    const d = new Date(selectedDate);
    d.setMonth(d.getMonth() + 1);
    onDateChange(d);
  };

  const goToToday = () => onDateChange(new Date());

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="inline-flex items-center gap-2 rounded-lg border bg-background px-2 py-1">
        <Button
          variant="outline"
          size="icon"
          onClick={goToPrevMonth}
          disabled={disabled}
          aria-label="Mes anterior"
          className="h-8 w-8"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="min-w-[160px] text-center text-sm font-medium capitalize">
          {monthYear}
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={goToNextMonth}
          disabled={disabled}
          aria-label="Mes siguiente"
          className="h-8 w-8"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        {!isCurrentMonth && (
          <>
            <Separator orientation="vertical" className="mx-1 h-6" />
            <Button
              variant="outline"
              size="sm"
              onClick={goToToday}
              disabled={disabled}
              className="h-8"
            >
              Hoy
            </Button>
          </>
        )}
      </div>

      <div className="text-xs text-muted-foreground">
        Tip: usá el selector para navegar por período contable.
      </div>
    </div>
  );
}
