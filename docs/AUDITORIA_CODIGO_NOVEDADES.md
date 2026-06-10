# Auditoría del código existente de novedades

> Fecha: 2026-06-04
> Objetivo: decidir qué del módulo `novedades` actual se conserva, se
> refactoriza o se elimina antes de implementar el nuevo modelo
> (decisiones 24-40 del [CIRCUITO_AFILIADOS_DEUDA_SUSPENSION.md](./CIRCUITO_AFILIADOS_DEUDA_SUSPENSION.md)).

## Inventario actual

### Backend — módulo `novedades`

Archivos en `backend/src/modulos/novedades/`:

| Archivo | LOC | Estado |
|---|---|---|
| `novedades.controller.ts` | 481 | Reemplazar |
| `novedades.service.ts` | 2.395 | Mayormente reemplazar; rescatar helpers |
| `novedades.module.ts` | 14 | Reescribir |

**Endpoints actuales** (`@Controller('novedades')`):

| Endpoint | Función | Destino |
|---|---|---|
| GET `/novedades` | Listar eventos pendientes filtrados | ❌ Eliminar (nuevo modelo no usa "pendientes") |
| GET `/novedades/resumen` | Resumen de pendientes | ❌ Eliminar |
| GET `/novedades/pendientes/resumen` | Resumen por período (acumulado) | ❌ Eliminar |
| GET `/novedades/pendientes/resumen/:periodo/txt` | Descargar TXT acumulado | ❌ Eliminar |
| POST `/novedades/generar` | Generar lote (job) | 🔄 Reemplazar con `NovedadesGeneradorService.generarBorrador` |
| GET `/novedades/generadas` | Listar lotes generados | 🔄 Reemplazar con listado de `NovedadLote` |
| GET `/novedades/generadas/:id/txt` | Descargar .txt | 🔄 Reemplazar (mismo concepto, nueva tabla) |
| DELETE `/novedades/generadas/:id` | Borrar lote generado | 🔄 Reemplazar con `anularLote` |
| GET `/novedades/manuales` | Listar novedades manuales | ❌ Eliminar (no hay caso de uso en el modelo nuevo) |
| POST `/novedades/manuales` | Crear novedad manual | ❌ Eliminar |
| PATCH `/novedades/manuales/:id` | Editar manual | ❌ Eliminar |
| DELETE `/novedades/manuales/:id` | Borrar manual | ❌ Eliminar |
| GET `/novedades/coseguro/precio-vigente` | Get precio J22 | ✅ Conservar (lo usa el front actualmente) |
| POST `/novedades/coseguro/precio` | Actualizar precio J22 global | ⚠️ Evaluar (ya tenemos UI mejor en `/parametros`) |
| GET `/novedades/corte` | Get día de corte | ⚠️ Evaluar (el corte está hardcoded en día 10 ahora) |
| PATCH `/novedades/corte` | Set día de corte | ⚠️ Evaluar |
| GET `/novedades/corte/resolve` | Resolver período por fecha | ✅ Conservar como helper |
| POST `/novedades/conciliar` | Procesar conciliación contra TXT retorno | ❌ Eliminar (reemplazado por `ImportarCobranzaService.confirmar`) |

**Métodos del service** (37 métodos públicos detectados):

Rescatables:
- `splitPadronDV(padronRaw)` — helper de formato.
- `sistemaToDpiPrefix(s)` — mapeo sistema → prefijo.
- `mesAbrev(yyyyMM)` — abreviación de mes.
- `resolverPeriodoDestino(fechaEvento, corteDia)` — útil para el modelo de ventana.
- `addMonths(yyyyMM, delta)` — helper de período.
- `getPrecioCoseguroVigente()` — ya hay equivalente en módulo coseguro pero la URL la usa el front.

A eliminar (lógica de "eventos pendientes" que el modelo nuevo no usa):
- `queueEvento` y todos los `registrar*` (15 métodos).
- `listarPendientes`, `resumenPendientes`, `listarPendientesResumen`,
  `construirTxtDesdeResumen`.
- `generarNovedades`, `descargarTxtGenerado`, `listarNovedadesGeneradas`,
  `eliminarNovedadGenerada`.
