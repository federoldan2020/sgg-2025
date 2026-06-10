-- Agrega el valor COMERCIO al enum RolTercero.
-- Los terceros con rol COMERCIO obtienen cuenta corriente, comprobantes y
-- órdenes de pago igual que PROVEEDOR/PRESTADOR (misma maquinaria por-rol).
-- No se elimina AFILIADO ni OTRO: AFILIADO lo usa el módulo de reintegros y
-- OTRO es el fallback de los importadores.
ALTER TYPE "RolTercero" ADD VALUE IF NOT EXISTS 'COMERCIO' AFTER 'PRESTADOR';
