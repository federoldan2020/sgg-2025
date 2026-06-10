# Circuito Afiliados — Deuda, Suspensión y Rehabilitación

> Documento funcional + técnico. Base para Fase 1 (arranque).
> Fecha: 2026-06-03 · Proyecto: SGG / PGG 2025 · Org. de referencia: **UDAP**

## 1. Contexto del negocio

UDAP es un gremio docente de la provincia de San Juan. La cobranza de la cuota
societaria y servicios asociados se hace por **tres canales**:

- **Recibo de sueldo** (descuento por liquidación)
- **Débito automático**
- **Pago manual en caja**

Objetivo declarado de UDAP: **reducir la cobranza por caja**, migrando
afiliados a los otros dos canales.

### 1.1 Tipos de afiliado

El **tipo de afiliado** define el **canal de cobranza**, no el servicio.

| Tipo | Canal de cobranza | Quién devuelve la cobranza |
|------|-------------------|----------------------------|
| **Activos** | Descuento por Cómputos de la Provincia | TXT mensual (~día 6-7) |
| **Jubilados** | Descuento por ANSES | TXT mensual (último día hábil del mes anterior) |
| **PP** (Planta Permanente) | Liquidación interna de UDAP | Liquidación interna |
| **04** | No tiene canal automático | Pago manual en caja |

### 1.2 Códigos de descuento

Son los conceptos que UDAP cobra. Conviven en el mismo afiliado.

| Código | Concepto | Monto | Generación de deuda |
|--------|----------|-------|---------------------|
| **J17** | Cuota societaria | Variable (2% del sueldo) — UDAP **NO conoce** el monto a priori para Activos/Jub/PP. Para 04 es un **valor parametrizable** (hoy $70.000). Existe un **mínimo parametrizable** (hoy $25.000) que define la deuda. | `max(0, J17_min − Σ cobrado_padrones)` |
| **J22** | Coseguro del titular | **Fijo** parametrizable por UDAP. Opcional (requiere adhesión). | `max(0, J22_vigente − cobrado)` |
| **J38** | Colaterales del coseguro | **Fijo** parametrizable por UDAP por tramos de cantidad. Sólo aplica si tiene J22. | `max(0, J38_vigente − cobrado)` |
| **K16** | Cuota de orden de crédito (préstamo) | Variable, **UDAP sí conoce el monto** (lo solicita). | `max(0, K16_pedido − cobrado)` |

### 1.3 Padrones

Cada **relación laboral** del afiliado es un padrón. Un afiliado puede tener
varios padrones simultáneos (ej. docente con doble cargo en escuelas
distintas). Cada padrón puede tener J17/J22/J38/K16 con valores propios.

**Problema histórico**: cuando un afiliado cambia de escuela, el padrón viejo
queda registrado pero deja de descontar. Se ensucia la base.

## 2. El problema central

UDAP necesita **detectar morosidad a 30 días para suspender afiliados**, pero:

1. No conoce el monto real de J17 hasta que llega el TXT del mes siguiente
   (desfasaje de ~1 mes).
2. Para Activos/Jub/PP, el sueldo puede no alcanzar y el descuento ser parcial
   o cero (licencia sin goce, embargos previos, etc.).
3. Los padrones huérfanos ocultan la realidad de quién está pagando y quién no.

### 2.1 Solución conceptual

**Para Activos / Jubilados / PP**, la deuda **no se mide en pesos del sueldo
real, sino contra un mínimo parametrizable.**

```
deuda_J17(afiliado, período) = max(0, J17_minimo_vigente − Σ J17_cobrado_padrones)
```

Esto convierte un problema indeterminado en uno con monto cierto:

- Si la cobranza acumulada del afiliado supera el mínimo → cobertura OK.
- Si no llega → la diferencia es **deuda exigible** (cobrable por caja).

**Para 04**, J17 es un valor parametrizable; la deuda se genera con monto
cierto desde el día 1 del período.

**Para J22 / J38** (todos los tipos): valor fijo parametrizable; mismo modelo.

**Para K16** (todos los tipos): UDAP conoce el monto solicitado; deuda =
`pedido − cobrado`.

### 2.2 Padrón activo

Un padrón se considera **activo** si descontó algo en **alguno de los últimos
K meses** (K = 3 sugerido). Si no, se marca `inactivo` automáticamente. Tras
M meses (M = 12 sugerido) sin actividad, el sistema propone baja al operador.

## 3. Estados del afiliado y servicios

### 3.1 Estados

| Estado | Causa | Servicios habilitados | Sale por |
|--------|-------|-----------------------|----------|
| `activo` | Cobertura OK | Todos | — |
| `suspendido_provisorio` | Mora detectada en cierre mensual del día 10 | Sólo pago por caja | Saldar período en mora |
| `suspendido_firme` | Provisorio no saldado al día 16 | Sólo pago por caja | Saldar período en mora |
| `baja` | ADMIN, sin deuda | Ninguno | — |
| `baja_incobrable` | ADMIN, con deuda no recuperable | Ninguno | — (contable: pérdida, Fase 2) |

> Las suspensiones **NO se informan a Cómputos/ANSES**. Los códigos siguen
> vigentes en el organismo externo. Es un **estado interno de UDAP** que
> regula servicios. Si en algún período futuro el TXT trae cobranza ≥ mínimo
> que cancela el período en mora → rehabilitación automática.

### 3.2 Gates de servicios

| Servicio | Bloqueado si... |
|----------|------------------|
| Uso de coseguro (consulta médica, prestación) | Afiliado suspendido **o** J22 del período en curso < J22_vigente |
| Colaterales (uso por familiares) | Suspendido **o** J38 del período en curso < J38_vigente |
| Carga / aprobación de reintegros | Suspendido **o** J22 del período en curso < J22_vigente |
| Nuevas órdenes de crédito | Suspendido (las en curso siguen) |
| Compras en comercios (credencial) | Suspendido |
| Pago por caja | **Nunca bloqueado** (es la vía de regularización) |

> **Dos gates conviven**: uno a nivel afiliado (suspensión por mora de J17) y
> otro a nivel servicio (J22 no cobrado del período corta coseguro/reintegros
> aunque el afiliado no esté suspendido).

