"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, getErrorMessage } from "@/servicios/api";

export type AfiliadoBase = {
  id: string | number;
  dni: string | number;
  apellido: string;
  nombre: string;
  estado: string;
  tipo?: string | null;
  cuit?: string | null;
  numeroSocio?: string | null;
};

type Ctx = {
  afiliadoId: string;
  afiliado: AfiliadoBase | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

const AfiliadoDetalleContext = createContext<Ctx | null>(null);

export function useAfiliadoDetalle() {
  const ctx = useContext(AfiliadoDetalleContext);
  if (!ctx) {
    throw new Error("useAfiliadoDetalle debe usarse dentro de AfiliadoDetalleProvider");
  }
  return ctx;
}

export function AfiliadoDetalleProvider({
  afiliadoId,
  children,
}: {
  afiliadoId: string;
  children: React.ReactNode;
}) {
  const [afiliado, setAfiliado] = useState<AfiliadoBase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!afiliadoId) return;
    setLoading(true);
    setError(null);
    try {
      const a = await api<AfiliadoBase>(`/afiliados/${afiliadoId}`);
      setAfiliado(a);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [afiliadoId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return (
    <AfiliadoDetalleContext.Provider value={{ afiliadoId, afiliado, loading, error, refetch }}>
      {children}
    </AfiliadoDetalleContext.Provider>
  );
}
