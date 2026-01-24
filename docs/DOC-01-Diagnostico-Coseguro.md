# DOC-01 Diagnostico Coseguro

## Alcance y fuentes
Este documento resume estructura, reglas y flujos actuales del modulo de coseguro y colaterales.
Fuentes revisadas:
- `backend/prisma/schema.prisma`
- `backend/src/modulos/coseguro/coseguro.controller.ts`
- `backend/src/modulos/coseguro/coseguro.service.ts`
- `backend/src/modulos/coseguro/coseguro-reglas.controller.ts`
- `backend/src/modulos/coseguro/coseguro-reglas.service.ts`
- `backend/src/modulos/colaterales/colaterales.controller.ts`
- `backend/src/modulos/colaterales/colaterales.service.ts`
- `backend/src/modulos/colaterales/colaterales-calculo.service.ts`

## Inventario tecnico

### Tablas y campos clave (DB)
1) `CoseguroAfiliado`
- Campos: `id`, `organizacionId`, `afiliadoId` (unique), `fechaAlta`, `fechaBaja`, `estado` (default `activo`),
  `imputacionPadronIdCoseguro`, `imputacionPadronIdColaterales`
- FK: `organizacionId -> Organizacion`, `afiliadoId -> Afiliado`,
  `imputacionPadronIdCoseguro -> Padron` (relacion `CoseguroImputacion`),
  `imputacionPadronIdColaterales -> Padron` (relacion `ColateralesImputacion`)

2) `Colateral`
- Campos: `id`, `afiliadoId`, `coseguroId` (opcional), `parentescoId`, `nombre`, `dni`,
  `fechaNacimiento`, `activo` (default true), `esColateral` (default true)
- FK: `afiliadoId -> Afiliado`, `coseguroId -> CoseguroAfiliado`, `parentescoId -> Parentesco`
- Unique: `(afiliadoId, dni)`

3) `ReglaPrecioCoseguro`
- Campos: `id`, `organizacionId`, `vigenteDesde`, `vigenteHasta`, `precioBase`, `activo`
- FK: `organizacionId -> Organizacion`

4) `ReglaPrecioColateral`
- Campos: `id`, `organizacionId`, `parentescoId`, `cantidadDesde`, `cantidadHasta`, `vigenteDesde`, `vigenteHasta`,
  `precioTotal`, `activo`
- FK: `organizacionId -> Organizacion`, `parentescoId -> Parentesco`

5) `Parentesco`
- Campos: `id`, `organizacionId`, `codigo`, `descripcion`, `activo`
- FK: `organizacionId -> Organizacion`

6) `Afiliado`
- Campos clave para identidad: `id`, `organizacionId`, `dni`, `estado`
- Unique: `(organizacionId, dni)`

7) `Padron`
- Campos: `id`, `organizacionId`, `afiliadoId`, `activo`
- Campos economicos: `j22`, `j38` (imputaciones)
- Relaciones: `coseguroImputaciones`, `colateralesImputaciones`

### Modelos/entidades y asociaciones (codigo)
- `CoseguroAfiliado` 1:1 con `Afiliado` (unique en `afiliadoId`)
- `CoseguroAfiliado` 1:N con `Colateral`
- `Colateral` pertenece a `Afiliado` y opcionalmente a un `CoseguroAfiliado`
- `ReglaPrecioCoseguro` y `ReglaPrecioColateral` aplican por `organizacionId`
- `Padron` es el destino de imputacion para J22 (coseguro base) y J38 (colaterales)

### Endpoints existentes
**Coseguro**
- `GET /coseguro/precio?afiliadoId&fecha` (precio base J22)
- `GET /coseguro/afiliados/:afiliadoId` (panel coseguro: estado, padrones, precio)
- `POST /coseguro/upsert` (configurar estado y padron J22, con reasignacion)
- `POST /coseguro/afiliados/:afiliadoId/alta` (alta coseguro, novedad J22)
- `POST /coseguro/afiliados/:afiliadoId/baja` (baja coseguro, J22=0)
- `PATCH /coseguro/afiliados/:afiliadoId/modificar` (precio J22 manual)
- `GET /coseguro/:afiliadoId/precio` (compat)

**Reglas J22**
- `GET /coseguro/reglas`
- `POST /coseguro/reglas`
- `GET /coseguro/reglas/:id`
- `PATCH /coseguro/reglas/:id`
- `PATCH /coseguro/reglas/:id/estado`
- `DELETE /coseguro/reglas/:id`

