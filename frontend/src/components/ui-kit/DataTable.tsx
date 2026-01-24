import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./EmptyState";
import { cn } from "@/lib/utils";

type Column<T> = {
  key: string;
  header: string;
  accessor: (row: T) => React.ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
};

type DataTableProps<T> = {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onRowClick?: (row: T) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
  rowClassName?: (row: T) => string;
};

/**
 * Tabla de datos consistente y limpia
 * - Header: text-xs font-medium uppercase tracking-wide muted
 * - Filas: hover:bg-muted/50, py-3 (premium)
 * - Números: text-right tabular-nums
 * - Estados: Loading, Empty, Error
 */
export function DataTable<T extends { id?: string | number }>({
  columns,
  data,
  loading = false,
  error,
  onRetry,
  onRowClick,
  emptyTitle,
  emptyDescription,
  className,
  rowClassName,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className={cn("rounded-xl border", className)}>
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key}>{col.header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, idx) => (
              <TableRow key={idx}>
                {columns.map((col) => (
                  <TableCell key={col.key}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("rounded-xl border", className)}>
        <ErrorState
          description={error}
          onRetry={onRetry}
          className="py-12"
        />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className={cn("rounded-xl border", className)}>
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          className="py-12"
        />
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl border overflow-hidden", className)}>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead
                key={col.key}
                className={cn(
                  "text-xs font-medium uppercase tracking-wide text-muted-foreground",
                  col.align === "right" && "text-right",
                  col.align === "center" && "text-center",
                  col.className
                )}
              >
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, idx) => (
            <TableRow
              key={row.id ?? idx}
              className={cn(
                "py-3 cursor-pointer transition-colors",
                onRowClick && "hover:bg-muted/50",
                rowClassName?.(row)
              )}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((col) => (
                <TableCell
                  key={col.key}
                  className={cn(
                    "py-3",
                    col.align === "right" && "text-right",
                    col.align === "center" && "text-center",
                    col.className
                  )}
                >
                  {col.accessor(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

