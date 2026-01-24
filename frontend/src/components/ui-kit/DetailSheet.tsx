import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ReactNode } from "react";
import { StatusBadge } from "./StatusBadge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type DetailSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  status?: "active" | "inactive" | "pending" | "suspended";
  children: ReactNode;
  primaryAction?: {
    label: string;
    onClick: () => void;
    variant?: "default" | "destructive";
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
};

/**
 * Sheet de detalle consistente
 * - Desktop: right (por defecto)
 * - Header: título + badge estado
 * - Secciones internas: space-y-4
 * - Acciones: abajo (primary + secondary)
 */
export function DetailSheet({
  open,
  onOpenChange,
  title,
  description,
  status,
  children,
  primaryAction,
  secondaryAction,
  side = "right",
  className,
}: DetailSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={side} className={cn("flex flex-col", className)}>
        <SheetHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <SheetTitle>{title}</SheetTitle>
              {description && (
                <SheetDescription className="mt-1">
                  {description}
                </SheetDescription>
              )}
            </div>
            {status && <StatusBadge status={status} />}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {children}
        </div>

        {(primaryAction || secondaryAction) && (
          <>
            <Separator className="mt-auto" />
            <SheetFooter className="gap-2 pt-4">
              {secondaryAction && (
                <Button
                  variant="outline"
                  onClick={secondaryAction.onClick}
                >
                  {secondaryAction.label}
                </Button>
              )}
              {primaryAction && (
                <Button
                  variant={primaryAction.variant ?? "default"}
                  onClick={primaryAction.onClick}
                >
                  {primaryAction.label}
                </Button>
              )}
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

