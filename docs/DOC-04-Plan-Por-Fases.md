# DOC-04 Plan por Fases (Sprints)

## Fase 0 - Analisis (completada)
- DOC-01 Diagnostico Coseguro
- DOC-02 Propuesta de Diseno Reintegros
- DOC-03 API Spec (borrador)

## Fase 1 - MVP operativo (Solicitud + workflow basico)
### Backend
- Migraciones: `reintegro_solicitudes`, `reintegro_items`, `reintegro_adjuntos`, `reintegro_historial_estados`
- Politicas base: `reintegro_politicas` (parametros minimos)
- Servicios:
  - `ReintegrosService` (create/edit/presentar/listar/detalle)
  - `ReintegrosWorkflowService` (transiciones y auditoria)
  - `ReintegrosAdjuntosService`
- Validaciones:
  - PersonaRef (titular/familiar)
  - Elegibilidad minima por coseguro activo (bloquear `suspendido`/`baja`)
  - Duplicados basicos (comprobante)
  - Reglas base parametrizadas: 4 ordenes por grupo, 2 medicamentos por orden
  - Tope optica anual (marco + cristales)
- Endpoints core (DOC-03)

### Frontend
- Pantalla listado de solicitudes (filtros por estado/tipo/fecha)
- Formulario de alta/edicion (items multiples, descripcion libre)
- Detalle con historial y adjuntos
- Bandeja de revision (acciones aprobar/rechazar/observar)

### Criterios de aceptacion MVP
- Crear solicitud con multiples items
- Presentar y mover por `PRESENTADO -> EN_REVISION -> APROBADO/RECHAZADO`
- Adjuntos requeridos por tipo
- Duplicado bloqueado
- Se respetan topes base (ordenes/meds/optica)
- Trazabilidad completa (historial)

## Fase 2 - Pagos y caja/cuenta corriente
### Backend
- Tabla `reintegro_pagos` y endpoints `orden-pago` y `pagar`
- Integracion con modulo de ordenes de pago (si existe)
- Impacto en cuenta corriente (si aplica)

### Frontend
- Acciones de tesoreria (generar OP, marcar pago)
- Visualizacion de pagos en detalle

### Criterios
- Estado `A_PAGAR` y `PAGADO` funcionando
- Registro de medio de pago y fecha

## Fase 3 - Reglas avanzadas y nomencladores
### Backend
- Versionado completo de `reintegro_politicas` (vigencias, excepciones)
- Motor de reglas (topes, porcentajes, carencias)
- Nomencladores (practicas/medicamentos) opcionales
- Antifraude avanzado (outliers, hashes)

### Frontend
- ABM de politicas
- Catalogos basicos (si se habilita)

## Fase 4 - Portal afiliado
### Backend
- Endpoints para afiliado (crear/ver estado/subir adjuntos)
- Notificaciones basicas (email o interno)

### Frontend
- Portal autoservicio (solicitud + estado + observaciones)

## Migraciones necesarias (resumen)
- MVP: 4 tablas core (solicitudes/items/adjuntos/historial)
- Fase 2: pagos
- Fase 3: politicas y nomencladores

## Estimacion por sprint (referencial)
- Sprint 1: Fase 1 backend + endpoints core
- Sprint 2: Fase 1 frontend + ajustes
- Sprint 3: Fase 2 pagos
- Sprint 4: Fase 3 reglas y nomencladores
- Sprint 5: Fase 4 portal afiliado
