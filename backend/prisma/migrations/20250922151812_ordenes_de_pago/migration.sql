-- CreateEnum
CREATE TYPE "public"."TipoMovimientoTercero" AS ENUM ('debito', 'credito');

-- CreateEnum
CREATE TYPE "public"."OrigenMovimientoTercero" AS ENUM ('factura', 'prestacion', 'nota_credito', 'nota_debito', 'orden_pago', 'ajuste');

-- DropIndex
DROP INDEX "public"."OrdenPagoTercero_cuentaId_estado_idx";

-- DropIndex
DROP INDEX "public"."OrdenPagoTercero_organizacionId_rol_estado_idx";

-- DropIndex
DROP INDEX "public"."OrdenPagoTercero_terceroId_rol_estado_idx";

-- AlterTable
ALTER TABLE "public"."ComprobanteTercero" ADD COLUMN     "caeVencimiento" TIMESTAMP(3),
ADD COLUMN     "tc" DECIMAL(12,6);

-- AlterTable
ALTER TABLE "public"."MovimientoCuentaTercero" ADD COLUMN     "saldoPosterior" DECIMAL(18,2);

-- CreateIndex
CREATE INDEX "CuentaTercero_organizacionId_terceroId_idx" ON "public"."CuentaTercero"("organizacionId", "terceroId");

-- CreateIndex
CREATE INDEX "OrdenPagoTercero_organizacionId_rol_estado_fecha_idx" ON "public"."OrdenPagoTercero"("organizacionId", "rol", "estado", "fecha");

-- CreateIndex
CREATE INDEX "OrdenPagoTercero_terceroId_rol_estado_fecha_idx" ON "public"."OrdenPagoTercero"("terceroId", "rol", "estado", "fecha");

-- CreateIndex
CREATE INDEX "OrdenPagoTercero_cuentaId_estado_fecha_idx" ON "public"."OrdenPagoTercero"("cuentaId", "estado", "fecha");
