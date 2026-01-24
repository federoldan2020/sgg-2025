import { ReactNode } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FilterBarProps = {
  search?: {
    placeholder?: string;
    value: string;
    onChange: (value: string) => void;
  };
  filters?: ReactNode; // Selects, checkboxes, etc.
  actions?: ReactNode; // Limpiar, Actualizar, Nuevo, etc.
  title?: string;
  className?: string;
};

/**
 * Barra de filtros consistente para listados
 * - Grilla 12 columnas
 * - Search: col-span-6
 * - Filtros: col-span-3 o col-span-2/3 según cantidad
 * - Acciones alineadas a la derecha
 */
export function FilterBar({
  search,
  filters,
  actions,
  title,
  className,
}: FilterBarProps) {
  return (
    <Card className={cn("rounded-xl", className)}>
      {(title || actions) && (
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            {title && <CardTitle className="text-lg">{title}</CardTitle>}
            {actions && <div className="flex items-center gap-2">{actions}</div>}
          </div>
        </CardHeader>
      )}
      {(search || filters) && (
        <CardContent className={title ? "pt-0" : "pt-6"}>
          <div className="grid grid-cols-12 gap-4">
            {search && (
              <div className="col-span-12 md:col-span-6">
                <Input
                  type="search"
                  placeholder={search.placeholder ?? "Buscar…"}
                  value={search.value}
                  onChange={(e) => search.onChange(e.target.value)}
                  className="h-10"
                />
              </div>
            )}
            {filters && (
              <div className="col-span-12 md:col-span-6 flex items-center gap-4">
                {filters}
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

