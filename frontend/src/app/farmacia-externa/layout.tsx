import type { ReactNode } from "react";

/**
 * Layout dedicado para la vista pública de farmacias externas.
 *
 * Se monta FUERA del shell autenticado del admin (no hereda el AppLayout
 * con sidebar). Las rutas hijas usan `farmaciaToken` en localStorage,
 * independiente del `accessToken` del usuario admin.
 *
 * NOTA: el wrapper raíz usa `w-full` explícito y los hijos heredan ese
 * ancho. Si se usan `<Card>` (flex flex-col) directamente con `mx-auto
 * max-w-xx`, el ancho puede colapsar al min-content — esto pasa porque el
 * Card es un flex container y no recibe ancho del padre. Para evitarlo:
 * usar `<div className="w-full max-w-[Xpx]">` como wrapper, igual que en
 * `LoginForm.tsx`.
 */
export default function FarmaciaExternaLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen w-full flex-col bg-neutral-50">
      <header className="w-full border-b border-neutral-200 bg-white">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
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
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
        {children}
      </main>
    </div>
  );
}
