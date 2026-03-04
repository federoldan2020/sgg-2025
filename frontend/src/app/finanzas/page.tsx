import { redirect } from 'next/navigation';

/**
 * Redirige /finanzas a /finanzas/cuentas (la única sección de Tesorería/Finanzas en el menú).
 */
export default function FinanzasPage() {
  redirect('/finanzas/cuentas');
}
