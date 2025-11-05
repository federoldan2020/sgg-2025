/*
  Warnings:

  - A unique constraint covering the columns `[organizacionId,origen,conceptoCodigo,metodoPago,moneda]` on the table `CuentaMapeo` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "public"."Moneda" AS ENUM ('ARS', 'USD');

-- CreateEnum
CREATE TYPE "public"."NaturalezaMovimientoAf" AS ENUM ('debito', 'credito');

-- CreateEnum
CREATE TYPE "public"."OrigenMovimientoAf" AS ENUM ('orden_credito', 'cuota', 'pago_caja', 'nomina', 'ajuste', 'anulacion');

-- DropIndex
DROP INDEX "public"."CuentaMapeo_organizacionId_origen_conceptoCodigo_metodoPago_key";

-- AlterTable
ALTER TABLE "public"."Asiento" ADD COLUMN     "moneda" "public"."Moneda",
ADD COLUMN     "tc" DECIMAL(12,6);

-- AlterTable
ALTER TABLE "public"."CuentaMapeo" ADD COLUMN     "moneda" TEXT;

-- AlterTable
ALTER TABLE "public"."MetodoPago" ADD COLUMN     "moneda" "public"."Moneda" NOT NULL DEFAULT 'ARS',
ADD COLUMN     "montoMoneda" DECIMAL(12,2),
ADD COLUMN     "tcAplicado" DECIMAL(12,6);

-- AlterTable
ALTER TABLE "public"."Pago" ADD COLUMN     "moneda" "public"."Moneda",
ADD COLUMN     "totalMoneda" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "public"."MovimientoAfiliado" (
    "id" BIGSERIAL NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "afiliadoId" BIGINT NOT NULL,
    "padronId" BIGINT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "naturaleza" "public"."NaturalezaMovimientoAf" NOT NULL,
    "origen" "public"."OrigenMovimientoAf" NOT NULL,
    "concepto" TEXT NOT NULL,
    "importe" DECIMAL(14,2) NOT NULL,
    "moneda" "public"."Moneda",
    "importeMoneda" DECIMAL(14,2),
    "tcAplicado" DECIMAL(12,6),
    "obligacionId" BIGINT,
    "ordenId" BIGINT,
    "cuotaId" BIGINT,
    "pagoId" BIGINT,
    "referenciaId" BIGINT,
    "referenciaTipo" TEXT,
    "asientoId" BIGINT,
    "saldoPosterior" DECIMAL(14,2),

    CONSTRAINT "MovimientoAfiliado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MovimientoAfiliado_organizacionId_afiliadoId_fecha_id_idx" ON "public"."MovimientoAfiliado"("organizacionId", "afiliadoId", "fecha", "id");

-- CreateIndex
CREATE INDEX "MovimientoAfiliado_organizacionId_afiliadoId_idx" ON "public"."MovimientoAfiliado"("organizacionId", "afiliadoId");

-- CreateIndex
CREATE INDEX "MovimientoAfiliado_organizacionId_origen_idx" ON "public"."MovimientoAfiliado"("organizacionId", "origen");

-- CreateIndex
CREATE INDEX "MovimientoAfiliado_organizacionId_obligacionId_idx" ON "public"."MovimientoAfiliado"("organizacionId", "obligacionId");

-- CreateIndex
CREATE INDEX "MovimientoAfiliado_organizacionId_ordenId_idx" ON "public"."MovimientoAfiliado"("organizacionId", "ordenId");

-- CreateIndex
CREATE INDEX "MovimientoAfiliado_organizacionId_cuotaId_idx" ON "public"."MovimientoAfiliado"("organizacionId", "cuotaId");

-- CreateIndex
CREATE INDEX "MovimientoAfiliado_organizacionId_pagoId_idx" ON "public"."MovimientoAfiliado"("organizacionId", "pagoId");

-- CreateIndex
CREATE INDEX "cuentamapeo_i_org_ori_con_met" ON "public"."CuentaMapeo"("organizacionId", "origen", "conceptoCodigo", "metodoPago");

-- CreateIndex
CREATE UNIQUE INDEX "cuentamapeo_u_org_ori_con_met_mon" ON "public"."CuentaMapeo"("organizacionId", "origen", "conceptoCodigo", "metodoPago", "moneda");

-- AddForeignKey
ALTER TABLE "public"."MovimientoAfiliado" ADD CONSTRAINT "MovimientoAfiliado_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "public"."Organizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MovimientoAfiliado" ADD CONSTRAINT "MovimientoAfiliado_afiliadoId_fkey" FOREIGN KEY ("afiliadoId") REFERENCES "public"."Afiliado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MovimientoAfiliado" ADD CONSTRAINT "MovimientoAfiliado_padronId_fkey" FOREIGN KEY ("padronId") REFERENCES "public"."Padron"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MovimientoAfiliado" ADD CONSTRAINT "MovimientoAfiliado_asientoId_fkey" FOREIGN KEY ("asientoId") REFERENCES "public"."Asiento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "public"."CuentaMapeo_organizacionId_activo_idx" RENAME TO "cuentamapeo_i_org_act";

-- RenameIndex
ALTER INDEX "public"."CuentaMapeo_organizacionId_origen_activo_idx" RENAME TO "cuentamapeo_i_org_ori_act";
