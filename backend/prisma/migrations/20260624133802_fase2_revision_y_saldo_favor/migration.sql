-- AlterEnum
ALTER TYPE "OrigenMovimientoAf" ADD VALUE 'aplicacion_saldo_favor';

-- AlterTable
ALTER TABLE "MovimientoAfiliado" ADD COLUMN     "aplicaSaldoFavorId" BIGINT,
ADD COLUMN     "requiereRevision" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "MovimientoAfiliado_organizacionId_requiereRevision_idx" ON "MovimientoAfiliado"("organizacionId", "requiereRevision");

-- AddForeignKey
ALTER TABLE "MovimientoAfiliado" ADD CONSTRAINT "MovimientoAfiliado_aplicaSaldoFavorId_fkey" FOREIGN KEY ("aplicaSaldoFavorId") REFERENCES "MovimientoAfiliado"("id") ON DELETE SET NULL ON UPDATE CASCADE;
