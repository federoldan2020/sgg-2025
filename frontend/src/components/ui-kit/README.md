# Sistema de UI/UX Premium (v2)

Componentes obligatorios para garantizar consistencia y calidad premium en toda la aplicación.

## Componentes disponibles

### Layout y Estructura

#### `PageContainer`
Contenedor global obligatorio para todas las páginas.

```tsx
import { PageContainer } from "@/components/ui-kit";

<PageContainer>
  {/* Contenido de la página */}
</PageContainer>
```

**Características:**
- `max-w-[1200px] mx-auto px-6`
- `space-y-6` entre secciones

---

#### `PageHeader`
Encabezado de página consistente.

```tsx
import { PageHeader } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";

<PageHeader
  title="Terceros"
  subtitle="Gestión de proveedores, prestadores y afiliados"
>
  <Button>Nuevo Tercero</Button>
</PageHeader>
```

**Características:**
- Título: `text-2xl font-semibold tracking-tight`
- Subtítulo: `text-sm text-muted-foreground`
- Acciones a la derecha

---

#### `EntitySummaryCard`
Card resumen de entidad.

```tsx
import { EntitySummaryCard, StatusBadge } from "@/components/ui-kit";

<EntitySummaryCard
  title="Juan Pérez"
  meta="DNI: 12345678"
  status="active"
  badges={[{ label: "PROVEEDOR" }, { label: "PRESTADOR" }]}
>
  {/* Información adicional */}
</EntitySummaryCard>
```

**Características:**
- Nombre: `text-xl font-semibold`
- Meta: `text-xs text-muted-foreground`
- Badges de estado automáticos

---

### Filtros y Navegación

#### `FilterBar`
Barra de filtros consistente para listados.

```tsx
import { FilterBar } from "@/components/ui-kit";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

<FilterBar
  search={{
    placeholder: "Buscar afiliado (DNI o nombre)",
    value: searchQuery,
    onChange: setSearchQuery,
  }}
  filters={
    <>
      <Select value={rol} onValueChange={setRol}>
        {/* opciones */}
      </Select>
    </>
  }
  actions={
    <>
      <Button variant="outline" onClick={clearFilters}>
        Limpiar
      </Button>
      <Button onClick={handleNuevo}>Nuevo</Button>
    </>
  }
/>
```

**Características:**
- Grilla 12 columnas
- Search: `col-span-6` (md)
- Filtros: `col-span-6` (md)
- Acciones alineadas a la derecha

---

#### `PeriodToolbar`
Toolbar de período consistente.

```tsx
import { PeriodToolbar } from "@/components/ui-kit";

<PeriodToolbar
  period="Enero 2025"
  onPrevious={() => goToPreviousPeriod()}
  onNext={() => goToNextPeriod()}
  onToday={() => goToToday()}
/>
```

**Características:**
- No flota, construido como mini toolbar
- Botones outline consistentes
- Título período centrado

---

### Datos y KPIs

#### `KpiGrid`
Grid de KPIs consistente.

```tsx
import { KpiGrid } from "@/components/ui-kit";

<KpiGrid
  items={[
    {
      label: "Total deuda",
      value: 125000,
      isMoney: true,
      variant: "negative",
      hint: "Al cierre del período",
    },
    {
      label: "Afiliados activos",
      value: 145,
      variant: "default",
    },
  ]}
/>
```

**Características:**
- 4 columnas desktop, 2x2 tablet, 1 mobile
- Label: `text-xs text-muted-foreground`
- Valor: `text-2xl font-semibold tabular-nums`
- Soporte para dinero, variantes positivo/negativo

---

#### `DataTable`
Tabla de datos consistente y limpia.

```tsx
import { DataTable } from "@/components/ui-kit";
import { Money } from "@/components/ui-kit";

<DataTable
  columns={[
    {
      key: "nombre",
      header: "Nombre",
      accessor: (row) => row.nombre,
    },
    {
      key: "saldo",
      header: "Saldo",
      accessor: (row) => <Money amount={row.saldo} />,
      align: "right",
    },
  ]}
  data={data}
  loading={loading}
  error={error}
  onRetry={loadData}
  onRowClick={(row) => openDetail(row)}
  emptyTitle="Sin datos"
  emptyDescription="No hay elementos para mostrar."
/>
```

**Características:**
- Header: `text-xs font-medium uppercase tracking-wide text-muted-foreground`
- Filas: `py-3` (premium), hover, selected
- Estados: Loading (skeleton), Empty, Error
- Números: `text-right tabular-nums`

---

#### `DetailSheet`
Sheet de detalle consistente.

```tsx
import { DetailSheet } from "@/components/ui-kit";

<DetailSheet
  open={sheetOpen}
  onOpenChange={setSheetOpen}
  title="Detalle del Tercero"
  description="Información completa del registro"
  status="active"
  primaryAction={{
    label: "Guardar",
    onClick: handleSave,
    variant: "default",
  }}
  secondaryAction={{
    label: "Cancelar",
    onClick: () => setSheetOpen(false),
  }}
>
  {/* Contenido del detalle */}
</DetailSheet>
```