## 4. Calendario operativo mensual

| Día | Evento | Detalle |
|-----|--------|---------|
| Último hábil del mes anterior | Llega TXT ANSES | Procesa cobranza de Jubilados |
| 6-7 | Llega TXT Cómputos | Procesa cobranza de Activos / PP |
| Durante el mes | Cierre 04 | UDAP marca los pagos de caja de los 04 |
| **10** | **Cierre mensual automático** (cron) | Calcula cobertura, suspende provisorios, rehabilita, marca padrones inactivos, emite informe |
| 11-15 | Ventana de gracia | ADMIN/SUPERADMIN puede revertir suspensiones provisorias |
| 16 | Conversión a firme | Suspensiones provisorias no revertidas → firmes |
| Continuo | Rehabilitación automática | Cualquier pago/TXT que cancele el período en mora rehabilita |

## 5. Reglas de negocio formales

### 5.1 Cobertura por período

```
J17_cubierto(afiliado, período) =
    (Σ_padrones J17_cobrado) ≥ J17_minimo_vigente_en_período

J22_cubierto(afiliado, período) =
    afiliado.tieneCoseguroVigenteEnPeríodo ⇒ J22_cobrado ≥ J22_vigente_en_período

J38_cubierto(afiliado, período) =
    afiliado.tieneColateralesVigentesEnPeríodo ⇒ J38_cobrado ≥ J38_vigente_en_período

K16_cubierto(afiliado, período) =
    afiliado.tieneCreditosVigentesEnPeríodo ⇒ K16_cobrado ≥ K16_pedido_en_período

período_cubierto(afiliado, período) =
    J17_cubierto ∧ J22_cubierto ∧ J38_cubierto ∧ K16_cubierto
```

### 5.2 Deuda generada por período

```
deuda(afiliado, período) =
    deuda_J17 + deuda_J22 + deuda_J38 + deuda_K16
```

Cada componente es `max(0, esperado − cobrado)`.

### 5.3 Suspensión

```
candidato_suspension(afiliado) =
    ¬período_cubierto(afiliado, período_anterior_evaluado)
    ∧ ¬excepción_admin_vigente(afiliado)
    ∧ estado(afiliado) = activo
```

El cierre del día 10 marca a estos como `suspendido_provisorio` con
`fechaVigencia = hoy`, `periodoOrigen = período_anterior_evaluado`,
`estado_subordinado = provisorio`.

El día 16 (job diario), todos los `suspendido_provisorio` con `fechaVigencia
≤ hoy − 5 días` pasan a `suspendido_firme`.

### 5.4 Rehabilitación

```
rehabilitable(afiliado) =
    estado(afiliado) ∈ {suspendido_provisorio, suspendido_firme}
    ∧ ∀ período ∈ períodos_en_mora(afiliado): deuda(afiliado, período) = 0
```

Se dispara en tres momentos:
- Al procesar TXT de cobranza (Cómputos / ANSES / 04).
- Al registrar pago en caja.
- Por excepción ADMIN.

### 5.5 Baja del afiliado

```
puede_dar_baja(afiliado) =
    Σ_período deuda(afiliado, período) = 0
    ∧ saldo_K16(afiliado) = 0   // préstamos cancelados
```

Si no cumple, el operador puede:
- Cobrar primero la deuda, o
- Dar **baja con incobrable** (sólo ADMIN, queda contabilizado como
  pérdida en Fase 2).

### 5.6 Excepción ADMIN

```
excepción_admin_vigente(afiliado) =
    ∃ excepción donde
        excepción.afiliadoId = afiliado.id
        ∧ excepción.activa = true
        ∧ (excepción.vigenciaHasta = NULL ∨ excepción.vigenciaHasta ≥ hoy)
```

Sólo ADMIN/SUPERADMIN puede crear/desactivar. Cada cambio se audita.

## 6. Modelo de datos

### 6.1 Lo que YA existe (Prisma)

| Modelo | Uso en este circuito |
|--------|----------------------|
| `Afiliado` | Tiene `estado` (string suelto). Lo reusamos extendiendo. |
| `Padron` | Tiene `activo` (boolean). Falta `ultimoPeriodoConCobranza` y un job que lo mantenga. |
| `Concepto` (J17, J22, J38, K16) | Reusable; verificar que los códigos estén dados de alta. |
| `Obligacion` | Modelo de deuda. Reusable tal cual. `periodo`, `monto`, `saldo`, `estado`. |
| `ReglaPrecioCoseguro` | Historia de J22 ✓ |
| `ReglaPrecioColateral` | Historia de J38 ✓ |
| `OrganizacionConfig` | Clave/valor sin vigencia → **no sirve para J17_MINIMO** con historia. |
| `CoseguroAfiliado.suspendidoEn` | Suspensión específica de coseguro. **No equivale** a suspensión general del afiliado. |
| `Pago / Aplicacion` | Cobranza por caja, aplica a obligaciones. Reusable. |
| `EventoAuditoria` | Trazabilidad de acciones. |
| `NovedadPendientePadron` | Acumula novedades por período. |
| `CreditoAfiliado` | Saldo a favor por doble cobro (caso retorno con sobrante). |

### 6.2 Lo que falta (modelos nuevos)

