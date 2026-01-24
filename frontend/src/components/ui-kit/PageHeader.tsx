import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  children?: ReactNode; // Acciones y controles a la derecha
  className?: string;
};

/**
 * Encabezado de página consistente
 * - Izquierda: Título (text-2xl) + Subtítulo opcional (text-sm muted)
 * - Derecha: Acciones y controles
 */
export function PageHeader({
  title,
  subtitle,
  children,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4",
        className
      )}
    >
      <div className="flex-1 min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {children && (
        <div className="flex items-center gap-2 shrink-0">{children}</div>
      )}
    </div>
  );
}