- `crearNovedadManual`, `listarNovedadesManuales`, `actualizarNovedadManual`,
  `eliminarNovedadManual`.
- `procesarConciliacion`, `procesarConciliacionConProgreso`.

### Modelos Prisma a eliminar

| Modelo | Uso actual | Reemplazo |
|---|---|---|
| `NovedadGenerada` | Lote generado por código viejo | `NovedadLote` |
| `NovedadGeneradaItem` | Item del lote (granularidad: por código) | `NovedadLoteItem` (granularidad: por padrón con 4 valores) |
| `NovedadPendiente` | Buffer de eventos pendientes | ❌ No se reemplaza (el nuevo modelo detecta deltas vs último envío directamente) |
| `NovedadPendientePadron` | Acumulado por padrón/período | ❌ No se reemplaza |
| `NovedadCalendario` | Día de corte por período | ❌ El día 10 queda fijo / parametrizable global. Si necesitamos historia, lo vemos después |
| `Novedad` | Registro genérico | ❌ Sin uso claro |

### Frontend — rutas en `frontend/src/app/novedades/`

| Ruta | LOC aprox | Estado |
|---|---|---|
| `/novedades/page.tsx` | ¿? | ❌ Eliminar |
| `/novedades/generar/` | — | 🔄 Reemplazar con generador nuevo |
| `/novedades/generadas/` | — | 🔄 Reemplazar con listado nuevo |
| `/novedades/manuales/` | — | ❌ Eliminar |
| `/novedades/conciliar/` | — | ❌ Eliminar (la conciliación va por `/nomina/importar-cobranza`) |
| `/novedades/fechas/` | — | ⚠️ Evaluar (probablemente eliminar — día 10 fijo) |

### Sidebar nav

Sección "Novedades" en [nav.config.ts](frontend/src/config/nav.config.ts):

```ts
{ href: "/novedades/", label: "Monitor" },          // ❌ eliminar
{ href: "/novedades/generar", label: "Generar Novedades" },     // 🔄 reemplazar
{ href: "/novedades/generadas", label: "Generaciones" },        // 🔄 reemplazar
{ href: "/novedades/manuales", label: "Novedades Manuales" },   // ❌ eliminar
{ href: "/novedades/fechas", label: "Fechas de Corte" },        // ⚠️ evaluar
{ href: "/novedades/conciliar", label: "Conciliación" },        // ❌ eliminar
```

## Otros cabos sueltos identificados

### Campos en `Padron` con rol confuso

| Campo | Rol histórico | Rol con modelo nuevo | Decisión |
|---|---|---|---|
| `j17`, `j22`, `j38`, `k16` | Antes "lo cobrado" (TXT), después "lo esperado" | Hoy `k16` se sigue usando como "cuota K16 vigente del préstamo". `j17/j22/j38` no se leen en el modelo nuevo (cobranza viene de `MovimientoAfiliado`, esperado de parámetros/reglas). | 🔍 Verificar todos los consumidores. **Probablemente eliminar `j17`, `j22`, `j38`** y dejar `k16` (representa la cuota actual del préstamo). |
| `sueldoBasico` | Carga inicial | No se usa | ❌ Eliminar si nadie lo lee |
| `cupo`, `saldo` | Cache calculado | No se usa (cupo se calcula dinámico) | ❌ Eliminar |
| `ultimoPeriodoCobranzaJ17` | Tracking de actividad | Lo usa el cierre mensual | ✅ Conservar |
| `ultimoMontoCobradoJ17` | Diagnóstico | Lo usa el cierre mensual | ✅ Conservar |
| `evaluadoCoberturaEn` | Tracking | Lo usa el cierre mensual | ✅ Conservar |

### Campos en `CoseguroAfiliado`

| Campo | Decisión |
|---|---|
| `suspendidoEn`, `motivoSuspension`, `suspendidoPorId` | ⚠️ El modelo nuevo no usa "suspendido coseguro" como estado (es gate dinámico). Se reemplaza por `BajaInformable` cuando se da de baja automáticamente. Hoy no se está usando. **Evaluar eliminar**. |
| `imputacionPadronIdCoseguro`, `imputacionPadronIdColaterales` | Lo usa la materialización ex-ante. ✅ Conservar. |

