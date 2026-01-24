import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type PeriodToolbarProps = {
  period: string; // Ej: "Enero 2025"
  onPrevious: () => void;
  onNext: () => void;
  onToday?: () => void;
  className?: string;
};

/**
 * Toolbar de período consistente
 * - No debe "flotar", se construye como mini toolbar
 * - Contenedor: rounded-lg border bg-background
 * - Botones: outline size="icon" para < y >
 * - Título período centrado: text-sm font-medium
 * - Botón "Hoy": outline size="sm"
 */
export function PeriodToolbar({
  period,
  onPrevious,
  onNext,
  onToday,
  className,
}: PeriodToolbarProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border bg-background px-2 py-1",
        className
      )}
    >
      <Button
        variant="outline"
        size="icon"
        onClick={onPrevious}
        aria-label="Período anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="min-w-[140px] text-center text-sm font-medium">
        {period}
      </span>
      <Button
        variant="outline"
        size="icon"
        onClick={onNext}
        aria-label="Período siguiente"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
      {onToday && (
        <>
          <div className="mx-1 h-4 w-px bg-border" />
          <Button variant="outline" size="sm" onClick={onToday}>
            Hoy
          </Button>
        </>
      )}
    </div>
  );
}