```prisma
// Historia del valor mínimo J17 por organización
model ParametroJ17Minimo {
  id             BigInt   @id @default(autoincrement())
  organizacionId String
  valor          Decimal  @db.Decimal(12, 2)
  vigenteDesde   DateTime @db.Date
  vigenteHasta   DateTime? @db.Date
  creadoPorId    String?
  creadoEn       DateTime @default(now())
  organizacion   Organizacion @relation(fields: [organizacionId], references: [id], onDelete: Cascade)
  @@index([organizacionId, vigenteDesde])
}

// Valor de J17 para afiliados 04 (parametrizable con historia)
model ParametroJ17Cuota04 {
  id             BigInt   @id @default(autoincrement())
  organizacionId String
  valor          Decimal  @db.Decimal(12, 2)
  vigenteDesde   DateTime @db.Date
  vigenteHasta   DateTime? @db.Date
  creadoPorId    String?
  creadoEn       DateTime @default(now())
  organizacion   Organizacion @relation(fields: [organizacionId], references: [id], onDelete: Cascade)
  @@index([organizacionId, vigenteDesde])
}

// Suspensión a nivel afiliado (independiente de la del coseguro)
model AfiliadoSuspension {
  id              BigInt   @id @default(autoincrement())
  organizacionId  String
  afiliadoId      BigInt
  periodoOrigen   String   // "YYYY-MM" del período que disparó la mora
  estado          String   // "provisoria" | "firme" | "revertida" | "rehabilitada"
  fechaInicio     DateTime @default(now())
  fechaFirme      DateTime? // cuando pasa a firme (día 16)
  fechaFin        DateTime? // cuando se rehabilita o revierte
  motivoFin       String?  // "pago_caja" | "cobranza_periodo" | "excepcion_admin"
  creadoPorId     String?
  finalizadoPorId String?

  organizacion Organizacion @relation(fields: [organizacionId], references: [id], onDelete: Cascade)
  afiliado     Afiliado     @relation(fields: [afiliadoId], references: [id], onDelete: Cascade)

  @@index([organizacionId, afiliadoId])
  @@index([organizacionId, estado])
  @@index([organizacionId, periodoOrigen])
}

// Excepción ADMIN: afiliado que no se suspende automáticamente
model AfiliadoExcepcionSuspension {
  id              BigInt   @id @default(autoincrement())
  organizacionId  String
  afiliadoId      BigInt
  motivo          String
  vigenciaHasta   DateTime? // null = indefinida
  activa          Boolean  @default(true)
  creadoPorId    String
  creadoEn        DateTime @default(now())
  desactivadoEn   DateTime?
  desactivadoPorId String?

  organizacion Organizacion @relation(fields: [organizacionId], references: [id], onDelete: Cascade)
  afiliado     Afiliado     @relation(fields: [afiliadoId], references: [id], onDelete: Cascade)

  @@index([organizacionId, afiliadoId, activa])
}

// Resumen mensual de cobertura por afiliado y período (materializado)
model CoberturaAfiliadoPeriodo {
  id              BigInt   @id @default(autoincrement())
  organizacionId  String
  afiliadoId      BigInt
  periodo         String   // "YYYY-MM"

  j17Esperado     Decimal  @db.Decimal(12, 2)  // mínimo vigente o cuota 04
  j17Cobrado      Decimal  @db.Decimal(12, 2)
  j22Esperado     Decimal  @db.Decimal(12, 2)
  j22Cobrado      Decimal  @db.Decimal(12, 2)
  j38Esperado     Decimal  @db.Decimal(12, 2)
  j38Cobrado      Decimal  @db.Decimal(12, 2)
  k16Esperado     Decimal  @db.Decimal(12, 2)
  k16Cobrado      Decimal  @db.Decimal(12, 2)

  cubierto        Boolean
  deudaTotal      Decimal  @db.Decimal(12, 2)
  calculadoEn     DateTime @default(now())

  organizacion Organizacion @relation(fields: [organizacionId], references: [id], onDelete: Cascade)
  afiliado     Afiliado     @relation(fields: [afiliadoId], references: [id], onDelete: Cascade)

  @@unique([organizacionId, afiliadoId, periodo])
  @@index([organizacionId, periodo, cubierto])
}

// Corrida de cierre mensual (audita el proceso y persiste el informe)
model CierreMensual {
  id              BigInt   @id @default(autoincrement())
  organizacionId  String
  periodo         String   // "YYYY-MM" evaluado
  estado          String   // "en_curso" | "completado" | "fallido" | "dry_run"
  iniciadoEn      DateTime @default(now())
  finalizadoEn    DateTime?
  iniciadoPorId   String?  // null si fue automático

  totalSuspendidos      Int @default(0)
  totalRehabilitados    Int @default(0)
  totalPadronesMarcados Int @default(0)
  totalExcluidos        Int @default(0)

  resumen        Json?     // detalle estructurado
  errorMensaje   String?

  organizacion Organizacion @relation(fields: [organizacionId], references: [id], onDelete: Cascade)

  @@unique([organizacionId, periodo, estado]) // un completado por período
  @@index([organizacionId, periodo])
}

// Campos a agregar al Padron existente:
//   ultimoPeriodoConCobranza  String?  // "YYYY-MM"
//   ultimoMontoCobrado        Decimal? @db.Decimal(12, 2)
//   actualizadoCoberturaEn    DateTime?
```

### 6.3 Cambios en modelos existentes

**`Afiliado`**: el campo `estado` (hoy string libre) se formaliza a enum:
`activo | suspendido_provisorio | suspendido_firme | baja | baja_incobrable`.
Migración: dejar string pero documentar valores válidos; validar en
service layer; reservar pasaje a enum Prisma para una segunda etapa.

**`Padron`**: agregar `ultimoPeriodoConCobranza`, `ultimoMontoCobrado` y
`actualizadoCoberturaEn`. El job de procesamiento de TXT los mantiene.

## 7. Componentes a construir

### 7.1 Backend

| Componente | Responsabilidad |
|------------|-----------------|
| `ParametrosService` | CRUD con vigencias para J17_MINIMO y J17_CUOTA_04. API: `getVigente(orgId, fecha)`. |
| `CoberturaService` | Calcula cobertura para `(afiliado, período)` con la fórmula 5.1. Materializa en `CoberturaAfiliadoPeriodo`. |
| `SuspensionService` | API: `suspender(afiliadoId, periodoOrigen)`, `rehabilitar(afiliadoId, motivo)`, `revertir(afiliadoId)`. Aplica reglas 5.3–5.4. |
| `GateService` | API: `puedeUsarCoseguro(afiliadoId, fecha)`, `puedeReintegrar(afiliadoId, fecha)`, `puedeOrdenCredito(afiliadoId)`, `puedeComprarEnComercio(afiliadoId)`. Aplica 3.2. |
| `CierreMensualService` | Orquesta el proceso 4. Soporta `dryRun`. Persiste `CierreMensual`. |
| `CierreMensualScheduler` | Cron diario que: día 10 → ejecuta cierre. Día 16 → convierte provisorias a firmes. |
| `TxtRetornoProcessor` (ya existe parcial) | Al actualizar cobranza, dispara recálculo de cobertura del período afectado + rehabilitación automática si corresponde. |
| `CajaPagoHook` | Al aplicar pago, dispara recálculo de cobertura y rehabilitación si corresponde. |
| `BajaService` | Bloquea baja si hay deuda. Habilita baja con incobrable sólo a ADMIN. |
| `ExcepcionService` | CRUD de excepciones ADMIN. Sólo accesible a roles ADMIN/SUPERADMIN. |
| Endpoint `GET /dashboard/stats` (ya creado) | Sumar a futuro: cantidad de suspendidos, deuda total acumulada, padrones inactivos. |

