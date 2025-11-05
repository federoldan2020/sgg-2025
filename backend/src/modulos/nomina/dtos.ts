export interface ConciliarNominaDto {
  loteId: number; // id del NovedadLote (o podrías usar periodo)
  periodo: string; // "YYYY-MM"
  items: {
    afiliadoId: number;
    padronId?: number;
    canal: string; // "J22" | "K16" | ...
    importeCobrado: number;
  }[];
}
