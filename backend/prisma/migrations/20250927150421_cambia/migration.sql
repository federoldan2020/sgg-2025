/*
  Warnings:

  - A unique constraint covering the columns `[afiliadoId,dni]` on the table `Colateral` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `afiliadoId` to the `Colateral` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."Colateral_coseguroId_dni_key";

-- AlterTable
ALTER TABLE "public"."Colateral" ADD COLUMN     "afiliadoId" BIGINT NOT NULL,
ADD COLUMN     "esColateral" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "coseguroId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Colateral_afiliadoId_esColateral_idx" ON "public"."Colateral"("afiliadoId", "esColateral");

-- CreateIndex
CREATE UNIQUE INDEX "Colateral_afiliadoId_dni_key" ON "public"."Colateral"("afiliadoId", "dni");

-- AddForeignKey
ALTER TABLE "public"."Colateral" ADD CONSTRAINT "Colateral_afiliadoId_fkey" FOREIGN KEY ("afiliadoId") REFERENCES "public"."Afiliado"("id") ON DELETE CASCADE ON UPDATE CASCADE;