**Características:**
- Desktop: right (por defecto)
- Header: título + badge estado
- Secciones: `space-y-4`
- Acciones: abajo (primary + secondary)

---

### Utilidades

#### `Money`
Formateador de montos ARS.

```tsx
import { Money } from "@/components/ui-kit";

<Money amount={1234.56} showDecimals={true} />
// Output: $ 1.234,56

<Money amount={1234.56} showDecimals={false} />
// Output: $ 1.234
```

**Características:**
- `tabular-nums` automático
- Formato ARS consistente
- Soporte para null/undefined

---

#### `StatusBadge`
Badge semántico de estado.

```tsx
import { StatusBadge } from "@/components/ui-kit";

<StatusBadge status="active" />
<StatusBadge status="pending" />
<StatusBadge status="suspended" label="Suspendido temporalmente" />
```

**Estados disponibles:**
- `active` - Verde suave
- `inactive` - Gris
- `pending` - Ámbar suave
- `partial` - Azul suave
- `suspended` - Gris
- `completed` - Verde suave
- `cancelled` - Rojo suave

---

#### `EmptyState` y `ErrorState`
Estados vacíos y de error.

```tsx
import { EmptyState, ErrorState } from "@/components/ui-kit";

<EmptyState
  title="Sin datos"
  description="No hay elementos para mostrar."
  action={{
    label: "Crear nuevo",
    onClick: handleNuevo,
  }}
/>

<ErrorState
  title="Error al cargar"
  description="Ocurrió un error al cargar los datos."
  onRetry={loadData}
/>
```

---

## Patrón completo de página

Ejemplo de uso completo:

```tsx
import {
  PageContainer,
  PageHeader,
  EntitySummaryCard,
  FilterBar,
  KpiGrid,
  DataTable,
  DetailSheet,
  Money,
  StatusBadge,
} from "@/components/ui-kit";
import { Button } from "@/components/ui/button";

export default function MiListadoPage() {
  // ... estado y lógica ...

  return (
    <PageContainer>
      <PageHeader
        title="Terceros"
        subtitle="Gestión de proveedores, prestadores y afiliados"
      >
        <Button>Nuevo Tercero</Button>
      </PageHeader>

      <FilterBar
        search={{
          placeholder: "Buscar tercero (DNI o nombre)",
          value: searchQuery,
          onChange: setSearchQuery,
        }}
        actions={
          <Button variant="outline" onClick={clearFilters}>
            Limpiar
          </Button>
        }
      />

      <KpiGrid
        items={[
          { label: "Total", value: total, isMoney: true },
          { label: "Activos", value: activos },
        ]}
      />

      <DataTable
        columns={[
          { key: "nombre", header: "Nombre", accessor: (r) => r.nombre },
          {
            key: "saldo",
            header: "Saldo",
            accessor: (r) => <Money amount={r.saldo} />,
            align: "right",
          },
        ]}
        data={data}
        loading={loading}
        error={error}
        onRetry={loadData}
        onRowClick={(row) => setSelectedRow(row)}
      />

      <DetailSheet
        open={!!selectedRow}
        onOpenChange={(open) => !open && setSelectedRow(null)}
        title={selectedRow?.nombre ?? ""}
        status={selectedRow?.activo ? "active" : "inactive"}
      >
        {/* Detalle */}
      </DetailSheet>
    </PageContainer>
  );
}
```

---

## Checklist de QA visual

Antes de dar una pantalla por finalizada:

- [ ] ¿H1 es la página y no la entidad?
- [ ] ¿Header limpio (sin 6 cosas compitiendo)?
- [ ] ¿Entidad en card con meta muted y badges consistentes?
- [ ] ¿Toolbar de período no flota y usa botones shadcn consistentes?
- [ ] ¿KPIGrid con label muted + valor grande + tabular-nums?
- [ ] ¿Tabla con `py-3`, hover, selected, y números `text-right tabular-nums`?
- [ ] ¿Detalle en Sheet (no expand en tabla)?
- [ ] ¿Loading/Empty/Error states implementados?
- [ ] ¿Acciones destructivas con confirmación y sin protagonismo excesivo?
- [ ] ¿No hay duplicación del mismo dato en 2 lugares?

---

## Principios de diseño

1. **Jerarquía en 1 segundo** - El usuario entiende pantalla, entidad, período, datos
2. **Consistencia absoluta** - Un patrón para cada cosa
3. **Menos bordes/sombras, más aire** - UI premium = respiración
4. **Color con propósito** - Rojo/verde solo para semántica
5. **Detalle fuera de la tabla** - Tablas limpias, detalle en Sheet