### Scripts one-shot ejecutados

| Script | Estado |
|---|---|
| `backend/src/scripts/setup-federico.ts` | Ya ejecutado. Conservar como referencia de seed inicial. |
| `backend/src/scripts/fix-cobertura-abril.ts` | Ya ejecutado. Sin uso futuro. ❌ **Eliminar**. |

### Otros modelos sin uso claro

| Modelo | Uso | Decisión |
|---|---|---|
| `CreditoFavor` | Saldo a favor de afiliados | ⚠️ No revisado. Probablemente conservar para casos de doble cobro. |
| `Novedad` (genérico) | Sin uso claro | ❌ Eliminar si no es referenciado |

## Plan de limpieza propuesto

Antes de codear el nuevo módulo de novedades, ejecutar estos pasos en
orden, **commiteando entre cada uno** para poder revertir:

### Paso 1 — Borrado del frontend de novedades viejo
- Eliminar `frontend/src/app/novedades/` (excepto si decidimos conservar `/novedades/fechas`).
- Actualizar `nav.config.ts` quitando las entradas obsoletas.
- Verificar typecheck sin errores.

### Paso 2 — Borrado del backend de novedades viejo
- Eliminar `backend/src/modulos/novedades/` (después de rescatar helpers).
- Mover helpers rescatables a `backend/src/common/novedades-helpers.ts`.
- Quitar la importación del `NovedadesModule` en `app.module.ts`.
- Verificar que ningún otro módulo importe del eliminado.

### Paso 3 — Migración Prisma para drop de tablas y campos
Migración nueva `cleanup_novedades_legacy`:
- `DROP TABLE Novedad, NovedadGenerada, NovedadGeneradaItem, NovedadPendiente, NovedadPendientePadron, NovedadCalendario`.
- `ALTER TABLE Padron DROP COLUMN j17, j22, j38, sueldoBasico, cupo, saldo` (si typecheck confirma que nadie los lee — hay que ser cuidadoso porque `k16` SÍ se conserva).
- `ALTER TABLE CoseguroAfiliado DROP COLUMN suspendidoEn, motivoSuspension, suspendidoPorId`.

### Paso 4 — Otros cabos
- Eliminar `backend/src/scripts/fix-cobertura-abril.ts`.
- Eliminar archivo `cursor_resumen_del_estado_actual_del_pr.md` (208 KB de basura en raíz).
- Eliminar `backend/src/scripts/AFILIADO1.DBF` (binario versionado).
- Eliminar archivos sueltos en raíz (`prompt sprint 3.txt`).

### Paso 5 — Verificación end-to-end
- Login + tab Estado + Cuenta corriente + Materializar mes + Cierre mensual.
- Confirmar que ninguna ruta del sistema importa de archivos eliminados.

## Riesgo y reversibilidad

- **Riesgo bajo** del paso 1 (frontend): si rompe algo, se revierte con git.
- **Riesgo medio** del paso 2 (backend): puede haber importaciones cruzadas.
  El paso 1 deja huérfanos a los endpoints; tras el paso 2 simplemente no
  existen. La auditoría debe verificar que no hay otros módulos que
  llamen al `NovedadesService` (ya armé el grep, no detecté llamadas desde
  fuera del módulo `novedades` excepto el import del `NovedadesModule` en
  algunos módulos que sólo importan para exportar tipos).
- **Riesgo alto** del paso 3 (migración con drops): irreversible salvo
  por backup. Antes de aplicar, confirmar con el usuario y crear dump de
  la BD. El paso 3 se ejecuta **al final** y sólo cuando los pasos 1-2
  estén compilados y verificados.

## Decisión a tomar antes del próximo sprint

El usuario debe confirmar **el alcance del borrado**:

- **Opción A** (recomendada): hacer los pasos 1-2 y dejar el 3 para después de tener el módulo nuevo funcionando. Las tablas viejas quedan vacías pero presentes hasta el momento del drop final.
- **Opción B** (más agresiva): hacer los 5 pasos antes de codear el módulo nuevo. Más limpio pero más riesgoso.
