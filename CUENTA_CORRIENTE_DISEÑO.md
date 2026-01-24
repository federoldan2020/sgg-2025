# Diseño de Cuenta Corriente de Afiliados

## 📋 Principios Fundamentales

### 1. Naturaleza de los Movimientos

**DÉBITOS** (el afiliado debe):
- ✅ **Órdenes de crédito**: Cuando se genera una orden, crea DÉBITOS por cada cuota
- ✅ **Descuentos de nómina**: Cuando se procesa un descuento, crea DÉBITO
- ✅ **Obligaciones directas**: Deudas directas del afiliado
- ✅ **Ajustes manuales (débito)**: Correcciones que aumentan la deuda

**CRÉDITOS** (el afiliado paga):
- ✅ **Pagos en caja**: Cuando el afiliado paga en caja, crea CRÉDITOS
- ✅ **Aplicaciones de nómina**: Cuando se descuenta de nómina (ya está como débito, no necesita crédito)
- ✅ **Ajustes manuales (crédito)**: Correcciones que disminuyen la deuda

### 2. Fechas de los Movimientos

- ✅ **Fecha física**: Todos los movimientos usan la fecha en que realmente ocurrieron
  - Pagos → fecha del pago físico
  - Descuentos → fecha del descuento
  - Órdenes → fecha de creación

- ✅ **Período contable**: Campo adicional para agrupar por período cuando corresponde
  - Cuotas tienen `periodoContable = "2026-02"` (mes de vencimiento)
  - Permite ver "todos los movimientos de febrero" aunque se hayan pagado en marzo

### 3. Saldos en la Cuenta Corriente

**Saldo Acumulado (`saldoPosterior`)**:
- Saldo total de la cuenta corriente después de cada movimiento
- Se calcula secuencialmente: `saldo_anterior + (débito) - (crédito)`
- Siempre aparece en cada movimiento

**Saldo Pendiente (`saldoPendiente`)**:
- Saldo que queda por pagar de una orden/cuota específica
- Solo aparece cuando el movimiento está vinculado a una orden/cuota/obligación
- Ejemplo: Orden de $10,000, pagó $3,000 → `saldoPendiente = $7,000`

---

## 🎨 Representación Visual de los Movimientos

### Estructura de un Movimiento

```typescript
type Movimiento = {
  // Identificación
  id: string;
  fecha: string; // Fecha física del movimiento (ISO)
  periodoContable?: string; // "YYYY-MM" para agrupación
  
  // Naturaleza
  naturaleza: "debito" | "credito";
  origen: "orden_credito" | "pago_caja" | "nomina" | "ajuste" | ...
  
  // Concepto y monto
  concepto: string; // Descripción clara del movimiento
  importe: number; // Siempre positivo
  
  // Trazabilidad
  ordenId?: string;
  cuotaId?: string;
  obligacionId?: string;
  pagoId?: string;
  
  // Saldos
  saldoPosterior?: number; // Saldo acumulado después de este movimiento
  saldoPendiente?: number; // Saldo pendiente de la orden/cuota específica
};
```

### Vista de Tabla (Desktop)

| Fecha | Concepto | Debe | Haber | Saldo CC | Saldo Pendiente |
|-------|----------|------|-------|----------|-----------------|
| 01/02/2026 | ORD#123 cuota 1/3 (02/2026) - Comercio XYZ | $10,000 | - | $10,000 | $10,000 |
| 05/02/2026 | ORD#123 cuota 2/3 (03/2026) - Comercio XYZ | $10,000 | - | $20,000 | $20,000 |
| 10/03/2026 | Pago ORD#123 cuota 1 (02/2026) - Recibo #45 | - | $5,000 | $15,000 | $5,000 |
| 12/03/2026 | Pago ORD#123 cuota 1 (02/2026) - Recibo #46 | - | $5,000 | $10,000 | $0 |

**Observaciones**:
- La cuota 1 aparece pagada parcialmente el 10/03 y completamente el 12/03
- El saldo pendiente de la cuota 1 va: $10,000 → $5,000 → $0
- El saldo acumulado de la cuenta corriente: $10,000 → $20,000 → $15,000 → $10,000

---

## 💡 Mejora Propuesta: Detalles de Pagos en Órdenes

### Opción A: Expandir Movimientos de Orden

