import type { ReactNode } from "react";

/**
 * Layout dedicado para la vista pública de farmacias externas.
 *
 * Se monta FUERA del shell autenticado del admin (no hereda el AppLayout
 * con sidebar). Las rutas hijas usan `farmaciaToken` en localStorage,
 * independiente del `accessToken` del usuario admin.
 */
export default function FarmaciaExternaLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <div>
            <div className="text-sm font-semibold text-neutral-900">
              UDAP · Farmacia externa
            </div>
            <div className="text-xs text-neutral-500">
              Consumo de órdenes mensuales
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
