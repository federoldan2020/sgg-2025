-- AlterTable
ALTER TABLE "Pago" ADD COLUMN     "comprobanteId" TEXT;

-- CreateIndex
CREATE INDEX "Pago_comprobanteId_idx" ON "Pago"("comprobanteId");
