"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Search } from "lucide-react";

import { AfiliadoCombobox } from "@/components/cuenta-corriente/AfiliadoCombobox";
import { CuentaCorrienteAfiliado } from "@/components/cuenta-corriente/CuentaCorrienteAfiliado";
import { buscarAfiliados } from "@/components/cuenta-corriente/api";
import type { AfiliadoSuggest } from "@/components/cuenta-corriente/types";

/**
 * Vista global de cuenta corriente: arranca con un buscador de afiliado.
 * Cuando el afiliado está seleccionado, se monta el componente embebible
 * que también se usa dentro de la ficha del afiliado
 * (`/afiliados/[id]/cuenta-corriente`).
 */
export default function CuentaCorrienteGlobalPage() {
  const searchParams = useSearchParams();
  const afiliadoIdParam = searchParams.get("afiliadoId");

  const [afiliado, setAfiliado] = useState<AfiliadoSuggest | null>(null);

  useEffect(() => {
    if (!afiliadoIdParam) return;
    buscarAfiliados(afiliadoIdParam).then((res) => {
      if (res?.length) setAfiliado(res[0]);
    });
  }, [afiliadoIdParam]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Cuenta corriente</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Movimientos del afiliado por período contable y padrón.
          </p>
        </div>

        <AfiliadoCombobox value={afiliado} onSelect={setAfiliado} />
      </div>

      {!afiliado ? (
        <Card className="p-10">
          <div className="text-center">
            <Search className="mx-auto h-10 w-10 text-muted-foreground/70" />
            <h3 className="mt-4 text-sm font-semibold">Sin afiliado seleccionado</h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
              Buscá un afiliado por DNI, nombre o padrón para ver su cuenta corriente.
            </p>
          </div>
        </Card>
      ) : (
        <CuentaCorrienteAfiliado
          afiliadoId={afiliado.id}
          afiliadoDisplay={afiliado.display}
          afiliadoDni={afiliado.dni}
        />
      )}
    </div>
  );
}
