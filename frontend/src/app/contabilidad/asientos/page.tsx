"use client";
import { useEffect, useMemo, useState } from "react";
import { api, getErrorMessage } from "@/servicios/api";
import { formatearFechaArgentina, formatearMoneda } from "@/utiles/formatos";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Download, ChevronLeft, ChevronRight, FileText, Filter, RefreshCw } from "lucide-react";

type Row = {
  id: string;
  fecha: string;
  descripcion: string | null;
  origen: string | null;
  referenciaId: string | null;
  totalDebe: number;
  totalHaber: number;
};

const ORIGENES = [
  { value: "", label: "Todos los orígenes" },
  { value: "pago_caja", label: "Pago en Caja" },
  { value: "cierre_caja", label: "Cierre de Caja" },
  { value: "nomina", label: "Nómina (Descuentos)" },
  { value: "comprobante_tercero", label: "Comprobante Tercero" },
  { value: "orden_pago_tercero", label: "Orden de Pago" },
];

function OrigenBadge({ origen }: { origen: string | null }) {
  if (!origen) return <span className="text-muted-foreground">—</span>;
  
  const config: Record<string, { variant: "default" | "secondary" | "outline" | "destructive"; label: string }> = {
    pago_caja: { variant: "default", label: "Caja" },
    cierre_caja: { variant: "secondary", label: "Cierre" },
    nomina: { variant: "outline", label: "Nómina" },
    comprobante_tercero: { variant: "secondary", label: "Comprobante" },
    orden_pago_tercero: { variant: "default", label: "Ord. Pago" },
  };
  
  const c = config[origen] ?? { variant: "outline" as const, label: origen };
  return <Badge variant={c.variant}>{c.label}</Badge>;
}

export default function AsientosPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [origen, setOrigen] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Totales
  const [sumDebe, setSumDebe] = useState(0);
  const [sumHaber, setSumHaber] = useState(0);

  const cargar = async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (origen) params.set("origen", origen);
      if (desde) params.set("desde", desde);
      if (hasta) params.set("hasta", hasta);
      params.set("page", String(p));
      params.set("pageSize", "20");

      const r = await api<{
        items: Row[];
        pages: number;
        page: number;
        total: number;
      }>(`/contabilidad/asientos?${params.toString()}`);
      
      setItems(r.items);
      setPage(r.page);
      setPages(r.pages);
      setTotal(r.total);
      setMsg(null);

      // Calcular totales de la página
      const debe = r.items.reduce((sum, i) => sum + (i.totalDebe || 0), 0);
      const haber = r.items.reduce((sum, i) => sum + (i.totalHaber || 0), 0);
      setSumDebe(debe);
      setSumHaber(haber);
    } catch (e) {
      setMsg(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void cargar(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const urlExport = useMemo(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (origen) params.set("origen", origen);
    if (desde) params.set("desde", desde);
    if (hasta) params.set("hasta", hasta);
    return `${process.env.NEXT_PUBLIC_API_URL}/contabilidad/asientos/export/csv?${params.toString()}`;
  }, [q, origen, desde, hasta]);

  const limpiarFiltros = () => {
    setQ("");
    setOrigen("");
    setDesde("");
    setHasta("");
  };

  const hayFiltros = q || origen || desde || hasta;

  return (
    <main className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Libro de Asientos</h1>
          <p className="text-muted-foreground">
            Registro contable de doble partida
          </p>
        </div>
        <Button asChild variant="outline" className="gap-2">
          <a href={urlExport}>
            <Download className="h-4 w-4" />
            Exportar CSV
          </a>
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Filtros</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar descripción..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-12"
                onKeyDown={(e) => e.key === "Enter" && cargar(1)}
              />
            </div>
            
            <Select value={origen} onValueChange={setOrigen}>
              <SelectTrigger>
                <SelectValue placeholder="Origen" />
              </SelectTrigger>
              <SelectContent>
                {ORIGENES.map((o) => (
                  <SelectItem key={o.value} value={o.value || "all"}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              placeholder="Desde"
            />
            
            <Input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              placeholder="Hasta"
            />

            <div className="flex gap-2">
              <Button onClick={() => cargar(1)} disabled={loading} className="flex-1 gap-2">
                {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Buscar
              </Button>
              {hayFiltros && (
                <Button variant="ghost" size="icon" onClick={limpiarFiltros} title="Limpiar filtros">
                  ×
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs rápidos */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Asientos</CardDescription>
            <CardTitle className="text-2xl">{total.toLocaleString("es-AR")}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Suma Debe (página)</CardDescription>
            <CardTitle className="text-2xl text-blue-600">{formatearMoneda(sumDebe)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Suma Haber (página)</CardDescription>
            <CardTitle className="text-2xl text-green-600">{formatearMoneda(sumHaber)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Error */}
      {msg && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {msg}
        </div>
      )}

      {/* Tabla */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[120px]">Fecha</TableHead>
                <TableHead className="w-[100px]">Origen</TableHead>
                <TableHead className="w-[80px]">Ref.</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-right w-[140px]">Debe</TableHead>
                <TableHead className="text-right w-[140px]">Haber</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <FileText className="h-8 w-8" />
                      <span>No hay asientos registrados</span>
                      {hayFiltros && (
                        <Button variant="link" size="sm" onClick={limpiarFiltros}>
                          Limpiar filtros
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                items.map((r) => (
                  <TableRow key={r.id} className="group hover:bg-muted/50">
                    <TableCell className="font-mono text-sm">
                      {formatearFechaArgentina(r.fecha)}
                    </TableCell>
                    <TableCell>
                      <OrigenBadge origen={r.origen} />
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {r.referenciaId ? `#${r.referenciaId.slice(0, 8)}` : "—"}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/contabilidad/asientos/${r.id}`}
                        className="hover:underline hover:text-primary transition-colors line-clamp-1"
                        title={r.descripcion ?? undefined}
                      >
                        {r.descripcion ?? "(sin descripción)"}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-blue-600">
                      {formatearMoneda(r.totalDebe)}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-green-600">
                      {formatearMoneda(r.totalHaber)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>

        {/* Paginación */}
        {pages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Mostrando {items.length} de {total} asientos
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => cargar(page - 1)}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </Button>
              <span className="text-sm font-medium px-2">
                {page} / {pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pages || loading}
                onClick={() => cargar(page + 1)}
                className="gap-1"
              >
                Siguiente
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </main>
  );
}
