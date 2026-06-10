"use client";

import { CuentaCorrienteAfiliado } from "@/components/cuenta-corriente/CuentaCorrienteAfiliado";
import { useAfiliadoDetalle } from "@/contexts/afiliadoDetalle";

export default function AfiliadoCuentaCorrientePage() {
  const { afiliadoId } = useAfiliadoDetalle();
  // El header del afiliado ya está renderizado por el layout; ocultamos el
  // header interno del componente para evitar duplicación.
  return <CuentaCorrienteAfiliado afiliadoId={afiliadoId} hideHeader />;
}
