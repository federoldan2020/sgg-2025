-- CreateEnum
CREATE TYPE "SyncDossanjuanAccion" AS ENUM ('ALTA', 'BAJA');

-- CreateEnum
CREATE TYPE "SyncDossanjuanEstado" AS ENUM ('PENDIENTE', 'OK', 'ERROR_PERMANENTE');

-- CreateTable
CREATE TABLE "SyncDossanjuan" (
    "id" BIGSERIAL NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "coseguroId" BIGINT,
    "dni" BIGINT NOT NULL,
    "accion" "SyncDossanjuanAccion" NOT NULL,
    "estado" "SyncDossanjuanEstado" NOT NULL DEFAULT 'PENDIENTE',
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "ultimoError" TEXT,
    "respuestaWs" TEXT,
    "ejecutadoEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncDossanjuan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SyncDossanjuan_estado_creadoEn_idx" ON "SyncDossanjuan"("estado", "creadoEn");

-- CreateIndex
CREATE INDEX "SyncDossanjuan_organizacionId_estado_idx" ON "SyncDossanjuan"("organizacionId", "estado");

-- CreateIndex
CREATE INDEX "SyncDossanjuan_dni_idx" ON "SyncDossanjuan"("dni");

-- AddForeignKey
ALTER TABLE "SyncDossanjuan" ADD CONSTRAINT "SyncDossanjuan_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "Organizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncDossanjuan" ADD CONSTRAINT "SyncDossanjuan_coseguroId_fkey" FOREIGN KEY ("coseguroId") REFERENCES "CoseguroAfiliado"("id") ON DELETE SET NULL ON UPDATE CASCADE;
