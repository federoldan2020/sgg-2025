-- AlterTable
ALTER TABLE "public"."ReintegroPago" ADD COLUMN "comprobanteId" TEXT;

-- CreateIndex
CREATE INDEX "ReintegroPago_comprobanteId_idx" ON "public"."ReintegroPago"("comprobanteId");

-- AddForeignKey
ALTER TABLE "public"."ReintegroPago"
ADD CONSTRAINT "ReintegroPago_comprobanteId_fkey"
FOREIGN KEY ("comprobanteId") REFERENCES "public"."Comprobante"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
