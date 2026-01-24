-- ============================================================
-- Script COMPLETO para LIMPIAR todos los movimientos
-- ⚠️ ADVERTENCIA: Este script BORRA PERMANENTEMENTE todos los movimientos
-- y resetea todos los saldos relacionados
-- ============================================================

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

-- 6. Opcional: Borrar pagos y aplicaciones (descomentar si querés borrar todo)
-- DELETE FROM "Aplicacion";
-- DELETE FROM "MetodoPago";
-- DELETE FROM "Pago";

COMMIT;

-- Verificar resultados
SELECT 
  (SELECT COUNT(*) FROM "MovimientoAfiliado") as movimientos_restantes,
  (SELECT COUNT(*) FROM "Afiliado" WHERE saldo != 0) as afiliados_con_saldo,
  (SELECT COUNT(*) FROM "OrdenCredito" WHERE saldoTotal != importeTotal) as ordenes_con_saldo_pendiente,
  (SELECT COUNT(*) FROM "OrdenCreditoCuota" WHERE saldo != importe) as cuotas_con_saldo_pendiente;