Cuando un movimiento tiene `ordenId` o `cuotaId`, mostrar detalles expandibles:

```
▶ ORD#123 - Comercio XYZ
  ├─ Cuota 1/3 (02/2026): $10,000
  │  ├─ Pago parcial 10/03/2026: $5,000 (Recibo #45)
  │  └─ Pago completo 12/03/2026: $5,000 (Recibo #46)
  │  Saldo pendiente: $0 ✅
  │
  ├─ Cuota 2/3 (03/2026): $10,000
  │  Saldo pendiente: $10,000 ⏳
  │
  └─ Cuota 3/3 (04/2026): $10,000
     Saldo pendiente: $10,000 ⏳

Total orden: $30,000
Total pagado: $10,000
Saldo pendiente: $20,000
```

### Opción B: Vista Agrupada por Orden

Agrupar movimientos por orden con resumen:

```
📦 ORDEN #123 - Comercio XYZ
   Fecha alta: 01/02/2026
   Importe total: $30,000
   Saldo pendiente: $20,000
   Estado: En curso (1/3 pagado)

   Movimientos:
   ┌─────────────────────────────────────────────────┐
   │ 01/02/2026 | Débito Cuota 1/3    | $10,000     │
   │ 05/02/2026 | Débito Cuota 2/3    | $10,000     │
   │ 10/03/2026 | Pago Cuota 1 (50%)  | -$5,000     │
   │ 12/03/2026 | Pago Cuota 1 (50%)  | -$5,000 ✅  │
   └─────────────────────────────────────────────────┘
```

### Opción C: Indicadores Visuales

Agregar badges/indicadores en cada movimiento:

- 🟢 **Pagado completamente**: `saldoPendiente = 0`
- 🟡 **Parcialmente pagado**: `saldoPendiente < importeOriginal`
- 🔴 **Sin pagar**: `saldoPendiente = importeOriginal`

---

## 📊 Resumen de la Cuenta Corriente

### Tarjetas de Resumen (Header)

```
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ Saldo Actual    │ │ Movimientos     │ │ Órdenes Activas │
│ $15,000         │ │ 8 movimientos   │ │ 2 órdenes       │
│ (Deudor)        │ │ (últimos 30 días)│ │ ($20,000 pend.) │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

### Desglose por Orden

```
ÓRDENES ACTIVAS:
┌─────────────────────────────────────────────┐
│ ORD#123 - Comercio XYZ                      │
│ Total: $30,000 | Pagado: $10,000 (33%)     │
│ Pendiente: $20,000                          │
│                                             │
│ Cuota 1/3: ✅ Pagada ($10,000)              │
│ Cuota 2/3: ⏳ Pendiente ($10,000)           │
│ Cuota 3/3: ⏳ Pendiente ($10,000)           │
└─────────────────────────────────────────────┘
```

---

## ✅ Implementación Actual vs Propuesta

### ✅ Ya Implementado

1. ✅ Movimientos con naturaleza (débito/crédito)
2. ✅ Fecha física para orden cronológico
3. ✅ Período contable para agrupación
4. ✅ Saldo posterior (acumulado)
5. ✅ Saldo pendiente por orden/cuota
6. ✅ Trazabilidad completa (ordenId, cuotaId, pagoId)

### 🚀 Mejoras Propuestas

1. 🔄 **Agregar detalles de pagos a cada orden**
   - Endpoint: `GET /ordenes/:ordenId/pagos` o incluir en movimientos
   - Mostrar historial de pagos por cuota

2. 🔄 **Vista agrupada por orden** (opcional)
   - Modo toggle: "Vista lista" vs "Vista agrupada"
   - Ver órdenes con sus movimientos anidados

3. 🔄 **Indicadores visuales de estado**
   - Badges para: pagado, parcial, pendiente
   - Barras de progreso para pagos parciales

4. 🔄 **Filtros mejorados**
   - Filtrar por estado de orden: todas, pendientes, pagadas, parciales
   - Filtrar por período contable vs fecha física

---

## 🎯 Recomendación Final

**Para máxima claridad, sugiero combinar**:
1. **Vista lista actual** (para cronología completa)
2. **Expandir movimientos de orden** (mostrar detalles al hacer click)
3. **Indicadores visuales** (badges de estado)
4. **Resumen por orden** (en una sección separada)

¿Implementamos estas mejoras?

