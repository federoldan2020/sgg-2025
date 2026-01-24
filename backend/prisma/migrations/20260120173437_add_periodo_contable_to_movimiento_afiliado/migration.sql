-- AlterTable
ALTER TABLE "public"."MovimientoAfiliado" ADD COLUMN     "periodoContable" TEXT;

-- CreateIndex
CREATE INDEX "MovimientoAfiliado_organizacionId_afiliadoId_periodoContabl_idx" ON "public"."MovimientoAfiliado"("organizacionId", "afiliadoId", "periodoContable");
