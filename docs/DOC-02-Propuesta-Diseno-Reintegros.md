# DOC-02 Propuesta Diseno Reintegros

## Objetivo
Disenar el modulo de reintegros integrado con el coseguro actual, sin refactor masivo y siguiendo patrones existentes en Nest/Prisma.
Este documento parte del diagnostico de `DOC-01` y define una propuesta completa para el modulo.

## Principios
- Reintegro como **Solicitud** con **items**, adjuntos, workflow y auditoria.
- Integracion con Coseguro via un servicio unico de elegibilidad.
- Mantener el stack y convenciones actuales (Nest + Prisma + DTOs).
- MVP con descripcion libre, preparado para normalizar a futuro.

## Modulos funcionales
1) **Reintegros - Configuracion (reglas/politicas)**
2) **Reintegros - Solicitudes (core)**
3) **Reintegros - Adjuntos**
4) **Reintegros - Auditoria/Workflow**
5) **Reintegros - Pagos (orden/pago/caja)**
6) **Reintegros - Reportes**
7) (Opcional) **Nomencladores** (practicas/medicamentos/prestadores)

## Entidades y relaciones (propuesta)
### Minimas
1) `reintegro_solicitudes`
- `id`, `organizacionId`
- `personaTipo` (TITULAR|FAMILIAR)
- `afiliadoId`, `familiarId` (nullable)
- `tipo` (MEDICAMENTO|PRACTICA)
- `estado`
- `fechaFactura`, `fechaPresentacion`
- `importeTotal`, `importeAprobado`
- `padronId` (imputacion si aplica)
- `observaciones`
- `creadoPorId`, `creadoAt`, `actualizadoAt`

2) `reintegro_items`
- `id`, `solicitudId`
- `descripcion` (MVP)
- `cantidad`, `importe`, `importeAprobado`
- `codigoNomenclador` (nullable)
- `tipoItem` (MEDICAMENTO|PRACTICA)

3) `reintegro_adjuntos`
- `id`, `solicitudId`
- `tipoAdjunto` (FACTURA|RECETA|ORDEN|INFORME|OTRO)
- `url`, `hash`, `mime`, `size`, `fechaSubida`, `subidoPorId`

4) `reintegro_historial_estados`
- `id`, `solicitudId`
- `estadoAnterior`, `estadoNuevo`
- `observacion`
- `actorId`, `fecha`
- `payloadAntes`, `payloadDespues` (json opcional)

5) `reintegro_politicas`
- Versionado por `organizacionId`, `vigenteDesde`, `vigenteHasta`
- Topes mensuales/anuales
- Porcentaje cobertura por tipo
- Requisitos documentales por tipo
- Ventana de presentacion (dias)
- Carencias (meses desde alta)
- Exclusiones

6) `reintegro_pagos`
- `id`, `solicitudId`
- `ordenPagoId` (si existe modulo)
- `monto`, `medioPago`, `fechaPago`, `estadoPago`

### Opcionales (futuro)
- `reintegro_nomenclador_practicas`
- `reintegro_nomenclador_medicamentos`
- `reintegro_prestadores`
- `reintegro_motivos_rechazo`

## Estados del flujo (core)
- `BORRADOR`
- `PRESENTADO`
- `EN_REVISION`
- `OBSERVADO`
- `APROBADO`
- `RECHAZADO`
- `A_PAGAR`
- `PAGADO`
- `CERRADO`

## Identidad de persona (normalizacion)
Crear una capa `PersonaRef` en servicios:
```
{ tipo: 'TITULAR'|'FAMILIAR', documento: string, afiliadoId?: bigint, familiarId?: bigint }
```
Resolver por:
- Titular: `Afiliado` (dni bigint)
- Familiar: `Colateral` (dni string)

Todas las solicitudes deben persistir la referencia y el tipo, sin ambiguedad.

## Integracion con Coseguro
### Servicio unico de elegibilidad
`isEligibleForReintegro(personaRef, fechaFactura, tipoReintegro, monto, organizacionId)`
Evalua:
- Afiliado activo (`Afiliado.estado`)
- Coseguro activo (`CoseguroAfiliado.estado === 'activo'`)
- Padron aplicable (si corresponde)
- Carencias (segun politicas)
- Topes disponibles

### Suspension de afiliado en coseguro
Propuesta: extender `CoseguroAfiliado.estado` a `activo | baja | suspendido`.
Regla: si `estado` es `suspendido` o `baja`, **no** permite generar reintegros.
Operaciones requeridas:
- Suspender por deuda/incumplimiento (guardar motivo y fecha).
- Rehabilitar (volver a `activo` sin perder historial).

### Consumos y topes: alternativas
**A) Compartir credito con coseguro (J22/J38)**
Pros: modelo unico de beneficio.
Contras: no hay consumos en coseguro hoy; requiere cambios grandes y riesgo operacional.

**B) Topes independientes para reintegros (recomendado)**
Pros: aislado del modelo actual; menor riesgo; mas claro para auditoria.
Contras: requiere nuevas tablas de consumo/periodo.

**C) Mixto por plan**
Pros: flexible para planes especiales.
Contras: mayor complejidad de reglas y testing.

**Recomendacion**: **B** por menor impacto y alineado a la realidad actual (coseguro no tiene consumos).

### Consumos de reintegros (nueva tabla)
Crear `reintegro_consumos` o usar `reintegro_solicitudes` + `reintegro_items` para calcular topes
por periodo (mensual/anual). Se recomienda una tabla de consumos agregados por performance.

## Reglas parametrizables (politicas)
Campos minimos en `reintegro_politicas`:
- `topeMensual`, `topeAnual`
- `porcentajeMedicamento`, `porcentajePractica`
- `diasVentanaPresentacion`
- `carenciaMeses`
- `requisitosAdjuntos` (json)
- `exclusiones` (json)
- `activo`

### Reglas especificas solicitadas (parametrizables)
- **Ordenes por grupo familiar**: `maxOrdenesPorGrupo` (default 4).
- **Medicamentos por orden**: `maxMedicamentosPorOrden` (default 2).
- **Porcentaje de cobertura**: editable por tipo (`MEDICAMENTO` / `PRACTICA`).
- **Topes por prestaciones**: ejemplo optica (1 marco + 1 par de cristales por anio).

Estas reglas deben vivir en `reintegro_politicas` con versionado por vigencia.

## Antifraude y duplicados
Reglas base:
- Duplicado por comprobante: `cuit + nro + fecha + importe` en ventana N dias
- Hash de archivo (si adjunto PDF)
- Alertas por outliers: monto alto vs promedio, frecuencia alta por persona

## Seguridad y auditoria
- Historial de estados y cambios con antes/despues
- Roles: Operador, Auditor, Tesoreria, Admin
- Adjuntos con acceso autenticado (no publicos)

## Integraciones
- **Coseguro**: elegibilidad y estado del afiliado
- **Caja/Ordenes de pago**: cuando estado pasa a `A_PAGAR`/`PAGADO`
- **Cuenta corriente afiliado** (si aplica) para impacto financiero

## Riesgos y mitigaciones
- No existe `suspendido` en coseguro: definir si reintegro debe respetar `estado='baja'` solamente.
- No hay consumos: crear nueva tabla y no tocar J22/J38.
- Identidad familiar no normalizada: crear `PersonaRef` en el modulo de reintegros.
