import { AlertCircle, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  icon?: React.ReactNode;
  className?: string;
};

/**
 * Estado vacío consistente con ícono, texto y acción opcional
 */
export function EmptyState({
  title = "Sin datos",
  description = "No hay elementos para mostrar.",
  action,
  icon,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 px-4 text-center",
        className
      )}
    >
      <div className="mb-4 shrink-0 text-muted-foreground">
        {icon ?? <Inbox className="h-12 w-12" />}
      </div>
      <h3 className="mb-2 max-w-md text-sm font-semibold leading-6 text-balance">
        {title}
      </h3>
      <p className="mb-4 mx-auto w-full max-w-md whitespace-normal break-words text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      {action && (
        <Button variant="outline" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

type ErrorStateProps = {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
};

/**
 * Estado de error consistente con botón de reintento
 */
export function ErrorState({
  title = "Error al cargar",
  description = "Ocurrió un error al cargar los datos.",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 px-4 text-center",
        className
      )}
    >
      <div className="mb-4 shrink-0 text-destructive">
        <AlertCircle className="h-12 w-12" />
      </div>
      <h3 className="mb-2 max-w-md text-sm font-semibold leading-6 text-balance">
        {title}
      </h3>
      <p className="mb-4 mx-auto w-full max-w-md whitespace-normal break-words text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </div>
  );
}

