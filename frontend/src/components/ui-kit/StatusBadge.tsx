import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusType =
  | "active"
  | "inactive"
  | "pending"
  | "partial"
  | "suspended"
  | "completed"
  | "cancelled";

type StatusBadgeProps = {
  status: StatusType;
  label?: string;
  className?: string;
};

const statusConfig: Record<
  StatusType,
  { label: string; className: string }
> = {
  active: {
    label: "Activo",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  inactive: {
    label: "Inactivo",
    className: "bg-gray-50 text-gray-700 border-gray-200",
  },
  pending: {
    label: "Pendiente",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  partial: {
    label: "Parcial",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  suspended: {
    label: "Suspendido",
    className: "bg-gray-50 text-gray-600 border-gray-300",
  },
  completed: {
    label: "Completado",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  cancelled: {
    label: "Cancelado",
    className: "bg-red-50 text-red-700 border-red-200",
  },
};

/**
 * Badge semántico de estado con colores suaves y consistentes
 */
export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <Badge
      variant="outline"
      className={cn(config.className, className)}
    >
      {label ?? config.label}
    </Badge>
  );
}