### 7.2 Frontend

| Pantalla | Función |
|----------|---------|
| `/parametros/j17` | ADMIN: ver vigencias, crear nueva. |
| `/afiliados/[id]` (mejora) | Mostrar estado (activo/suspendido), cobertura últimos 6 meses como semáforo, deuda total, botón "Ver excepciones". |
| `/afiliados/[id]/excepciones` | ADMIN: gestionar excepciones de suspensión. |
| `/cierre-mensual` | ADMIN: lanzar dry-run, ver informes históricos, descargar PDF/CSV. |
| Lista de afiliados (filtro) | Filtrar por estado: activos / suspendidos / con deuda > X. |

## 8. Estado de implementación (actualizado 2026-06-04)

Resumen del avance, con corte al final del sprint de tab Estado. Se pausa
acá para definir el flujo de **generación de novedades**, que afecta cómo
se concluye el hook de caja (decisión 10' sobre `Obligacion.bloqueada`).

### Schema Prisma — Migraciones aplicadas

- `20260603213026_circuito_suspensiones`:
  - `ParametroJ17Minimo`, `ParametroJ17Cuota04` (vigencias).
  - `AfiliadoSuspension` (provisoria/firme/revertida/rehabilitada).
  - `AfiliadoExcepcionSuspension` (ADMIN/SUPERADMIN).
  - `CoberturaAfiliadoPeriodo` (resumen materializado por período).
  - `CierreMensual` (corridas auditadas + JSON detallado).
  - `Padron` extendido con `ultimoPeriodoCobranzaJ17`,
    `ultimoMontoCobradoJ17`, `evaluadoCoberturaEn`.
- `20260603213026_cobertura_por_concepto`:
  - `CoberturaAfiliadoPeriodo` con flags por concepto:
    `j17Cubierto`, `j22Cubierto`, `j38Cubierto`.

### Backend implementado

Módulo `suspensiones` en `backend/src/modulos/suspensiones/`:

| Pieza | Responsabilidad |
|---|---|
| `ParametrosService` | CRUD de J17 mínimo y cuota 04 con vigencias temporales. `getVigente(fecha)`. |
| `CoberturaService` | Calcula cobertura por (afiliado, período). Suma cobranza de `MovimientoAfiliado` por código. Persiste flags `j17/j22/j38Cubierto`. |
| `SuspensionesService` | Suspender, rehabilitar (exige `j17Cubierto`), revertir, convertir provisorias→firmes. |
| `ExcepcionesService` | CRUD de excepciones ADMIN/SUPERADMIN. Una activa por afiliado a la vez. |
| `CierreMensualService` | Día 10. Suspende sólo por J17. Soporta `dryRun`. Persiste informe JSON. Permite recálculo individual. |
| `GateService` | API para otros módulos. Coseguro = afiliado activo + cero deuda J22 + mes corriente cubierto. Idem colaterales con J38. Ordenes/comercios = afiliado activo. |
| `ObligacionesMensualesService` | Materialización ex-ante (decisión 19-23). Genera Obligacion + MovimientoAfiliado(débito) para J22, J38, J17-04 del período objetivo. Idempotente. |

Módulo `nomina` en `backend/src/modulos/nomina/`:

| Pieza | Responsabilidad |
|---|---|
| `parsers/computos.parser.ts` | Parser TXT Cómputos San Juan (header 46 chars + bloques 12 chars). |
| `ImportarCobranzaService` | Preview valida padrones existentes en BD. Confirmar crea `LoteNomina` + `NominaDetalle` + `MovimientoAfiliado(origen=nomina)`. Dispara recálculo de cobertura + rehabilitación automática si saldó J17. |

Módulo `coseguro`:

| Pieza | Responsabilidad |
|---|---|
| `CoseguroReglasController` (existente) | ABM de `ReglaPrecioCoseguro` (precio J22 con vigencias). |
| `CoseguroMarcadoInicialController` (nuevo) | `POST /coseguro/marcar-iniciales-desde-movimientos`. Detecta afiliados con J22 cobrado por nómina y los marca como `CoseguroAfiliado.estado='activo'`. Idempotente. |

### Frontend implementado

| Ruta | Función |
|---|---|
| `/parametros` | Vigencias J17 mínimo, cuota 04 y **precio J22** (nuevo panel). |
| `/cierre-mensual` | Lanzador dry-run / real, historial. Card click → detalle. |
| `/cierre-mensual/[id]` | Detalle con KPIs, 4 tablas exportables a CSV (suspendidos, rehabilitados, excluidos, padrones marcados). |
| `/nomina/importar-cobranza` | Upload TXT con dropzone, preview con padrones faltantes, confirmar. |
| `/admin/materializar-mes` | Materialización ex-ante J22/J38/J17-04 con dry-run + setup inicial de coseguros. |
| `/afiliados/[id]/estado` | **Refactor completo**: 3 semáforos por capa (afiliado/coseguro/colaterales), KPIs de deuda, lista de obligaciones abiertas con CTA a caja, semáforo del histórico con mini-badges J17/J22/J38, gestión de suspensiones y excepciones. |
| `/afiliados/[id]/cuenta-corriente` | Cuenta corriente embebida del afiliado. |
| `/movimientos` | Cuenta corriente global con buscador (mismo componente). |

Servicio `frontend/src/servicios/suspensiones.ts` tipado completo
(parámetros, cobertura, suspensiones, excepciones, cierre, materialización
ex-ante, reglas J22, marcado inicial de coseguros, obligaciones pendientes).

### Decisiones de modelo confirmadas

24 decisiones cerradas en 3 bloques (ver sección 9). Pendientes 11 y 12:
acumulación de arrastres al envío de novedades (depende del flujo de
generación de novedades).

### Pendiente para cerrar Fase 1

1. **Flujo de generación de novedades** (en análisis con el usuario):
   - Define cómo se construye el archivo a enviar a Cómputos/ANSES/PP.
   - Define el momento exacto en que `Obligacion.bloqueada = true` (al
     incluir en el archivo) y cuándo se desbloquea (al conciliar TXT).
   - Define si J22/J38 acumulan arrastres como K16 (decisión 11).
   - Define cuándo se materializa J17-04 (decisión 12).
   - Sin esto, el **hook de caja** queda a medias porque no sabe respetar
     el flag de bloqueo.
2. **Hook de caja**: al aplicar pago a obligación → MovimientoAfiliado
   (origen=pago_caja) → recálculo de cobertura → rehabilitación si saldó
   J17. Bloqueado hasta cerrar la lógica de novedades.
3. **`CupoService`**: cupo = J17_padrón_promedio × 7.5 menos saldo K16
   vigente. Endpoint + tarjeta en tab Estado.
4. **Cron scheduler** (`@nestjs/schedule` ya instalado):
   - Día 10: `CierreMensualService.ejecutar({dryRun:false})`.
   - Día 16: `SuspensionesService.convertirProvisoriasAFirmes()`.
   - Último día hábil del mes M-1: `ObligacionesMensualesService.materializarExAnte(periodo M)`.
5. **Gates integrados en consumidores**: importar `GateService.ensureOrThrow(...)` en módulos coseguro, reintegros, ordenes, comercios. Hoy `GateService` existe pero no está siendo invocado.
6. **Baja automática coseguro/colaterales** a los 3 meses consecutivos sin J22/J38 cobrado (decisiones 15-16).
7. **Exportación PDF** del informe de cierre (CSV ya está).
8. **Formalizar enum** de `Afiliado.estado` en Prisma (hoy es string libre).
9. **UI para regla J38** (precios por tramo de cantidad de colaterales) en `/parametros`.

### Cosas que se hicieron y no estaban en el plan original

- Fix retroactivo `fix-cobertura-abril.ts` para recuperar de bugs iniciales (vigencias incorrectas + K16 cobrado=0).
- Refactor del importador para no sobreescribir `Padron.j17/j22/j38/k16`. Ahora la cobranza vive sólo en `MovimientoAfiliado`. `Padron.k16` representa "cuota actual del préstamo a descontar" (esperado), no lo cobrado.
- Marcado inicial de coseguros desde movimientos (no estaba previsto pero era necesario para arrancar con datos reales).
- Panel J22 en `/parametros` (no estaba previsto, complementa el flujo).
- Materialización ex-ante también genera `MovimientoAfiliado(débito)` para que la deuda sea visible en la cuenta corriente desde el primer día.

### Tareas operativas pendientes para el operador

1. Cargar regla J22 (precio vigente del coseguro) en `/parametros`.
2. Ejecutar **"Marcar coseguros iniciales"** en `/admin/materializar-mes` (banner amarillo) — una sola vez, idempotente.
3. Materializar el próximo período (ej. `2026-07`) en `/admin/materializar-mes`.
4. Cuando llegue el TXT del período `2026-05`, importarlo en `/nomina/importar-cobranza`.
5. **No correr cierre real todavía** hasta tener la lógica de novedades y el hook de caja: las suspensiones serían correctas pero los afiliados no podrían pagar la deuda por caja (falta el hook).

### Próximo paso de la conversación

Definir con el usuario el **flujo de generación de novedades**:
- Estructura del archivo TXT que UDAP envía a Cómputos / ANSES / PP.
- Cómo decide qué obligaciones incluir (filtro por estado, período).
- Cómo decide los montos (J22/J38 valor fijo, J17 alta/baja, K16 con acumulación de arrastres).
- Cuándo se marca `Obligacion.bloqueada=true` y cuándo se desbloquea.
- Idempotencia del envío + reversiones cuando hay errores.

Una vez clarificado, se cierra Fase 1 con: hook de caja, scheduler, gates integrados en consumidores, baja automática.

## 9. Plan de implementación original (sprints sugeridos)

### Sprint 1 — Cimientos parametrizables (1 semana)

- [ ] Modelos `ParametroJ17Minimo`, `ParametroJ17Cuota04` (migración Prisma).
- [ ] `ParametrosService` + endpoints REST + UI mínima `/parametros`.
- [ ] Seed con valor inicial UDAP (mínimo $25.000, cuota 04 $70.000).
- [ ] Tests unitarios `getVigente(fecha)`.

### Sprint 2 — Cobertura y deuda (1-2 semanas)

- [ ] Modelo `CoberturaAfiliadoPeriodo` + campos extra en `Padron`.
- [ ] `CoberturaService.calcular(afiliadoId, periodo)`.
- [ ] Recálculo automático al procesar TXT (hook en módulo `nomina`).
- [ ] Recálculo al cobrar en caja (hook en módulo `caja`).
- [ ] Job: marcar padrones inactivos (últimos 3 meses sin cobrar).
- [ ] Generación de `Obligacion` por la diferencia `esperado − cobrado` con
      `concepto = J17/J22/J38/K16` correspondiente.
- [ ] Tests: cobertura total, parcial, cero; deuda calculada.

### Sprint 3 — Suspensión / rehabilitación / excepciones (1-2 semanas)

- [ ] Modelos `AfiliadoSuspension`, `AfiliadoExcepcionSuspension`.
- [ ] `SuspensionService`, `ExcepcionService`.
- [ ] Hook de rehabilitación automática (TXT + caja).
- [ ] Formalizar estados de `Afiliado.estado` con validación.
- [ ] UI: panel de excepciones, badge de estado en afiliado, semáforo de
      cobertura.
- [ ] Tests: ciclo completo suspender → pagar caja → rehabilitar.

### Sprint 4 — Cierre mensual + gates (1-2 semanas)

- [ ] Modelo `CierreMensual`.
- [ ] `CierreMensualService` con soporte `dryRun`.
- [ ] Scheduler `@Cron` para día 10 y día 16.
- [ ] Informe descargable PDF/CSV.
- [ ] `GateService` integrado en módulos:
  - `coseguro` (uso, prestaciones).
  - `reintegros` (carga/aprobación).
  - `ordenes` (alta de nueva orden de crédito).
  - `comercios` (validación de credencial).
- [ ] Tests: cierre completo, gates por servicio.

### Sprint 5 — Baja + KPIs en dashboard (3-5 días)

- [ ] `BajaService` con bloqueo por deuda + baja incobrable.
- [ ] Endpoint dashboard: agregar suspendidos, deuda total, padrones
      inactivos.
- [ ] UI dashboard: KPIs nuevos.
- [ ] Filtros de afiliados por estado y por deuda.

### Fase 2 — Contabilización retroactiva (fuera de este alcance)

- Mapeo de conceptos a cuentas contables.
- Asientos generados retroactivamente sobre las obligaciones ya cargadas.
- Tratamiento contable de baja con incobrable (pérdida).

## 9. Decisiones tomadas (registro)

### Bloque 1 — Modelo original (2026-06-03)

| # | Decisión | Fecha |
|---|----------|-------|
| 1 | Mínimo J17 parametrizable con historia, hoy $25.000. | 2026-06-03 |
| 2 | Cuota J17 de 04 parametrizable con historia, hoy $70.000. | 2026-06-03 |
| 3 | Suspensiones se ejecutan automáticamente el día 10. | 2026-06-03 |
| 4 | Umbral de mora = 1 período sin cobertura. | 2026-06-03 |
| 5 | Ventana de gracia 5 días; el afiliado figura suspendido igual. | 2026-06-03 |
| 6 | Dry-run disponible desde la primera versión. | 2026-06-03 |
| 7 | Excepciones manuales sin categorías cerradas; sólo ADMIN/SUPERADMIN. | 2026-06-03 |
| 8 | Las suspensiones **no** se informan a Cómputos. | 2026-06-03 |
| 9 | Rehabilitación exige saldar el período en mora (no alcanza con período siguiente OK). | 2026-06-03 |
| 11 | Cobertura parcial → suspensión + deuda por la diferencia. | 2026-06-03 |
| 12 | Suma de J17 cobrados entre padrones se compara con el mínimo (no por padrón individual). | 2026-06-03 |
| 13 | Para pagar y rehabilitarse, sólo cuentan períodos vencidos (los por vencer no). | 2026-06-03 |
| 14 | Baja con deuda bloqueada salvo "baja incobrable" (sólo ADMIN). | 2026-06-03 |

### Bloque 3 — Generación de novedades (2026-06-04)

Cierra el modelo de comunicación a Cómputos / ANSES.

| # | Decisión |
|---|----------|
| 24 | Generador procesa **sólo padrones con sistema=ESC** para archivo Cómputos. Jubilados van por archivo ANSES separado (sólo J17, no incluido en esta fase). PP recibe archivo retorno del sistema interno UDAP. 04 no genera archivo. |
| 25 | Se incluyen **sólo cambios** desde el envío anterior (deltas), excepto **K16 que siempre va** mientras haya saldo o cuota nueva. |
| 26 | J17 alta = `200` literal. Bajas = `0` en todos los códigos. |
| 27 | K16 = suma de cuotas del mes M + saldos arrastrados de meses anteriores. Trazabilidad mediante `NovedadK16Detalle` (por orden/cuota/componente). |
| 28 | Una línea por padrón, **80 chars fijos**, indicador `B3` al final, sin cabecera ni pie. Hasta 4 bloques de código (J17, J22, J38, K16). |
| 29 | Ventana de captura: día 11 mes M-1 → día 10 mes M. Lo posterior va al mes M+1. |
| 30 | Alta+baja dentro del mismo período → no se informa. En períodos distintos → cada cambio se informa. |
| 31 | Estados del lote: `borrador` → `enviado` (botón con confirm) → `parcialmente_conciliado` → `conciliado` / `anulado`. Al pasar a "enviado" se bloquean todas las `Obligacion` referenciadas (`bloqueada=true`). |
| 32 | Generación obligatoria mes a mes siempre que haya cambios o K16 a informar. |
| 33 | Toda baja de padrón (completo) o de código (J22/J38) se informa a Cómputos, sin importar el origen (manual o automático). El motivo queda trazable. |
| 34 | Tabla `BajaInformable` registra cada baja con motivo. El operador puede ver el historial completo desde la ficha del afiliado. |
| 35 | El cierre mensual, al marcar padrón inactivo por 3 meses sin cobranza, además de `Padron.activo=false` crea una `BajaInformable(PADRON_COMPLETO, cierre_inactivo_3m)`. |
| 36 | La baja automática del coseguro a 3 meses sin J22 crea `BajaInformable(J22, baja_auto_coseguro_3m_sin_j22)` + `(J38, ...)` si corresponde. |
| 37 | Una `BajaInformable` puede cancelarse mientras esté en estado `pendiente`. Cancelación auditada. |
| 38 | Jubilados (sistema JUV/JUB): ANSES sólo descuenta **J17**. J22/J38 se materializan y se cobran por caja/débito. Altas actualmente no se generan, bajas se generan manualmente. |
| 39 | Jubilados nuevos: para adherirse a UDAP, **deben suscribir débito automático** (proceso manual). |
| 40 | Mecanismo de corrección: borrador puede anularse y regenerarse sin marca. Después de "enviado", anular es acción ADMIN con motivo. Las obligaciones se desbloquean al anular. Si Cómputos efectivamente cobró, el TXT de retorno generará crédito a favor (`CreditoAfiliado`). |

#### Modelo de datos del bloque novedades

```prisma
model NovedadLote {
  id              BigInt    @id @default(autoincrement())
  organizacionId  String
  periodo         String    // YYYY-MM
  canal           String    // "ESC" (futuros: "ANSES", "PP")
  estado          String    @default("borrador")
  // borrador | enviado | parcialmente_conciliado | conciliado | anulado

  generadoEn      DateTime  @default(now())
  generadoPorId   String?
  enviadoEn       DateTime?
  enviadoPorId    String?
  conciliadoEn    DateTime?
  anuladoEn       DateTime?
  anuladoPorId    String?
  motivoAnulacion String?

  archivoNombre    String?
  archivoHash      String?
  archivoContenido String?   @db.Text  // .txt snapshot

  totalLineas        Int     @default(0)
  totalAfiliados     Int     @default(0)
  totalJ22           Decimal @default(0) @db.Decimal(14, 2)
  totalJ38           Decimal @default(0) @db.Decimal(14, 2)
  totalK16           Decimal @default(0) @db.Decimal(14, 2)

  items          NovedadLoteItem[]
  obligacionesBloqueadas NovedadLoteObligacion[]
  bajasInformadas BajaInformable[]

  organizacion Organizacion @relation(fields: [organizacionId], references: [id], onDelete: Cascade)

  @@index([organizacionId, periodo, canal, estado])
}

model NovedadLoteItem {
  id          BigInt   @id @default(autoincrement())
  loteId      BigInt
  padronId    BigInt
  afiliadoId  BigInt
  centroSnapshot Int?
  padronSnapshot String

  lineaCompleta String  // 80 chars literal (auditoría inmutable)
  tipoMovimiento String // "alta" | "baja" | "mixto" | "k16_solo"
  indicador   String   @default("B3")

  // Null = el bloque no aparece. 0 = bloque baja. >0 = bloque alta con monto.
  valorJ17    Decimal? @db.Decimal(12, 2)
  valorJ22    Decimal? @db.Decimal(12, 2)
  valorJ38    Decimal? @db.Decimal(12, 2)
  valorK16    Decimal? @db.Decimal(12, 2)

  lote        NovedadLote @relation(fields: [loteId], references: [id], onDelete: Cascade)
  padron      Padron      @relation(fields: [padronId], references: [id])
  afiliado    Afiliado    @relation(fields: [afiliadoId], references: [id])
  k16Detalle  NovedadK16Detalle[]

  @@index([loteId, padronId])
}

model NovedadK16Detalle {
  id            BigInt   @id @default(autoincrement())
  loteItemId    BigInt
  ordenId       BigInt?
  cuotaId       BigInt?
  componente    String   // "cuota_mes" | "saldo_arrastrado" | "interes"
  monto         Decimal  @db.Decimal(12, 2)
  periodoOrigen String?  // del que viene el arrastre

  loteItem      NovedadLoteItem @relation(fields: [loteItemId], references: [id], onDelete: Cascade)
}

model NovedadLoteObligacion {
  id             BigInt   @id @default(autoincrement())
  loteId         BigInt
  obligacionId   BigInt
  desbloqueadaEn DateTime?

  lote         NovedadLote @relation(fields: [loteId], references: [id], onDelete: Cascade)
  obligacion   Obligacion  @relation(fields: [obligacionId], references: [id])

  @@unique([loteId, obligacionId])
}

model BajaInformable {
  id              BigInt    @id @default(autoincrement())
  organizacionId  String
  padronId        BigInt
  codigo          String    // "PADRON_COMPLETO" | "J17" | "J22" | "J38" | "K16"
  motivo          String    // "manual_operador" | "cierre_inactivo_3m" | "baja_auto_coseguro_3m_sin_j22" | ...
  observacion     String?
  fechaSolicitada DateTime  @default(now())
  solicitadoPorId String?

  estado          String    @default("pendiente")
  // pendiente | informada | cancelada

  loteEnvioId     BigInt?
  fechaInformada  DateTime?
  fechaCancelada  DateTime?
  canceladaPorId  String?
  motivoCancelacion String?

  organizacion Organizacion @relation(fields: [organizacionId], references: [id], onDelete: Cascade)
  padron       Padron       @relation(fields: [padronId], references: [id], onDelete: Cascade)
  lote         NovedadLote? @relation(fields: [loteEnvioId], references: [id])

  @@index([organizacionId, estado])
  @@index([padronId, codigo])
}
```

> **Pendiente decidir**: tabla paralela `AltaInformable` con la misma estructura, o reutilizar `BajaInformable` con un campo `tipoAccion: 'alta' | 'baja'`. Lo evaluamos cuando arranquemos a codear.

### Bloque 2 — Modelo de gates separados (2026-06-04, REVISA varias del bloque 1)

Este bloque introduce **gates por concepto**, no un único estado agregado:
hay tres capas independientes (afiliado / coseguro / colaterales) y un
mecanismo separado para K16 vía cupo.

| # | Decisión | Estado |
|---|----------|--------|
| 1' | **Suspensión del afiliado depende SÓLO de J17** (suma agregada de padrones). El cierre del día 10 evalúa únicamente J17 para suspender. | ✅ |
| 2' | **Coseguro = gate dinámico por J22**, no requiere persistencia de suspensión. Se evalúa al momento del consumo. | ✅ |
| 3' | **Si J22 no se cobró → titular Y colaterales** suspendidos del coseguro/reintegros. | ✅ |
| 4' | **Si J22 OK pero J38 no se cobró → sólo colaterales** suspendidos (titular sigue con coseguro). | ✅ |
| 5' | **K16 NO genera suspensión.** Revierte la decisión 10 del bloque 1. K16 actúa sobre el cupo, no sobre el estado. | ✅ |
| 6' | **Cupo del padrón = J17_padrón_cobrado × 7.5** (porque J17 es 2% del sueldo, queremos 15%). | ✅ |
| 7' | **Cupo del afiliado = Σ cupo_padrón_disponible**. Se usa promedio últimos 3 meses de J17 cobrado (o el último si no hay 3). | ✅ |
| 8' | Suspensión del afiliado bloquea: comercios, órdenes de crédito, coseguro y servicios sociales (camping, etc.). | ✅ |
| 9' | Reintegros requieren: afiliado activo + J22 cubierto del período de la prestación. | ✅ |
| 10' | **K16 sí materializa Obligacion** cobrable por cualquier medio. Tiene flag `bloqueada=true` cuando se incluye en envío a descuento; se desbloquea cuando se concilia el TXT. | ✅ |
| 13' | Pagar el J22 del mes N+1 **no** cancela la deuda J22 del mes N. Son obligaciones independientes. | ✅ |
| 14' | **Gate de coseguro requiere CERO obligaciones J22 abiertas + J22 del mes corriente cubierto.** Si hay deuda histórica, no hay coseguro aunque el mes corriente esté cobrado. | ✅ |
| 15' | **3 meses consecutivos sin cobrar J22** → baja automática del coseguro (parametrizable). Se manda novedad J22=0/J38=0 a Cómputos. Las obligaciones quedan abiertas. | ✅ |
| 16' | **3 meses consecutivos sin cobrar J38** → baja automática de colaterales (parametrizable). | ✅ |
| 17' | Prestaciones consumidas en un mes sin J22 cobrado **NO se reintegran retroactivamente** aunque después se pague la deuda. | ✅ |
| 18' | Reincorporación al coseguro tras baja automática: pagar **toda la deuda acumulada** + solicitar re-alta. | ✅ |

### Implicancias del bloque 2 sobre la implementación actual

- `CoberturaAfiliadoPeriodo.cubierto` (booleano agregado) deja de tener
  sentido como tal: se reemplaza por evaluación por código (j17Cubierto,
  j22Cubierto, j38Cubierto) o se calcula como derivado.
- `CierreMensualService` debe suspender SÓLO por J17 (no por la deuda
  agregada de los 4 códigos).
- `GateService` se refina: cada gate hace su propia consulta a
  obligaciones abiertas + cobertura del mes corriente.
- Se agregan: `CupoService`, `BajaAutomaticaCoseguroService`.
- Modelo de Obligación: las de J17 y J22/J38 se materializan al cierre del
  día 10 (cuando se sabe lo no cobrado). Las de K16 se materializan al
  generar la novedad (cuando se decide lo que se va a enviar a descuento).

## 10. Preguntas abiertas

| # | Punto | Notas |
|---|---|---|
| 11 | ¿J22 / J38 / J17-04 se acumulan al envío de novedades como K16? | Pendiente: se resuelve cuando armemos el módulo de generación de novedades. |
| 12 | ¿La cuota J17-04 se materializa al inicio del mes (con vto. al 10) o en otro momento? | Idem. |
| 19 | Cuota J22/J38 de jubilados (y resto de afiliados con coseguro): ¿se materializa **ex-ante** el último día hábil del mes anterior, o post-hoc al recibir el TXT? | **En análisis** (2026-06-04, ver Sección 11). |
| 20 | Jubilados pagando todo por caja vs descontando por ANSES: política a definir. | **En análisis** (2026-06-04, ver Sección 11). |

## 11. Materialización ex-ante de obligaciones (2026-06-04, CONFIRMADO)

### Contexto

- Hoy los jubilados pagan **todo por caja**: administrativo emite orden
  manual con el monto del mes y el afiliado abona.
- UDAP quiere cambiar esto: descuento por ANSES como vía primaria también
  para jubilados, dejando la caja **sólo para coseguro y colaterales**
  (J22, J38), no para J17.
- Decisión: materializar las obligaciones J22 y J38 del mes M el **último
  día hábil del mes M-1**, para todos los afiliados con coseguro activo
  (Activos, PP, Jubilados, 04 — sin distinción de tipo).

### Decisiones confirmadas (Bloque 3)

| # | Decisión | Estado |
|---|----------|--------|
| 19 | **J22 y J38 se materializan ex-ante** el último día hábil del mes M-1, para TODOS los afiliados con `CoseguroAfiliado.estado='activo'`. | ✅ |
| 20 | **J17 de los 04 también se materializa ex-ante** (cuota fija), vencimiento día 10. | ✅ |
| 21 | **Jubilados pasan a descontar J17/K16 por ANSES**. Mismo flujo que Activos con Cómputos. Caja queda como vía secundaria de pago para todos. | ✅ |
| 22 | **Vencimiento** de obligaciones ex-ante: día 10 del mes corriente (alineado con cierre). | ✅ |
| 23 | **Doble cobro detectado** (pagó caja + descontó nómina) → genera `CreditoAfiliado` (saldo a favor para futuros períodos). | ✅ |

### Comportamiento de las obligaciones ex-ante

Dos vías de cobro conviven y ambas cancelan la misma obligación:

| Vía | Cuándo | Cómo cancela |
|---|---|---|
| **Nómina** (Cómputos / ANSES / PP) | TXT llega ~día 6-7 del M+1 | Procesa TXT → `MovimientoAfiliado(origen=nomina, periodoContable=M)` → cancela obligación |
| **Caja** | Cualquier día del mes M | Operador cobra → `MovimientoAfiliado(origen=pago_caja, periodoContable=M)` → cancela obligación |

Para evitar duplicar el cobro, al **generar el archivo de novedades del
mes M+1**, el sistema excluye/ajusta J22 según el estado de la obligación
del mes M:

```
Para cada afiliado con coseguro activo:
  obligacion = obligación J22 del mes M
  si saldo(obligacion) = 0:
    NO incluir J22 en la novedad de M+1
  si saldo(obligacion) > 0:
    incluir J22 con monto = saldo (no acumula como K16, queda como deuda histórica)
```

### Cuándo se materializa cada concepto (cuadro consolidado)

| Concepto | Quién | Cuándo se materializa la Obligacion | Vencimiento |
|---|---|---|---|
| **J17** Activos/Jub/PP | — | Sólo si quedó **deuda contra mínimo** al cierre real del día 10 (post-hoc) | Día 10 del mes evaluado |
| **J17** 04 | Cuota fija parametrizable | Último día hábil del M-1 (**ex-ante**) | Día 10 del mes M |
| **J22** | Todos con coseguro activo | Último día hábil del M-1 (**ex-ante**) | Día 10 del mes M |
| **J38** | Todos con colaterales activos | Último día hábil del M-1 (**ex-ante**) | Día 10 del mes M |
| **K16** | Con préstamo vigente | Al generar la novedad enviada a Cómputos (incluye arrastres). `bloqueada=true` mientras está en proceso de descuento; se desbloquea al conciliar TXT | Según cuota del préstamo |

### Beneficios

1. Adiós a las "órdenes manuales para jubilados": el sistema las genera.
2. Visibilidad temprana: afiliado puede pagar J22/J38 desde el primer día
   del mes.
3. Modelo unificado entre tipos de afiliado.
4. Jubilados se incorporan al flujo automatizado de descuento (vía ANSES).
