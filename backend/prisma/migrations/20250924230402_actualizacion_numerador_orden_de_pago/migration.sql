/*
  Warnings:

  - A unique constraint covering the columns `[organizacionId,numeroOP]` on the table `OrdenPagoTercero` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."OrdenPagoTercero" ADD COLUMN     "numeroOP" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "OrdenPagoTercero_organizacionId_numeroOP_key" ON "public"."OrdenPagoTercero"("organizacionId", "numeroOP");