**Colaterales (J38)**
- `GET /colaterales/parentescos`
- `GET /colaterales/padrones?afiliadoId=...`
- `GET /colaterales/precio?afiliadoId&fecha`
- `GET /colaterales/afiliados/:afiliadoId/colaterales`
- `POST /colaterales/afiliados/:afiliadoId/colaterales` (y compat POST /colaterales)
- `PATCH /colaterales/afiliados/:afiliadoId/colaterales/:colateralId`
- `DELETE /colaterales/afiliados/:afiliadoId/colaterales/:colateralId`
- `GET /colaterales/afiliados/:afiliadoId/imputacion`
- `POST /colaterales/afiliados/:afiliadoId/imputacion`
- `GET /colaterales/:afiliadoId/precio` (compat)

### Servicios que aplican reglas
**`CoseguroService`**
- Busca regla vigente J22 por fecha (`vigenteDesde`/`vigenteHasta`)
- Upsert con control de reasignacion de padron (conflicto 409 si no confirma)
- Alta/baja de coseguro genera novedades J22
- Modificacion manual de precio genera novedad J22

**`CoseguroReglasService`**
- Validacion de fechas (vigenteHasta >= vigenteDesde)
- CRUD de reglas J22

**`ColateralesService`**
- Validacion de DNI unico por afiliado
- Recalculo J38 y registro de novedades por alta/baja/modificacion
- Cambio de imputacion J38 con reglas de novedades segun total y estado de coseguro

**`ColateralesCalculoService`**
- Calcula total J38 por parentesco y cantidad, usando reglas vigentes
- Selecciona la regla de mayor `cantidadDesde` y mas reciente `vigenteDesde`

## Reglas de negocio actuales (mapa)

### Elegibilidad implicita
- No hay funcion unica de elegibilidad.
- Coseguro se considera activo cuando `CoseguroAfiliado.estado === 'activo'`.
- Colaterales solo suman si el coseguro del afiliado esta activo.

### Topes y consumos
- No existe tabla de consumos ni ventanas por periodo.
- J22/J38 son cargos fijos (por reglas vigentes), no consumos por evento.

### Identidad de persona (titular vs familiar)
- Titular: `Afiliado` identificado por `afiliadoId` (y `dni` como dato).
- Familiar/colateral: `Colateral` con `dni` string y `parentescoId`.
- En servicios se usa `afiliadoId`, no hay capa `PersonaRef`.

### Estados y bajas
- `CoseguroAfiliado.estado`: `activo` o `baja` (no hay `suspendido`).
- `Colateral.activo` controla participacion en J38.
- Borrado por defecto es soft delete en colaterales (`activo=false`), con opcion `hard=true`.
- No existe politica global de "no borrar y marcar SUSPENDIDO" para coseguro.

### Padrones y multiples padrones
- Se imputan J22 y J38 a `Padron` via `CoseguroAfiliado.imputacionPadronIdCoseguro` y `imputacionPadronIdColaterales`.
- Si no hay padron especifico, se usa el primer padron activo del afiliado.
- Reasignar padron J22 requiere confirmacion explicita.

### Sincronizacion / novedades
- Alta, baja y modificaciones de J22/J38 generan novedades por periodo.
- No hay borrado de coseguro; el flujo es baja con J22=0 y `estado='baja'`.

## Riesgos y deuda tecnica
- No hay estado `suspendido` ni regla de no borrar para coseguro (solo baja).
- No hay consumos ni topes por periodo: no aplica a reintegros sin agregar nuevas tablas.
- Falta capa de identidad `PersonaRef` (titular/familiar) uniforme.
- En `ColateralesCalculoService` la consulta a `colateral` no filtra por `organizacionId` (se filtra solo por `afiliadoId`).
- No hay validacion de padron para colaterales en el calculo (solo en cambio de imputacion).

## Checklist solicitado (estado)
- [x] Tabla `coseguroAfiliado` localizada (en schema)
- [x] Claves y persona: titular por `afiliadoId`/`dni`, familiar por `colateral.dni`
- [x] Activo/baja confirmado; no hay `suspendido`
- [x] Regla no borrar: no existe para coseguro; colateral soft delete por defecto
- [x] Asociacion a padrones: `imputacionPadronIdCoseguro` y `imputacionPadronIdColaterales`
- [x] Consumos: no hay tablas ni tracking de consumos
- [x] Ventanas por periodo: solo vigencias de reglas, no consumos por ventana
