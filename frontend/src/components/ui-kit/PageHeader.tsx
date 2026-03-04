import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  children?: ReactNode; // Acciones y controles a la derecha
  className?: string;
};

/**
 * Encabezado de página FOUR Design System
 * - Izquierda: Título con gradiente + subtítulo (text-neutral-600)
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
        "mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-neutral-200 pb-4",
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-neutral-900 to-neutral-700 bg-clip-text text-transparent">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 text-sm font-medium text-neutral-600">{subtitle}</p>
        )}
      </div>
      {children && (
        <div className="flex flex-shrink-0 items-center gap-2">{children}</div>
      )}
    </div>
  );
}

