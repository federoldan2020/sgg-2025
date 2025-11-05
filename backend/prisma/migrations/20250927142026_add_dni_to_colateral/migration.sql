/*
  Warnings:

  - A unique constraint covering the columns `[coseguroId,dni]` on the table `Colateral` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."Colateral" ADD COLUMN     "dni" VARCHAR(20);

-- CreateIndex
CREATE INDEX "Colateral_dni_idx" ON "public"."Colateral"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "Colateral_coseguroId_dni_key" ON "public"."Colateral"("coseguroId", "dni");
