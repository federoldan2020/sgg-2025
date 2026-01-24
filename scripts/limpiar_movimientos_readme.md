# Scripts para Limpiar Movimientos

## ⚠️ ADVERTENCIA
Estos scripts **BORRAN PERMANENTEMENTE** todos los movimientos y resetean los saldos. Solo usar en desarrollo/testing.

## Opciones Disponibles

### 1. Script SQL Simple (Recomendado)

**Archivo**: `scripts/limpiar_movimientos_completo.sql`

**Uso con psql**:
```bash
cd backend
psql $DATABASE_URL -f ../scripts/limpiar_movimientos_completo.sql
```

**Uso con Prisma Studio**:
1. Abrir Prisma Studio: `npx prisma studio`
2. Ir a la pestaña "SQL"
3. Copiar y pegar el contenido de `limpiar_movimientos_completo.sql`
4. Ejecutar

**Uso desde línea de comandos de PostgreSQL**:
```bash
psql -U usuario -d base_de_datos -f scripts/limpiar_movimientos_completo.sql
```

### 2. Script PowerShell (Windows)

**Archivo**: `scripts/limpiar_movimientos.ps1`

**Uso**:
```powershell
# Limpieza conservadora (solo movimientos)
.\scripts\limpiar_movimientos.ps1

# Limpieza completa (incluye pagos)
.\scripts\limpiar_movimientos.ps1 -Full

# Limpieza por organización específica
.\scripts\limpiar_movimientos.ps1 -OrgId "ORGANIZACION_ID"
```

### 3. Desde Node.js/Prisma (Recomendado para desarrollo)

**Archivo**: `scripts/limpiar_movimientos.ts` (si lo creás)

```typescript
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function limpiar() {
  await prisma.$transaction(async (tx) => {
    await tx.movimientoAfiliado.deleteMany();
    await tx.afiliado.updateMany({ data: { saldo: 0 } });
    await tx.ordenCredito.updateMany({
      data: { saldoTotal: { equals: 'importeTotal' }, estado: 'pendiente' }
    });
    // ... etc
  });
}
```

## Qué Hace Cada Script

### Limpieza Conservadora (Por defecto)
- ✅ Borra todos los movimientos (`MovimientoAfiliado`)
- ✅ Resetea saldos de afiliados a 0
- ✅ Resetea saldos de órdenes a su importe total
- ✅ Resetea saldos de cuotas a su importe
- ✅ Resetea saldos de obligaciones a su monto
- ✅ **MANTIENE** órdenes, pagos, obligaciones (solo resetea saldos)

### Limpieza Completa (Con flag `--full`)
- ✅ Todo lo anterior +
- ✅ Borra pagos, aplicaciones y métodos de pago
- ⚠️ **Más destructivo** - Solo usar si querés empezar completamente de cero

## Reseteo de Estados

Los scripts resetean los estados de:
- **Órdenes**: `pendiente` o `en_curso` → `pendiente` (mantiene `anulada` si existe)
- **Cuotas**: `pendiente` o `parcialmente_pagada` o `pagada` → `pendiente` (mantiene `anulada`)
- **Obligaciones**: `pendiente` o `parcialmente_pagada` → `pendiente` (mantiene `anulada`)

## ⚠️ IMPORTANTE

1. **Hacer backup** antes de ejecutar
2. **Verificar** que estás en el entorno correcto (desarrollo, no producción)
3. Los scripts usan `BEGIN` y `COMMIT` para transacciones atómicas
4. Si algo falla, la transacción se revierte automáticamente

