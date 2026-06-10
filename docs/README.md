# Documentación del Sistema SGG / PGG 2025

Este índice mantiene la lista de documentos vivos del proyecto y el
estado de cada uno. Si vas a empezar una sesión nueva, leé desde acá.

## Documentos principales

| Doc | De qué trata | Estado | Actualización |
|---|---|---|---|
| [ANALISIS_PROYECTO.md](./ANALISIS_PROYECTO.md) | Panorama general: stack, módulos, diagnóstico, backlog priorizado. | Vigente | 2026-06-03 |
| [CIRCUITO_AFILIADOS_DEUDA_SUSPENSION.md](./CIRCUITO_AFILIADOS_DEUDA_SUSPENSION.md) | **Documento principal del modelo de negocio.** Reglas formales de cobertura, deuda, suspensión, cupo, gates, materialización ex-ante, generación de novedades, bajas. Registro de 40 decisiones tomadas con el usuario. | Vigente | 2026-06-04 |
| [AUDITORIA_CODIGO_NOVEDADES.md](./AUDITORIA_CODIGO_NOVEDADES.md) | Inventario del código viejo de novedades + plan de limpieza antes de codear el modelo nuevo. | Vigente | 2026-06-04 |

## Documentos heredados (referencia histórica)

| Doc | Contenido | Vigencia |
|---|---|---|
| [DOC-01-Diagnostico-Coseguro.md](./DOC-01-Diagnostico-Coseguro.md) | Análisis viejo del módulo coseguro. | Parcialmente desactualizado |
| [DOC-02-Propuesta-Diseno-Reintegros.md](./DOC-02-Propuesta-Diseno-Reintegros.md) | Diseño de reintegros (no implementado completo). | Vigente como referencia |
| [DOC-03-API-Spec-Reintegros.md](./DOC-03-API-Spec-Reintegros.md) | Spec API de reintegros. | Idem |
| [DOC-04-Plan-Por-Fases.md](./DOC-04-Plan-Por-Fases.md) | Plan de fases viejo. | Reemplazado por el plan dentro de CIRCUITO_AFILIADOS_DEUDA_SUSPENSION.md |
| [ESTADO_PROYECTO.md](./ESTADO_PROYECTO.md) | Estado viejo del proyecto. | Reemplazado por la sección 8 de CIRCUITO_AFILIADOS_DEUDA_SUSPENSION.md |
| [EVALUACION_STACK_Y_DEPLOYMENT.md](./EVALUACION_STACK_Y_DEPLOYMENT.md) | Evaluación del stack. | Vigente como referencia |
| [analisis-funcional-completo.md](./analisis-funcional-completo.md) | Análisis funcional inicial. | Parcialmente desactualizado por las decisiones nuevas |
| [seguridad-auth.md](./seguridad-auth.md) | Notas de seguridad / auth. | Vigente |

## Estado actual del proyecto

Ver [CIRCUITO_AFILIADOS_DEUDA_SUSPENSION.md § 8 Estado de implementación](./CIRCUITO_AFILIADOS_DEUDA_SUSPENSION.md).

Resumen de bloques implementados:

- ✅ **Parámetros con vigencia** (J17 mínimo, cuota 04, regla J22).
- ✅ **Cobertura por concepto separado** (j17/j22/j38Cubierto).
- ✅ **Suspensiones del afiliado por J17** (provisoria → firme).
- ✅ **Excepciones ADMIN/SUPERADMIN**.
- ✅ **Cierre mensual** con dry-run + informe + detalle exportable.
- ✅ **Gates dinámicos** (afiliado / coseguro / colaterales).
- ✅ **Materialización ex-ante** de obligaciones J22, J38, J17-04.
- ✅ **Importador TXT Cómputos** (retorno).
- ✅ **Marcado inicial de coseguros** desde movimientos históricos.
- ✅ **Tab Estado del afiliado** con 3 semáforos + obligaciones abiertas.
- ✅ **Cuenta corriente** reusable + integrada en ficha del afiliado.

Pendiente para cerrar Fase 1 (en orden sugerido):

