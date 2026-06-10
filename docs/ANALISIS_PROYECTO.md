# Análisis General — SGG 2025

> Fecha: 2026-06-03
> Sistema de Gestión Gremial (SGG / PGG 2025)

## 1. Resumen

Aplicación monorepo (backend NestJS + frontend Next.js 15) para la gestión
interna de un sindicato/obra social: afiliados, padrones, caja, órdenes,
coseguros, conciliación de nómina, tesorería y contabilidad.

## 2. Stack

### Backend (`/backend`)
- **Framework**: NestJS 11 + Express
- **ORM**: Prisma 6 (PostgreSQL)
- **Auth**: JWT (`@nestjs/jwt`, `passport`)
- **Colas**: BullMQ (`@nestjs/bullmq`)
- **Validación**: `class-validator` / `zod`
- **Tests**: Jest (unit + e2e por circuito)
- **Scripts**: importadores DBF, creación de admin/UDAP

### Frontend (`/frontend`)
- **Framework**: Next.js 15 (App Router) + React 19
- **Estilos**: Tailwind v4 + shadcn/ui + `tw-animate-css`
- **Estado/datos**: React Query, SWR, Zustand, react-hook-form, zod
- **UI**: Radix UI, lucide-react, cmdk (command palette), sonner, sweetalert2

### Infra
- Docker Compose + Nginx + PM2 (`ecosystem.config.js`)
- Backups en PowerShell y bash
- Documentación de deployment en raíz

## 3. Módulos funcionales (backend)

| Módulo                | Propósito |
|-----------------------|-----------|
| `auth`                | Login, JWT, guards, roles |
| `afiliados`           | ABM titulares + familiares, importadores |
| `padrones`            | Padrones, alta combinada afiliado+padrón |
| `caja`                | Apertura/cierre, cobros, movimientos |
| `ordenes`             | Órdenes de crédito a afiliados |
| `coseguro`            | ABM, colaterales, configuración, reintegros |
| `novedades`           | Generación + monitor + conciliación |
| `nomina`              | Conciliación de devoluciones |
| `terceros`            | Comprobantes y órdenes de pago |
| `terceros-finanzas`   | Cuentas y extractos |
| `contabilidad`        | Plan de cuentas, asientos, mapeos |
| `movimientos`         | Vista transversal |
| `comercios`           | ABM + importador |
| `organizaciones`      | Multi-tenant (Superadmin) |
| `parametricos`        | Catálogos del sistema |
| `publicaciones`       | Contenido publicable |
| `impresion`           | Generación de impresos |
| `colaterales`         | Colaterales transversales |

## 4. Frontend — secciones (`/src/app`)

`admin`, `afiliados`, `caja`, `comercios`, `conciliar`, `contabilidad`,
`coseguro`, `finanzas`, `importadores`, `login`, `movimientos`, `nomina`,
`novedades`, `obligaciones`, `ordenes`, `padrones`, `parametricos`,
`superadmin`, `terceros`.

Navegación en [src/config/nav.config.ts](../frontend/src/config/nav.config.ts),
filtrada por roles vía `lib/acl.ts`.

### Roles (definidos en `tipos/nav.ts`)
`ADMIN`, `AFILIADOS`, `OPERACION`, `COSEGURO`, `NOMINA`, `TESORERIA`,
`FINANZAS`, `CONTABILIDAD`, `SUPERADMIN`.

### Layout actual
- [AppLayout](../frontend/src/components/layout/AppLayout.tsx): contenedor + AuthGuard + UserContext
- [Header](../frontend/src/components/layout/Header.tsx): fijo arriba (h-14)
- [SidebarNav](../frontend/src/components/layout/SidebarNav.tsx): lateral oscuro, colapsable
- [Breadcrumbs](../frontend/src/components/layout/Breadcrumbs.tsx)
- [CommandPalette](../frontend/src/components/layout/CommandPalette.tsx) (Ctrl+K)

## 5. Diagnóstico visual / técnico

### Layout / look & feel
- **Logo "PGG 2025"** en cuadro negro plano — poco refinado, choca con la paleta
  médica (cyan) del resto del sistema.
- **Mezcla de paletas**: el sidebar usa `slate-*`, el resto del UI usa
  `neutral-*` y `medical-*`. Las grises no coinciden.
- **Sidebar**: sin header propio (el logo vive sólo en el Header global), grupos
  con poca jerarquía, item activo poco visible cuando hay muchos hermanos.
- **Header**: breadcrumbs centrados compiten con el logo; el selector de
  organización (superadmin) es un `<select>` nativo sin styling.
- **Página inicial** ([app/page.tsx](../frontend/src/app/page.tsx)): usa
  emojis como íconos y `text-gray-*` directo en vez del sistema de colores.
- **Sin tema oscuro** activado (hay `next-themes` instalado pero sin toggle).

### Código / CSS
- [globals.css](../frontend/src/app/globals.css) tiene **5.488 líneas**, mezcla
  Tailwind v4 (`@theme`) con un sistema de variables legacy (`--space-md`,
  `--surface-hover`, `--primary-100`, `--text-secondary`, `--radius-xl`) que
  no están definidas en `@theme`. Muchas reglas son legacy y/o duplicadas.
- Webkit-prefixes redundantes en cada flexbox (autoprefixer ya lo hace).
- Estilos por página dentro del global CSS (`.caja-*`, `.afiliados-*`,
  `.comprobantes-*`, `.plan-*`) en lugar de scoped/Tailwind.

### Otros
- README raíz vacío (40 bytes).
- Archivo `cursor_resumen_del_estado_actual_del_pr.md` (208 KB) — basura de IDE.
- Archivos sueltos en raíz: `prompt sprint 3.txt`, `udap_25.conf`,
  `AFILIADO1.DBF` dentro de `backend/src/scripts/` (binario versionado).

## 6. Backlog propuesto

### Prioridad alta — UX/UI (este sprint)
1. **Refinar layout principal**: nuevo logo, sidebar con header, paleta unificada.
2. **Dashboard real** en `/`: KPIs por rol en vez de placeholders con emojis.
3. **Tema claro/oscuro** funcional (ya está instalado `next-themes`).

### Prioridad media
4. **Limpieza de `globals.css`**: migrar reglas a componentes Tailwind / CSS
   modules; eliminar variables huérfanas.
5. **Selector de organización** (superadmin) como dropdown estilizado.
6. **Empty states / loading skeletons** consistentes en listados.
7. **Eliminar archivos basura** de raíz y `.dbf` versionado.

### Prioridad baja / técnico
8. README real en raíz (overview + setup rápido).
9. Storybook o página `/ui-kit` que documente los componentes.
10. Auditoría de queries (algunas listas no paginan o no usan React Query).

## 7. Primer paso (este turno)

Mejorar visualmente layout, sidebar y topbar:
- Header rediseñado con logo refinado, separadores sutiles y mejor jerarquía.
- Sidebar con header de marca propio, grupos más claros y user-card más limpia.
- Fondo de la app con micro-gradiente para dar profundidad.

## 8. Definición funcional — Fase 1

El circuito crítico para arrancar (afiliados, deuda, suspensión,
rehabilitación) está documentado en detalle, con modelo de datos, reglas
y plan de sprints, en:

→ [CIRCUITO_AFILIADOS_DEUDA_SUSPENSION.md](./CIRCUITO_AFILIADOS_DEUDA_SUSPENSION.md)

Los circuitos pendientes de documentar para completar Fase 1:
- Caja (cobranza) — afinado del flujo de cobro y aplicación a deudas.
- Proveedores y órdenes de pago — circuito de pagos.
