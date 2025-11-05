export type EstadoCaja = {
  abierta: boolean;
  cajaId: string | null;
  sede: string | null;
};

export async function getEstado(): Promise<EstadoCaja> {
  const r = await fetch("/api/caja/estado", { cache: "no-store" }); // proxy a /caja/estado
  if (!r.ok) throw new Error("No se pudo obtener estado de caja");
  return r.json();
}
