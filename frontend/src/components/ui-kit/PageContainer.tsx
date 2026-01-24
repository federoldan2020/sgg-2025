import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageContainerProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Contenedor global obligatorio para todas las páginas
 * - max-w-[1200px] mx-auto px-6
 * - Separación vertical entre secciones: space-y-6
 */
export function PageContainer({
  children,
  className,
}: PageContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto max-w-[1200px] space-y-6 px-6",
        className
      )}
    >
      {children}
    </div>
  );
}

