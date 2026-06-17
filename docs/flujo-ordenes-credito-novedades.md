# Flujo: órdenes de crédito, obligaciones y novedades (J17 / J22 / J38 / K16)

Guía corta para entender cómo el sistema genera **obligaciones** mensuales y
cómo esas obligaciones se informan como **novedades** a los canales de
descuento (Cómputos / ANSES).

---

## 1. Conceptos (códigos de descuento)

| Código | Qué es | Origen del importe |
|--------|--------|--------------------|
| **J17** | Cuota societaria (2 %) | Padrón del afiliado (alta/baja del padrón) |
| **J22** | Coseguro | Estado de coseguro del afiliado |
| **J38** | Colaterales | Colaterales activos del afiliado |
| **K16** | Cuotas de crédito | Órdenes de crédito (una cuota por mes) |

Código interno del concepto K16 = `ORDEN_CREDITO`
(`novedades.service.ts` → `CONCEPTOS_CODIGO.K16`).

---

## 2. Obligaciones (la "deuda" mensual del afiliado)

Todo lo que el afiliado debe en un período es una fila en **`Obligacion`**:
`{ afiliadoId, padronId, conceptoId, periodo (YYYY-MM), importe, saldo, estado, bloqueada }`.

- **J17 / J22 / J38**: se materializan mes a mes según el estado del afiliado
  (padrón activo, coseguro activo, colaterales activos).
- **K16**: se materializa **al crear la orden de crédito**, *una obligación por
  cuota* (ver §3).

`estado`: `pendiente` → `parcialmente_pagada` → `pagada` (o `anulada`).
Las obligaciones se cancelan vía **caja** o **importación de cobranza**
(cómputos / ANSES).

---

## 3. Órdenes de crédito → obligaciones K16

`ordenes.service.ts` → `crearOrden`:

1. Valida cupo del afiliado (`CupoService.asegurarCupoSuficiente`).
2. Por **cada cuota** de la orden crea **una `Obligacion`**:
   - `concepto = ORDEN_CREDITO` (K16)
   - `periodo = cuota.periodoVenc` (el mes en que vence esa cuota)
   - `estado = pendiente`, `bloqueada = false`
   - linkea `OrdenCreditoCuota.obligacionId`
3. Registra el débito en el movimiento del afiliado.

> Una orden en 3 cuotas = **3 obligaciones K16**, una por cada mes de
> vencimiento. No se materializan juntas en un solo mes.

---

## 4. Novedades = lo que se informa para descontar del sueldo

Una **novedad** (lote) es el archivo/registro que se manda a **Cómputos** o
**ANSES** para que descuenten del haber del afiliado. Modelo
**operador-driven**: el operador carga manualmente las altas/bajas, y el K16 se
calcula solo.

### 4.1 Pendientes J17 / J22 / J38 (cargadas por hooks / operador)

Tabla **`NovedadPendiente`** (`novedades-pendientes.service.ts`):
`{ padronId, concepto (J17|J22|J38), destino (COMPUTOS|ANSES), tipo (ALTA|BAJA|...),
   periodoObjetivo, importe, estado (pendiente|enviada|conciliada) }`.

Se alimenta por **hooks** cuando cambia el estado del afiliado:

| Evento | Pendiente que emite |
|--------|---------------------|
| Alta de coseguro (`coseguro.service`) | **ALTA J22** (precio base vigente) |
| Baja de coseguro | **BAJA J22** |
| Cambio de colaterales (`colaterales.service`) | **ALTA/BAJA/MODIF J38** (delta) |
| Alta en padrón (`padrones.service`) | **ALTA J17** |
| Baja en padrón | **BAJA J17** |

Regla de destino: `COMPUTOS` admite J17/J22/J38; **`ANSES` sólo admite J17**
(`Destino ANSES sólo admite concepto J17`).
El alta J17 va a ANSES si el padrón tiene `numeroBeneficio`, si no a Cómputos.

> **Las importaciones masivas NO emiten pendientes** (cargan vía `tx` directo,
> esquivando los hooks): se asume que el estado inicial ya está informado.

### 4.2 K16 (calculado, no se carga a mano)

`novedades.service.ts` → al generar el borrador suma las obligaciones K16
abiertas con **`periodo <= período del lote`**:

- `periodo == lote` → **cuota del mes** (lo que toca descontar este mes).
- `periodo  < lote` → **saldo arrastrado** (cuota vieja que no se cobró antes).
- `periodo  > lote` → **se deja para su mes** (no se anticipa).

Sólo cuenta obligaciones `bloqueada=false`, `estado in (pendiente,
parcialmente_pagada)`, `saldo > 0`.

---

## 5. Generación del lote (`generarBorrador`)

Entrada: `{ periodo, canal }` (canal `ESC` → Cómputos, `ANSES`).

1. Mapea `canal → destino` (`CANAL_A_DESTINO`).
2. Toma las `NovedadPendiente` con `estado=pendiente`, `periodoObjetivo=periodo`,
   `destino=mapeo(canal)` → bloques **J17 / J22 / J38**.
3. Suma el **K16 calculado** (§4.2) → bloque **K16**.
4. Arma el lote en estado **borrador** (regenerable: si ya existe borrador para
   ese período/canal, lo limpia y rehace).

Al **enviar** (`marcarEnviado`): las pendientes pasan a `enviada` con `loteId`.
Al **anular**: se revierten a `pendiente`.

Estados del lote: `borrador` → `enviado` → `conciliado`.

---

## 6. Regla de período (clave)

> **Todo lo que se carga DESPUÉS del cierre del período de novedades va al
> período SIGUIENTE.** No es un día fijo del mes (puede ser el 7, el 9, el 12…).

`resolverPeriodoObjetivo` decide el `periodoObjetivo` de cada pendiente según el
estado del lote del período corriente:
- lote inexistente o en **borrador** → mes corriente.
- lote ya **enviado/conciliado** → mes siguiente.

---

## 7. Resumen del circuito

```
Orden de crédito ──crea──> Obligacion K16 (1 por cuota, por período)
Alta/baja coseguro ─hook─> NovedadPendiente J22
Cambio colaterales ─hook─> NovedadPendiente J38
Alta/baja padrón ──hook──> NovedadPendiente J17 (ANSES si numeroBeneficio, si no Cómputos)

generarBorrador(periodo, canal):
    J17/J22/J38  = NovedadPendiente (pendiente, periodoObjetivo=periodo, destino)
    K16          = Σ obligaciones ORDEN_CREDITO con periodo <= periodo del lote
    => Lote (borrador) -> enviar -> conciliar
```

## Archivos clave

- `backend/src/modulos/ordenes/ordenes.service.ts` — materializa K16.
- `backend/src/modulos/novedades/novedades.service.ts` — generación del lote + K16.
- `backend/src/modulos/novedades/novedades-pendientes.service.ts` — cola de J17/J22/J38.
- `backend/src/modulos/coseguro/coseguro.service.ts` — emite J22.
- `backend/src/modulos/colaterales/colaterales.service.ts` — emite J38.
- `backend/src/modulos/padrones/padrones.service.ts` — emite J17.
