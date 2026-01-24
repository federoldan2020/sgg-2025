-- ============================================================
-- Script para LIMPIAR TODOS LOS MOVIMIENTOS Y DATOS RELACIONADOS
-- ⚠️ ADVERTENCIA: Este script BORRA PERMANENTEMENTE todos los datos
-- ============================================================

-- OPCIÓN 1: LIMPIEZA CONSERVADORA (solo movimientos y reseteo de saldos)
-- Mantiene órdenes, pagos, obligaciones pero limpia movimientos

BEGIN;

-- 1. Borrar todos los movimientos de afiliados
DELETE FROM "MovimientoAfiliado";

-- 2. Resetear saldos de afiliados a 0
UPDATE "Afiliado" SET saldo = 0;

-- 3. Resetear saldos de órdenes de crédito
UPDATE "OrdenCredito" 
SET 
  saldoTotal = importeTotal,
  estado = CASE WHEN estado = 'anulada' THEN 'anulada' ELSE 'pendiente' END;

-- 4. Resetear saldos de cuotas
UPDATE "OrdenCreditoCuota"
SET 
  saldo = importe,
  cancelado = 0,
  estado = CASE WHEN estado = 'anulada' THEN 'anulada' ELSE 'pendiente' END;

-- 5. Resetear saldos de obligaciones
UPDATE "Obligacion"
SET 
  saldo = monto,
  estado = CASE WHEN estado = 'anulada' THEN 'anulada' ELSE 'pendiente' END;

-- 6. Opcional: Marcar pagos como anulados (o borrarlos)
-- Opción A: Marcar como anulados (mantiene historial)
-- UPDATE "Pago" SET origen = 'anulado' WHERE origen != 'anulado';

-- Opción B: Borrar pagos completamente (más agresivo)
-- DELETE FROM "Aplicacion";
-- DELETE FROM "MetodoPago";
-- DELETE FROM "Pago";

COMMIT;

-- ============================================================
-- OPCIÓN 2: LIMPIEZA COMPLETA (borra TODO incluyendo órdenes y pagos)
-- ⚠️ MUY DESTRUCTIVO - Solo usar si realmente querés empezar de cero
-- ============================================================

/*
BEGIN;

-- 1. Borrar en orden correcto (respetando foreign keys)
DELETE FROM "MovimientoAfiliado";
DELETE FROM "Aplicacion";
DELETE FROM "MetodoPago";
DELETE FROM "Pago";
DELETE FROM "OrdenCreditoCuota";
DELETE FROM "OrdenCredito";
DELETE FROM "Obligacion";
DELETE FROM "Asiento" WHERE origen IN ('pago_caja', 'orden_credito');

-- 2. Resetear saldos
UPDATE "Afiliado" SET saldo = 0;
UPDATE "Padron" SET saldo = 0 WHERE saldo IS NOT NULL;

COMMIT;
*/

-- ============================================================
-- OPCIÓN 3: LIMPIEZA POR ORGANIZACIÓN (solo una organización)
-- Reemplazar 'ORGANIZACION_ID' con el ID real
-- ============================================================

/*
BEGIN;

DELETE FROM "MovimientoAfiliado" WHERE "organizacionId" = 'ORGANIZACION_ID';
UPDATE "Afiliado" SET saldo = 0 WHERE "organizacionId" = 'ORGANIZACION_ID';
UPDATE "OrdenCredito" SET saldoTotal = importeTotal, estado = 'pendiente' WHERE "organizacionId" = 'ORGANIZACION_ID';
UPDATE "OrdenCreditoCuota" SET saldo = importe, cancelado = 0, estado = 'pendiente' WHERE ordenId IN (SELECT id FROM "OrdenCredito" WHERE "organizacionId" = 'ORGANIZACION_ID');
UPDATE "Obligacion" SET saldo = monto, estado = 'pendiente' WHERE "organizacionId" = 'ORGANIZACION_ID';

COMMIT;
*/