1. ⏳ **Auditoría y limpieza** del módulo `novedades` viejo (ver [AUDITORIA_CODIGO_NOVEDADES.md](./AUDITORIA_CODIGO_NOVEDADES.md)).
2. ⏳ **Generación de novedades** (Cómputos) — decisiones 24-40 ya cerradas.
3. ⏳ **Hook de caja** (pago → recálculo + rehabilitación).
4. ⏳ **CupoService** (J17 × 7.5, promedio últimos 3 meses) + UI.
5. ⏳ **Cron scheduler** (día 10 cierre + día 16 firmes + último hábil mes ex-ante).
6. ⏳ **Gates integrados** en consumidores (coseguro, reintegros, ordenes, comercios).
7. ⏳ **Baja automática** coseguro/colaterales a 3 meses.
8. ⏳ **UI reglas J38** con tramos por cantidad de colaterales.

## Mapa del código implementado

### Backend

| Módulo | Ubicación | Estado |
|---|---|---|
| **suspensiones** | `backend/src/modulos/suspensiones/` | Implementado completo. Contiene parámetros, cobertura, suspensiones, excepciones, cierre mensual, gates, materialización ex-ante. |
| **nomina** | `backend/src/modulos/nomina/` | Implementado el importador del TXT de retorno con parser propio. Quedan endpoints viejos sin uso. |
| **coseguro** | `backend/src/modulos/coseguro/` | Existe ABM + reglas + marcado inicial (nuevo). |
| **novedades** | `backend/src/modulos/novedades/` | **A reemplazar.** Ver auditoría. |
| **dashboard** | `backend/src/modulos/dashboard/` | Implementado endpoint `/dashboard/stats`. |

### Frontend

| Ruta | Estado |
|---|---|
| `/` | Dashboard con KPIs filtrados por rol. |
| `/afiliados/[id]` | Ficha con layout + tabs (Datos / Estado / Cuenta corriente). |
| `/afiliados/[id]/estado` | Tab Estado con 3 semáforos, obligaciones, suspensiones, excepciones. |
| `/afiliados/[id]/cuenta-corriente` | Cuenta corriente embebida. |
| `/movimientos` | Cuenta corriente global (label "Cuenta corriente"). |
| `/parametros` | Vigencias J17 mínimo + cuota 04 + precio J22. |
| `/cierre-mensual` | Lanzador + historial. |
| `/cierre-mensual/[id]` | Detalle con tablas exportables. |
| `/nomina/importar-cobranza` | Upload TXT con preview. |
| `/admin/materializar-mes` | Materialización ex-ante + marcado inicial de coseguros. |
| `/novedades/...` | **A reemplazar.** Ver auditoría. |

### Servicios frontend

| Archivo | Función |
|---|---|
| `frontend/src/servicios/api.ts` | Helper genérico de fetch tipado + auth. |
| `frontend/src/servicios/dashboard.ts` | KPIs del dashboard. |
| `frontend/src/servicios/suspensiones.ts` | Toda la API del módulo suspensiones: parámetros, cobertura, suspensiones, excepciones, cierre, materialización, reglas J22, marcado coseguros, obligaciones pendientes. |
| `frontend/src/servicios/nomina.ts` | Importación TXT de cobranza. |

### Componentes reusables

| Archivo | Función |
|---|---|
| `frontend/src/components/cuenta-corriente/` | Componente embebible `CuentaCorrienteAfiliado` + sub-componentes (combobox, tabla, detalle de orden, KPIs, toolbar de período). |
| `frontend/src/components/layout/` | Layout principal con sidebar + header. |
| `frontend/src/contexts/afiliadoDetalle.tsx` | Context compartido entre tabs de la ficha del afiliado. |

## Workflow de la conversación

Las decisiones de modelo se toman en charla con el usuario sobre cómo
funciona el negocio. Cada decisión se documenta numerada en la sección 9
de `CIRCUITO_AFILIADOS_DEUDA_SUSPENSION.md`. Antes de codear, se acuerda
el alcance. Al codear, los pasos quedan reflejados en la sección 8
(Estado de implementación).

Cuando una decisión vieja se contradice con una nueva, se agrega un
bloque (Bloque 2, Bloque 3, etc.) y la decisión nueva tiene "REVISA n del
bloque anterior".
