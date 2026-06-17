"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  /** Texto del botón de confirmación. */
  confirmLabel?: string;
  cancelLabel?: string;
  /** Variante del botón de confirmación. "error" para acciones destructivas. */
  variant?: "default" | "error";
  /** Si true, pide un motivo (textarea) antes de confirmar. */
  requireReason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  /** Callback al confirmar. Si requireReason=true, recibe el motivo ingresado. */
  onConfirm: (reason?: string) => void | Promise<void>;
  /** Deshabilita el botón de confirmar (ej. mientras corre la mutación). */
  loading?: boolean;
};

/**
 * Diálogo de confirmación reutilizable.
 * Reemplaza los `confirm()` y `prompt()` nativos dispersos en la app.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "default",
  requireReason = false,
  reasonLabel = "Motivo",
  reasonPlaceholder = "Indicá el motivo…",
  onConfirm,
  loading = false,
}: ConfirmDialogProps) {
  const [reason, setReason] = React.useState("");

  React.useEffect(() => {
    if (!open) setReason("");
  }, [open]);

  const disabled = loading || (requireReason && reason.trim().length === 0);

  const handleConfirm = async () => {
    await onConfirm(requireReason ? reason.trim() : undefined);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent maxWidth={460}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <DialogDescription asChild>
              <div>{description}</div>
            </DialogDescription>
          )}
        </DialogHeader>

        {requireReason && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-neutral-600">
              {reasonLabel}
            </label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={reasonPlaceholder}
              rows={3}
              autoFocus
            />
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={variant === "error" ? "error" : "default"}
            onClick={() => void handleConfirm()}
            disabled={disabled}
          >
            {loading ? "Procesando…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
