"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, getErrorMessage } from "@/servicios/api";
import { cajaService } from "@/servicios/cajaService";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  FileText,
  Plus,
  RefreshCcw,
  Search,
  X,
  AlertCircle,
  History,
  ClipboardList,
  MoreVertical,
  CalendarDays,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { toast } from "sonner";
import { getInitials, timeAgo, moneyARS } from "@/utiles/ui-helpers";

// ==================== TIPOS ====================

type AfiliadoSuggest = { id: string; dni: string; display: string };
type FamiliarSuggest = {
  id: string;
  dni?: string | null;
  nombre?: string | null;
  display: string;
};

type ReintegroItemForm = {
  descripcion: string;
  cantidad: number;
  importe: number;
  porcentaje: number;
  tipoItem?: "MEDICAMENTO" | "PRACTICA";
};

type ReintegroListItem = {
  id: string;
  personaTipo: "TITULAR" | "FAMILIAR";
  afiliadoId: string;
  familiarId?: string | null;
  tipo: "MEDICAMENTO" | "PRACTICA";
  estado: string;
  fechaFactura: string;
  importeTotal: string;
  importeReintegro?: string;
  afiliadoNombre?: string | null;
  familiarNombre?: string | null;
};

type Paginado<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
};

// ==================== HELPERS ====================

const ESTADOS = [
  "BORRADOR",
  "PRESENTADO",
  "EN_REVISION",
  "OBSERVADO",
  "APROBADO",
  "RECHAZADO",
  "A_PAGAR",
  "PAGADO",
] as const;

const TIPOS = ["MEDICAMENTO", "PRACTICA"] as const;



function EstadoBadge({ estado }: { estado: string }) {
  const map: Record<string, { label: string; className: string }> = {
    BORRADOR: { label: "Borrador", className: "bg-gray-100 text-gray-700" },
    PRESENTADO: { label: "Presentado", className: "bg-blue-100 text-blue-700" },
    EN_REVISION: { label: "En revisión", className: "bg-amber-100 text-amber-700" },
    OBSERVADO: { label: "Observado", className: "bg-orange-100 text-orange-700" },
    APROBADO: { label: "Aprobado", className: "bg-emerald-100 text-emerald-700" },
    RECHAZADO: { label: "Rechazado", className: "bg-red-100 text-red-700" },
    A_PAGAR: { label: "A pagar", className: "bg-purple-100 text-purple-700" },
    PAGADO: { label: "Pagado", className: "bg-green-100 text-green-700" },
  };

  const config = map[estado] || { label: estado, className: "bg-gray-100 text-gray-700" };

  return (
    <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium border-0 ring-1 ring-inset", config.className)}>
      {config.label}
    </Badge>
  );
}

function KpiCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
}) {
  return (
    <Card className="rounded-xl">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-2xl font-semibold tabular-nums">{value}</div>
            {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : null}
          </div>
          {icon ? (
            <div className="rounded-full bg-primary/10 p-2.5 text-primary">
              {icon}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

// ==================== COMPONENTE DE BÚSQUEDA DE AFILIADO ====================

function AfiliadoSearchInput({
  value,
  onChange,
  onSelect,
  placeholder = "Buscar por DNI, apellido, nombre o padrón (ej: 642574-1)...",
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (a: AfiliadoSuggest | null) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<AfiliadoSuggest | null>(null);
  const debouncedQuery = useDebouncedValue(query, 350);
  const [options, setOptions] = useState<AfiliadoSuggest[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const q = debouncedQuery.trim();
      if (q.length < 2) {
        setOptions([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const r = await cajaService.suggestAfiliados(q).catch(() => []);
        if (!cancel) {
          setOptions(r);
          setShowDropdown(true);
        }
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [debouncedQuery]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleClear = () => {
    setQuery("");
    setSelected(null);
    setOptions([]);
    setShowDropdown(false);
    onChange("");
    onSelect(null);
  };

  const hasValue = query || selected;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative flex items-center">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          className="h-10 pl-12 pr-10"
          placeholder={placeholder}
          aria-label="Buscar afiliado"
          value={query}
          onChange={(e) => {
            const v = e.target.value;
            setQuery(v);
            setShowDropdown(true);
            if (selected) setSelected(null);
          }}
          onFocus={() => {
            if (query.trim().length >= 2 || options.length > 0) {
              setShowDropdown(true);
            }
          }}
        />
        {hasValue && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 h-8 w-8"
            onClick={handleClear}
            title="Limpiar búsqueda"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {showDropdown && (query.trim().length >= 2 || options.length > 0) && (
        <div
          className="absolute top-full left-0 right-0 z-50 mt-1 bg-background border rounded-md shadow-lg max-h-[300px] overflow-y-auto"
          onMouseDown={(e) => e.preventDefault()}
        >
          {loading ? (
            <div className="p-4 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          ) : options.length === 0 && query.trim().length >= 2 ? (
            <div className="p-4 text-center">
              <div className="flex flex-col items-center gap-2">
                <Search className="h-5 w-5 text-muted-foreground/50" />
                <div className="text-sm font-medium text-muted-foreground">
                  No se encontraron resultados
                </div>
                <div className="text-xs text-muted-foreground/80">
                  Intentá con otro DNI, nombre o padrón
                </div>
              </div>
            </div>
          ) : options.length > 0 ? (
            <div className="p-1">
              {options.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className="w-full px-3 py-2 text-left rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors text-sm"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setSelected(o);
                    setQuery(o.display);
                    setShowDropdown(false);
                    onChange(o.display);
                    onSelect(o);
                  }}
                >
                  <div className="font-medium">{o.display}</div>
                  <div className="text-xs text-muted-foreground">DNI: {o.dni}</div>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ==================== PÁGINA PRINCIPAL ====================

export default function ReintegrosPage() {
  const router = useRouter();

  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Vista activa: "solicitudes" o "historial"
  const [vistaActiva, setVistaActiva] = useState<"solicitudes" | "historial">("solicitudes");

  // Listado
  const [listLoading, setListLoading] = useState(false);
  const [estadoFilter, setEstadoFilter] = useState("");
  const [tipoFilter, setTipoFilter] = useState("");
  const [afiliadoFilterId, setAfiliadoFilterId] = useState("");
  const [afiliadoFilterSearch, setAfiliadoFilterSearch] = useState("");
  const [afiliadoFilterSelected, setAfiliadoFilterSelected] = useState<AfiliadoSuggest | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [lista, setLista] = useState<Paginado<ReintegroListItem>>({
    items: [],
    total: 0,
    page: 1,
    pageSize: 20,
    pages: 1,
  });

  // Sheet: crear
  const [createOpen, setCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  // Sheet: detalle rápido
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<ReintegroListItem | null>(null);

  // Formulario crear
  const [personaTipo, setPersonaTipo] = useState<"TITULAR" | "FAMILIAR">("TITULAR");
  const [afi, setAfi] = useState<AfiliadoSuggest | null>(null);
  const [afiliadoSearch, setAfiliadoSearch] = useState("");
  const [coseguroInfo, setCoseguroInfo] = useState<{
    tieneCoseguro: boolean;
    estado?: string;
    loading: boolean;
  }>({ tieneCoseguro: false, loading: false });

  const [famOpen, setFamOpen] = useState(false);
  const [famQuery, setFamQuery] = useState("");
  const famDebounced = useDebouncedValue(famQuery, 220);
  const [famOpts, setFamOpts] = useState<FamiliarSuggest[]>([]);
  const [famAll, setFamAll] = useState<FamiliarSuggest[]>([]);
  const [familiar, setFamiliar] = useState<FamiliarSuggest | null>(null);

  const [tipo, setTipo] = useState<"MEDICAMENTO" | "PRACTICA">("MEDICAMENTO");
  const [fechaFactura, setFechaFactura] = useState("");
  const [items, setItems] = useState<ReintegroItemForm[]>([
    { descripcion: "", cantidad: 1, importe: 0, porcentaje: 100, tipoItem: "MEDICAMENTO" },
  ]);

  // Cálculos memorizados
  const totalFactura = useMemo(() => {
    return items.reduce(
      (acc, it) => acc + Number(it.cantidad || 0) * Number(it.importe || 0),
      0,
    );
  }, [items]);

  const totalReintegro = useMemo(() => {
    return items.reduce((acc, it) => {
      const cantidad = Number(it.cantidad || 0);
      const importe = Number(it.importe || 0);
      const porcentaje = Number(it.porcentaje || 0);
      const subtotal = cantidad * importe;
      const reintegro = subtotal * (porcentaje / 100);
      return acc + reintegro;
    }, 0);
  }, [items]);

  const pageMonto = useMemo(() => {
    return lista.items.reduce((acc, s) => acc + Number(s.importeTotal || 0), 0);
  }, [lista.items]);

  const pagePendientes = useMemo(() => {
    const pendingSet = new Set(["PRESENTADO", "EN_REVISION", "OBSERVADO", "A_PAGAR"]);
    return lista.items.filter((x) => pendingSet.has(x.estado)).length;
  }, [lista.items]);

  const pageAprobadas = useMemo(() => {
    return lista.items.filter((x) => x.estado === "APROBADO").length;
  }, [lista.items]);

  const canCreate = useMemo(() => {
    if (!afi?.id) return false;
    if (!coseguroInfo.tieneCoseguro) return false;
    if (!fechaFactura) return false;
    if (personaTipo === "FAMILIAR" && !familiar?.id) return false;

    const validItems = items
      .map((it) => ({
        ...it,
        cantidad: Number(it.cantidad || 0),
        importe: Number(it.importe || 0),
        porcentaje: Number(it.porcentaje || 0),
        descripcion: (it.descripcion || "").trim(),
      }))
      .filter((it) => it.descripcion.length >= 2 && it.cantidad > 0 && it.importe > 0 && it.porcentaje >= 0 && it.porcentaje <= 100);

    if (validItems.length === 0) return false;
    if (totalFactura <= 0) return false;

    return true;
  }, [afi, coseguroInfo.tieneCoseguro, fechaFactura, familiar, items, personaTipo, totalFactura]);

  const cargar = async () => {
    try {
      setListLoading(true);
      const params = new URLSearchParams();

      if (estadoFilter) params.set("estado", estadoFilter);
      if (tipoFilter) params.set("tipo", tipoFilter);
      if (afiliadoFilterId.trim()) params.set("afiliadoId", afiliadoFilterId.trim());
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));

      const data = await api<Paginado<ReintegroListItem>>(
        `/reintegros/solicitudes?${params.toString()}`,
      );

      const estadosActivos = ["BORRADOR", "PRESENTADO", "EN_REVISION", "OBSERVADO", "APROBADO", "A_PAGAR"];
      const estadosHistorial = ["PAGADO", "RECHAZADO"];

      const itemsFiltrados = vistaActiva === "solicitudes"
        ? data.items.filter((item) => estadosActivos.includes(item.estado))
        : data.items.filter((item) => estadosHistorial.includes(item.estado));

      setLista({
        ...data,
        items: itemsFiltrados,
        total: itemsFiltrados.length,
      });
    } catch (e) {
      setMsg({ type: "error", text: getErrorMessage(e) });
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    void cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vistaActiva, estadoFilter, tipoFilter, afiliadoFilterId, page, pageSize]);

  useEffect(() => {
    if (!afi?.id) {
      setCoseguroInfo({ tieneCoseguro: false, loading: false });
      return;
    }

    setCoseguroInfo({ tieneCoseguro: false, loading: true });
    (async () => {
      try {
        const panel = await api<{
          coseguro: {
            estado: "activo" | "baja";
            suspendidoEn?: string | null;
          } | null;
        }>(`/coseguro/afiliados/${afi.id}`);

        const tieneCoseguroActivo =
          panel.coseguro?.estado === "activo" &&
          !panel.coseguro?.suspendidoEn;

        setCoseguroInfo({
          tieneCoseguro: tieneCoseguroActivo,
          estado: panel.coseguro?.estado,
          loading: false,
        });
      } catch (e) {
        setCoseguroInfo({ tieneCoseguro: false, loading: false });
      }
    })();
  }, [afi]);

  useEffect(() => {
    if (afiliadoFilterSelected) {
      setAfiliadoFilterId(afiliadoFilterSelected.id);
    } else {
      setAfiliadoFilterId("");
    }
  }, [afiliadoFilterSelected]);

  useEffect(() => {
    (async () => {
      setFamAll([]);
      setFamOpts([]);
      setFamiliar(null);
      setFamQuery("");
      if (!afi) return;

      const colats = await api<Array<{ id: string; nombre?: string | null; dni?: string | null }>>(
        `/colaterales/afiliados/${afi.id}/colaterales?soloActivos=true`,
      ).catch(() => []);

      const mapped = colats.map((c) => ({
        id: c.id,
        dni: c.dni ?? null,
        nombre: c.nombre ?? null,
        display: `${c.nombre ?? "Familiar"}${c.dni ? ` · DNI ${c.dni}` : ""}`,
      }));

      setFamAll(mapped);
    })();
  }, [afi]);

  useEffect(() => {
    const q = famDebounced.trim().toLowerCase();
    if (!q) return setFamOpts([]);
    const filtered = famAll.filter((f) => {
      const dni = f.dni ?? "";
      const nombre = f.nombre ?? "";
      return dni.includes(q) || nombre.toLowerCase().includes(q);
    });
    setFamOpts(filtered);
  }, [famDebounced, famAll]);

  const resetCreateForm = () => {
    setPersonaTipo("TITULAR");
    setAfi(null);
    setAfiliadoSearch("");
    setCoseguroInfo({ tieneCoseguro: false, loading: false });
    setFamAll([]);
    setFamOpts([]);
    setFamiliar(null);
    setFamQuery("");
    setTipo("MEDICAMENTO");
    setFechaFactura("");
    setItems([{ descripcion: "", cantidad: 1, importe: 0, porcentaje: 100, tipoItem: "MEDICAMENTO" }]);
  };

  const addItem = () => {
    setItems((prev) => [...prev, { descripcion: "", cantidad: 1, importe: 0, porcentaje: 100, tipoItem: tipo }]);
  };

  const updateItem = (idx: number, next: Partial<ReintegroItemForm>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...next } : it)));
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const openCreate = () => {
    resetCreateForm();
    setCreateOpen(true);
  };

  const crear = async () => {
    if (!canCreate) return;
    try {
      setCreateLoading(true);
      const payload = {
        personaTipo,
        afiliadoId: afi!.id,
        familiarId: personaTipo === "FAMILIAR" ? familiar?.id : undefined,
        tipo,
        fechaFactura,
        items: items
          .map((it) => ({
            ...it,
            cantidad: Number(it.cantidad || 0),
            importe: Number(it.importe || 0),
            porcentaje: Number(it.porcentaje || 0),
            descripcion: (it.descripcion || "").trim(),
          }))
          .filter((it) => it.descripcion.length >= 2 && it.cantidad > 0 && it.importe > 0 && it.porcentaje >= 0 && it.porcentaje <= 100),
      };

      await api("/reintegros/solicitudes", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      toast.success("Solicitud creada correctamente");
      setCreateOpen(false);
      resetCreateForm();
      await cargar();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setCreateLoading(false);
    }
  };

  const openRow = (s: ReintegroListItem) => {
    setSelected(s);
    setDetailOpen(true);
  };

  const totalPages = Math.max(1, lista.pages);
  const canPrev = page > 1 && !listLoading;
  const canNext = page < totalPages && !listLoading;

  return (
    <div className="page-container">
      {/* Header de página */}
      <div className="page-header">
        <div className="page-title-section">
          <h1 className="page-title">Reintegros</h1>
          <p className="page-subtitle">
            Gestión de solicitudes de reintegro de afiliados y familiares
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={cargar} disabled={listLoading} size="sm">
            <RefreshCcw className={cn("h-4 w-4", listLoading && "animate-spin", !listLoading && "mr-2")} />
            {!listLoading && "Actualizar"}
          </Button>
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Nueva solicitud
          </Button>
        </div>
      </div>

      <div className="page-content">

      {/* Alert */}
      {msg && (
        <Alert
          className={cn(
            "rounded-lg",
            msg.type === "error"
              ? "border-destructive/30 bg-destructive/10"
              : "border-emerald-500/30 bg-emerald-500/10",
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <AlertTitle className="text-sm font-medium">
                {msg.type === "error" ? "Ocurrió un error" : "Listo"}
              </AlertTitle>
              <AlertDescription className="text-sm mt-1">{msg.text}</AlertDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setMsg(null)} className="h-6 w-6 flex-shrink-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </Alert>
      )}

      {/* Tabs: Solicitudes / Historial */}
      <Card className="rounded-lg">
        <CardContent className="p-0">
          <div className="flex border-b">
            <button
              type="button"
              onClick={() => {
                setVistaActiva("solicitudes");
                setPage(1);
                setEstadoFilter("");
              }}
              className={cn(
                "flex-1 px-6 py-3 text-sm font-medium transition-colors border-b-2",
                vistaActiva === "solicitudes"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <div className="flex items-center justify-center gap-2">
                <ClipboardList className="h-4 w-4" />
                Solicitudes Activas
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                setVistaActiva("historial");
                setPage(1);
                setEstadoFilter("");
              }}
              className={cn(
                "flex-1 px-6 py-3 text-sm font-medium transition-colors border-b-2",
                vistaActiva === "historial"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <div className="flex items-center justify-center gap-2">
                <History className="h-4 w-4" />
                Historial
              </div>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      {vistaActiva === "solicitudes" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KpiCard
            label="Total página"
            value={moneyARS.format(pageMonto)}
            hint={`${lista.items.length} solicitudes`}
            icon={<FileText className="h-5 w-5" />}
          />
          <KpiCard
            label="Pendientes"
            value={pagePendientes}
            hint="En proceso"
            icon={<CircleDashed className="h-5 w-5" />}
          />
          <KpiCard
            label="Aprobadas"
            value={pageAprobadas}
            hint="Listas para pagar"
            icon={<CheckCircle2 className="h-5 w-5" />}
          />
        </div>
      )}

      {/* Filtros: estilo global */}
      <div className="flex flex-col lg:flex-row items-end lg:items-center justify-between gap-4">
        <div className="flex flex-col md:flex-row items-center gap-4 w-full lg:w-auto">
          {/* Search Input con estilo global */}
          <div className="search-input-container w-full md:w-auto">
             <AfiliadoSearchInput
               value={afiliadoFilterSearch}
               onChange={(v) => {
                 setAfiliadoFilterSearch(v);
                 if (!v) setAfiliadoFilterSelected(null);
               }}
               onSelect={setAfiliadoFilterSelected}
               placeholder="Buscar afiliado..."
             />
          </div>

           <div className="flex items-center gap-2 w-full md:w-auto">
              <Select value={estadoFilter || "all"} onValueChange={(v) => setEstadoFilter(v === "all" ? "" : v)}>
                <SelectTrigger className="h-10 w-full md:w-[180px] bg-white">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  {(vistaActiva === "solicitudes"
                    ? ["BORRADOR", "PRESENTADO", "EN_REVISION", "OBSERVADO", "APROBADO", "A_PAGAR"]
                    : ["PAGADO", "RECHAZADO"]
                  ).map((e) => (
                    <SelectItem key={e} value={e}>
                      {e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={tipoFilter || "all"} onValueChange={(v) => setTipoFilter(v === "all" ? "" : v)}>
                <SelectTrigger className="h-10 w-full md:w-[180px] bg-white">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  {TIPOS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
           </div>
        </div>

        <div className="flex items-center gap-2">
           <span className="text-sm text-muted-foreground mr-2 hidden lg:block">
             {lista.total === 0 ? "0 resultados" : `${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, lista.total)} de ${lista.total}`}
           </span>
        </div>
      </div>

      {/* Listado */}
      <Card className="rounded-lg">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">
            {vistaActiva === "solicitudes" ? "Solicitudes Activas" : "Historial"}
          </CardTitle>
          <CardDescription className="text-sm mt-1">
            {lista.items.length} solicitud{lista.items.length !== 1 ? "es" : ""} en esta vista
          </CardDescription>
        </CardHeader>
        <CardContent>
      {listLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : lista.items.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          No hay solicitudes para mostrar
        </div>
      ) : (
        <>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Persona</th>
                  <th>Tipo</th>
                  <th>Estado</th>
                  <th>Fecha factura</th>
                  <th className="table-col-numeric">Importe</th>
                  <th className="table-col-numeric">Reintegro</th>
                  <th className="table-col-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {lista.items.map((s) => (
                  <tr key={s.id}>
                    <td><span className="font-mono text-xs text-muted-foreground">{s.id.slice(0, 8)}...</span></td>
                    <td>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border hidden md:flex">
                          <AvatarFallback className="text-xs bg-muted text-muted-foreground">
                            {getInitials(
                              s.personaTipo === "FAMILIAR" && s.familiarNombre
                                ? s.familiarNombre
                                : s.afiliadoNombre || "?"
                            )}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-sm">
                            {s.personaTipo === "FAMILIAR" && s.familiarNombre
                              ? s.familiarNombre
                              : s.afiliadoNombre || "—"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {s.personaTipo === "FAMILIAR" ? "Familiar" : "Titular"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <Badge variant="outline" className="text-xs font-normal">
                        {s.tipo}
                      </Badge>
                    </td>
                    <td>
                      <EstadoBadge estado={s.estado} />
                    </td>
                    <td>
                      <div className="flex flex-col">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                               <span className="text-sm cursor-help hover:text-foreground transition-colors">
                                 {new Date(s.fechaFactura).toLocaleDateString("es-AR")}
                               </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {timeAgo(s.fechaFactura)}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </td>
                    <td className="table-col-numeric tabular-nums text-sm">
                      {moneyARS.format(Number(s.importeTotal))}
                    </td>
                    <td className="table-col-numeric tabular-nums font-semibold text-emerald-600 text-sm">
                      {s.importeReintegro 
                        ? moneyARS.format(Number(s.importeReintegro))
                        : moneyARS.format(Number(s.importeTotal))}
                    </td>
                    <td className="table-col-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => openRow(s)}>
                            Ver detalles
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => navigator.clipboard.writeText(s.id)}>
                            Copiar ID
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              Página <span className="font-medium">{page}</span> de <span className="font-medium">{totalPages}</span> · {lista.total} total
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={!canPrev}
              >
                <ArrowLeft className="h-4 w-4 mr-1.5" />
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={!canNext}
              >
                Siguiente
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </div>
          </div>
        </>
      )}
        </CardContent>
      </Card>

      {/* Sheet: Detalle */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Detalle de solicitud</SheetTitle>
            <SheetDescription>Información completa de la solicitud de reintegro</SheetDescription>
          </SheetHeader>

          {selected && (
            <div className="mt-6 space-y-4">
              <div className="rounded-lg border p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-muted-foreground font-medium">ID</div>
                    <div className="text-sm font-mono mt-1">{selected.id}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground font-medium">Estado</div>
                    <div className="mt-1">
                      <EstadoBadge estado={selected.estado} />
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground font-medium">Tipo</div>
                    <div className="text-sm mt-1">{selected.tipo}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground font-medium">Persona</div>
                    <div className="text-sm font-medium mt-1">
                      {selected.personaTipo === "FAMILIAR" && selected.familiarNombre
                        ? selected.familiarNombre
                        : selected.afiliadoNombre || "—"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {selected.personaTipo === "FAMILIAR" ? "Familiar" : "Titular"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground font-medium">Fecha factura</div>
                    <div className="text-sm mt-1">
                      {new Date(selected.fechaFactura).toLocaleDateString("es-AR")}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground font-medium">Importe reintegro</div>
                    <div className="text-sm font-semibold tabular-nums mt-1 text-emerald-600">
                      {selected.importeReintegro 
                        ? moneyARS.format(Number(selected.importeReintegro))
                        : moneyARS.format(Number(selected.importeTotal))}
                    </div>
                    {selected.importeReintegro && Number(selected.importeReintegro) !== Number(selected.importeTotal) && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Total factura: {moneyARS.format(Number(selected.importeTotal))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="text-xs text-muted-foreground font-medium">Acciones</div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button asChild>
                    <Link href={`/coseguro/reintegros/${selected.id}`}>Ver detalle completo</Link>
                  </Button>
                  <Button variant="outline" onClick={() => setDetailOpen(false)}>
                    Cerrar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Sheet: Crear nueva solicitud */}
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>Nueva solicitud</SheetTitle>
            <SheetDescription>
              Complete los datos para crear una nueva solicitud de reintegro
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* SECCION 1: AFILIADO Y BENEFICIARIO */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">1</span>
                Beneficiario
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 px-1">
                <div className="md:col-span-4">
                  <label className="text-xs font-medium mb-1.5 block text-foreground">Tipo Persona</label>
                  <Select
                    value={personaTipo}
                    onValueChange={(v) => {
                      setPersonaTipo(v as "TITULAR" | "FAMILIAR");
                      setFamiliar(null);
                      setFamQuery("");
                      setFamOpts([]);
                    }}
                  >
                    <SelectTrigger className="h-10 bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TITULAR">Titular</SelectItem>
                      <SelectItem value="FAMILIAR">Familiar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-8">
                  <label className={cn("text-xs font-medium mb-1.5 block", !afi?.id ? "text-destructive" : "text-foreground")}>
                    Afiliado Titular {!afi?.id && <span className="text-destructive">*</span>}
                  </label>
                  <AfiliadoSearchInput
                    value={afiliadoSearch}
                    onChange={setAfiliadoSearch}
                    onSelect={setAfi}
                    placeholder="Buscar titular..."
                  />
                  {afi && (
                    <div className="mt-2">
                       {coseguroInfo.loading ? (
                        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <RefreshCcw className="h-3 w-3 animate-spin" /> Verificando...
                        </div>
                       ) : !coseguroInfo.tieneCoseguro ? (
                         <div className="text-xs text-destructive font-medium flex items-center gap-1.5 bg-destructive/10 px-2 py-1 rounded w-fit">
                           <AlertCircle className="h-3 w-3" /> Sin coseguro activo
                         </div>
                       ) : (
                         <div className="text-xs text-emerald-600 font-medium flex items-center gap-1.5 bg-emerald-50 px-2 py-1 rounded w-fit">
                           <CheckCircle2 className="h-3 w-3" /> Coseguro activo
                         </div>
                       )}
                    </div>
                  )}
                </div>

                {personaTipo === "FAMILIAR" && (
                  <div className="md:col-span-12">
                    <label className={cn("text-xs font-medium mb-1.5 block", !familiar?.id ? "text-destructive" : "text-foreground")}>
                      Familiar Beneficiario {!familiar?.id && <span className="text-destructive">*</span>}
                    </label>
                    <Popover open={famOpen} onOpenChange={setFamOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 w-full justify-start text-muted-foreground bg-background font-normal"
                          disabled={!afi}
                        >
                          <Search className="h-4 w-4 mr-2" />
                          {familiar ? <span className="text-foreground">{familiar.display}</span> : "Seleccionar familiar..."}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                        <Command shouldFilter={false}>
                          <CommandInput
                            placeholder="Escribí DNI o nombre…"
                            value={famQuery}
                            onValueChange={(v) => {
                              setFamQuery(v);
                              if (familiar) setFamiliar(null);
                            }}
                          />
                          <CommandList>
                            {famQuery.trim().length < 2 ? (
                              <div className="p-4 text-center text-sm text-muted-foreground">
                                Escribí al menos 2 caracteres
                              </div>
                            ) : (famQuery.trim().length >= 2 ? famOpts : famAll).length === 0 ? (
                              <div className="p-4 text-center text-sm text-muted-foreground">No encontrado</div>
                            ) : (
                              <CommandGroup heading="Familiares disponibles">
                                {(famQuery.trim().length >= 2 ? famOpts : famAll).map((o) => (
                                  <CommandItem
                                    key={o.id}
                                    value={`${o.display} ${o.dni ?? ""}`}
                                    onSelect={() => {
                                      setFamiliar(o);
                                      setFamQuery(o.display);
                                      setFamOpen(false);
                                    }}
                                    className="cursor-pointer"
                                  >
                                    <span className="text-sm">{o.display}</span>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            )}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                )}
              </div>
            </div>

            {/* SECCION 2: DATOS DE FACTURA */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 border-b pb-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">2</span>
                Datos de Facturación
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 px-1">
                <div className="md:col-span-4">
                  <label className="text-xs font-medium mb-1.5 block text-foreground">Tipo</label>
                  <Select
                    value={tipo}
                    onValueChange={(v) => setTipo(v as "MEDICAMENTO" | "PRACTICA")}
                  >
                    <SelectTrigger className="h-10 bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-4">
                  <label className={cn("text-xs font-medium mb-1.5 block", !fechaFactura ? "text-destructive" : "text-foreground")}>
                    Fecha Factura {!fechaFactura && <span className="text-destructive">*</span>}
                  </label>
                  <Input
                    className="h-10 bg-background"
                    type="date"
                    value={fechaFactura}
                    onChange={(e) => setFechaFactura(e.target.value)}
                  />
                </div>

                <div className="md:col-span-4">
                  <label className="text-xs font-medium mb-1.5 block text-foreground">Total Factura</label>
                  <Input
                    className="h-10 bg-background font-semibold tabular-nums"
                    value={moneyARS.format(totalFactura)}
                    readOnly
                  />
                </div>
              </div>
            </div>
              
            {/* SECCION 3: ITEMS */}
            <div className="space-y-4">
               <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">3</span>
                    Items del Reintegro
                  </h3>
                  <div className="flex items-center gap-4">
                     <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider hidden sm:block">
                        Reintegro Est:
                        <span className="ml-2 text-base font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                           {moneyARS.format(totalReintegro)}
                        </span>
                     </div>
                     <Button variant="outline" size="sm" onClick={addItem} className="h-8">
                       <Plus className="h-3.5 w-3.5 mr-1.5" />
                       Agregar ítem
                     </Button>
                  </div>
               </div>
               
               <div className="space-y-3">
                {items.map((it, idx) => {
                  const descOk = (it.descripcion || "").trim().length >= 2;
                  const cantOk = Number(it.cantidad || 0) > 0;
                  const impOk = Number(it.importe || 0) > 0;
                  const porcentajeOk = Number(it.porcentaje || 0) >= 0 && Number(it.porcentaje || 0) <= 100;
                  const rowOk = descOk && cantOk && impOk && porcentajeOk;

                  const subtotalItem = Number(it.cantidad || 0) * Number(it.importe || 0);
                  const reintegroItem = subtotalItem * (Number(it.porcentaje || 0) / 100);

                  return (
                    <div
                      key={idx}
                      className={cn(
                        "rounded-lg border p-4 transition-all bg-card/50",
                        !rowOk ? "border-destructive/40" : "border-border",
                      )}
                    >
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                          <div className="md:col-span-5">
                            <label className={cn("text-xs font-medium mb-1.5 block", !descOk ? "text-destructive" : "text-foreground")}>
                              Descripción {!descOk && <span className="text-destructive">*</span>}
                            </label>
                            <Input
                              className={cn("h-10", !descOk && "border-destructive")}
                              placeholder="Ej: Amoxicilina 500mg"
                              value={it.descripcion}
                              onChange={(e) => updateItem(idx, { descripcion: e.target.value })}
                            />
                          </div>

                          <div className="grid grid-cols-2 md:col-span-2 gap-4">
                             <div>
                                <label className={cn("text-xs font-medium mb-1.5 block", !cantOk ? "text-destructive" : "text-foreground")}>
                                  Cant. {!cantOk && <span className="text-destructive">*</span>}
                                </label>
                                <Input
                                  className={cn("h-10 tabular-nums", !cantOk && "border-destructive")}
                                  type="number"
                                  min={1}
                                  value={it.cantidad}
                                  onChange={(e) => updateItem(idx, { cantidad: Number(e.target.value) })}
                                />
                             </div>
                          </div>

                          <div className="md:col-span-2">
                            <label className={cn("text-xs font-medium mb-1.5 block", !impOk ? "text-destructive" : "text-foreground")}>
                              Importe {!impOk && <span className="text-destructive">*</span>}
                            </label>
                            <Input
                              className={cn("h-10 tabular-nums", !impOk && "border-destructive")}
                              type="number"
                              min={0}
                              step="0.01"
                              placeholder="0.00"
                              value={it.importe}
                              onChange={(e) => updateItem(idx, { importe: Number(e.target.value) })}
                            />
                          </div>

                          <div className="md:col-span-2">
                            <label className="text-xs font-medium mb-1.5 block text-foreground">
                              % Cobertura
                            </label>
                            <div className="relative">
                              <Input
                                className={cn("h-10 tabular-nums pr-7", !porcentajeOk && "border-destructive")}
                                type="number"
                                min={0}
                                max={100}
                                step="0.1"
                                placeholder="100"
                                value={it.porcentaje}
                                onChange={(e) => updateItem(idx, { porcentaje: Number(e.target.value) })}
                              />
                              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                                %
                              </span>
                            </div>
                          </div>

                          <div className="md:col-span-1 flex justify-end md:justify-center md:pt-8">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeItem(idx)}
                              disabled={items.length === 1}
                              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              title="Quitar ítem"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {subtotalItem > 0 && porcentajeOk && (
                          <div className="flex items-center justify-between rounded-md border border-border/50 bg-muted/30 px-3 py-2">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground hidden sm:flex">
                              <span>Subtotal: {moneyARS.format(subtotalItem)}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm ml-auto">
                                <span className="text-xs text-muted-foreground">Reintegro:</span>
                                <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                                  {moneyARS.format(reintegroItem)}
                                </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {!rowOk && (
                        <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/5 p-2.5">
                           <p className="text-[11px] text-destructive flex items-center gap-1.5">
                             <AlertCircle className="h-3 w-3" />
                             Complete todos los campos obligatorios
                           </p>
                        </div>
                      )}
                    </div>
                  );
                })}
               </div>
            </div>
          </div>

          <SheetFooter className="mt-6 flex flex-col-reverse sm:flex-row gap-3 sm:justify-between sticky bottom-0 bg-background pt-4 pb-6 z-10 border-t items-center">
            <Button variant="ghost" onClick={resetCreateForm} disabled={createLoading} size="sm" className="text-muted-foreground">
              Limpiar formulario
            </Button>
            <div className="flex flex-col gap-2 w-full sm:w-auto items-end">
              {!canCreate && (
                <div className="text-[10px] text-destructive font-medium uppercase tracking-wide px-1 animate-pulse">
                  {!afi?.id
                    ? "Falta seleccionar afiliado"
                    : !coseguroInfo.tieneCoseguro
                      ? "Afiliado sin coseguro"
                      : !fechaFactura
                        ? "Falta fecha factura"
                        : personaTipo === "FAMILIAR" && !familiar?.id
                          ? "Falta seleccionar familiar"
                          : items.filter((it) => {
                              const desc = (it.descripcion || "").trim();
                              const cant = Number(it.cantidad || 0);
                              const imp = Number(it.importe || 0);
                              const porc = Number(it.porcentaje || 0);
                              return desc.length >= 2 && cant > 0 && imp > 0 && porc >= 0 && porc <= 100;
                            }).length === 0
                            ? "Revise los ítems"
                            : "Complete los campos requeridos"}
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setCreateOpen(false)}
                  disabled={createLoading}
                >
                  Cancelar
                </Button>
                    {/* Boton Crear (Fixed Tooltip) */}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>
                            <Button
                              onClick={crear}
                              disabled={!canCreate || createLoading}
                              className="min-w-[140px] bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                              {createLoading ? (
                                <>
                                  <RefreshCcw className="h-4 w-4 animate-spin mr-2" />
                                  Procesando...
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="h-4 w-4 mr-2" />
                                  Crear Solicitud
                                </>
                              )}
                            </Button>
                          </span>
                        </TooltipTrigger>
                        {!canCreate && (
                          <TooltipContent side="top" className="max-w-[200px] text-center bg-destructive text-destructive-foreground">
                            <p>Complete todos los campos obligatorios marcados en rojo</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
              </div>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
    </div>
  );
}
