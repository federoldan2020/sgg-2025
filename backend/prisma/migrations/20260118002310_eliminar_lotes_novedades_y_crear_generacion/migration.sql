/*
  Warnings:

  - You are about to drop the column `novedadLoteId` on the `Obligacion` table. All the data in the column will be lost.
  - You are about to drop the `LoteNovedad` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `NovedadDetalle` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `NovedadItem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `NovedadItemDetalle` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `NovedadLote` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."LoteNovedad" DROP CONSTRAINT "LoteNovedad_organizacionId_fkey";

-- DropForeignKey
ALTER TABLE "public"."NovedadDetalle" DROP CONSTRAINT "NovedadDetalle_afiliadoId_fkey";

-- DropForeignKey
ALTER TABLE "public"."NovedadDetalle" DROP CONSTRAINT "NovedadDetalle_loteId_fkey";

-- DropForeignKey
ALTER TABLE "public"."NovedadDetalle" DROP CONSTRAINT "NovedadDetalle_padronId_fkey";

-- DropForeignKey
ALTER TABLE "public"."NovedadItem" DROP CONSTRAINT "NovedadItem_afiliadoId_fkey";

-- DropForeignKey
ALTER TABLE "public"."NovedadItem" DROP CONSTRAINT "NovedadItem_conceptoId_fkey";

-- DropForeignKey
ALTER TABLE "public"."NovedadItem" DROP CONSTRAINT "NovedadItem_novedadLoteId_fkey";

-- DropForeignKey
ALTER TABLE "public"."NovedadItem" DROP CONSTRAINT "NovedadItem_organizacionId_fkey";

-- DropForeignKey
ALTER TABLE "public"."NovedadItem" DROP CONSTRAINT "NovedadItem_padronId_fkey";

-- DropForeignKey
ALTER TABLE "public"."NovedadItemDetalle" DROP CONSTRAINT "NovedadItemDetalle_novedadItemId_fkey";

-- DropForeignKey
ALTER TABLE "public"."NovedadItemDetalle" DROP CONSTRAINT "NovedadItemDetalle_obligacionId_fkey";

-- DropForeignKey
ALTER TABLE "public"."NovedadLote" DROP CONSTRAINT "NovedadLote_organizacionId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Obligacion" DROP CONSTRAINT "Obligacion_novedadLoteId_fkey";

-- DropIndex
DROP INDEX "public"."Obligacion_organizacionId_novedadLoteId_idx";

-- AlterTable
ALTER TABLE "public"."Obligacion" DROP COLUMN "novedadLoteId";

-- DropTable
DROP TABLE "public"."LoteNovedad";

-- DropTable
DROP TABLE "public"."NovedadDetalle";

-- DropTable
DROP TABLE "public"."NovedadItem";

-- DropTable
DROP TABLE "public"."NovedadItemDetalle";

-- DropTable
DROP TABLE "public"."NovedadLote";

-- CreateTable
CREATE TABLE "public"."NovedadGenerada" (
    "id" BIGSERIAL NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "sistema" TEXT NOT NULL,
    "archivoNombre" TEXT NOT NULL,
    "archivoContenido" TEXT NOT NULL,
    "totalRegistros" INTEGER NOT NULL DEFAULT 0,
    "totalImporte" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "generadoPor" TEXT,
    "generadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NovedadGenerada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."NovedadGeneradaItem" (
    "id" BIGSERIAL NOT NULL,
    "novedadGeneradaId" BIGINT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "afiliadoId" BIGINT NOT NULL,
    "padronId" BIGINT,
    "padronRaw" TEXT NOT NULL,
    "centro" INTEGER,
    "codigo" TEXT NOT NULL,
    "importe" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "NovedadGeneradaItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Novedad" (
    "id" BIGSERIAL NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "afiliadoId" BIGINT NOT NULL,
    "padronId" BIGINT,
    "padronRaw" TEXT NOT NULL,
    "centro" INTEGER,
    "codigo" TEXT NOT NULL,
    "importe" DECIMAL(12,2) NOT NULL,
    "observacion" TEXT,
    "creadoPor" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Novedad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NovedadGenerada_organizacionId_periodo_idx" ON "public"."NovedadGenerada"("organizacionId", "periodo");

-- CreateIndex
CREATE UNIQUE INDEX "NovedadGenerada_organizacionId_periodo_sistema_key" ON "public"."NovedadGenerada"("organizacionId", "periodo", "sistema");

-- CreateIndex
CREATE INDEX "NovedadGeneradaItem_organizacionId_novedadGeneradaId_idx" ON "public"."NovedadGeneradaItem"("organizacionId", "novedadGeneradaId");

-- CreateIndex
CREATE INDEX "NovedadGeneradaItem_organizacionId_afiliadoId_idx" ON "public"."NovedadGeneradaItem"("organizacionId", "afiliadoId");

-- CreateIndex
CREATE INDEX "NovedadGeneradaItem_organizacionId_padronId_idx" ON "public"."NovedadGeneradaItem"("organizacionId", "padronId");

-- CreateIndex
CREATE INDEX "Novedad_organizacionId_periodo_idx" ON "public"."Novedad"("organizacionId", "periodo");

-- CreateIndex
CREATE INDEX "Novedad_organizacionId_afiliadoId_idx" ON "public"."Novedad"("organizacionId", "afiliadoId");

-- CreateIndex
CREATE INDEX "Novedad_organizacionId_padronId_idx" ON "public"."Novedad"("organizacionId", "padronId");

-- CreateIndex
CREATE INDEX "Novedad_organizacionId_codigo_idx" ON "public"."Novedad"("organizacionId", "codigo");

-- AddForeignKey
ALTER TABLE "public"."NovedadGenerada" ADD CONSTRAINT "NovedadGenerada_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "public"."Organizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NovedadGeneradaItem" ADD CONSTRAINT "NovedadGeneradaItem_novedadGeneradaId_fkey" FOREIGN KEY ("novedadGeneradaId") REFERENCES "public"."NovedadGenerada"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NovedadGeneradaItem" ADD CONSTRAINT "NovedadGeneradaItem_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "public"."Organizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NovedadGeneradaItem" ADD CONSTRAINT "NovedadGeneradaItem_afiliadoId_fkey" FOREIGN KEY ("afiliadoId") REFERENCES "public"."Afiliado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NovedadGeneradaItem" ADD CONSTRAINT "NovedadGeneradaItem_padronId_fkey" FOREIGN KEY ("padronId") REFERENCES "public"."Padron"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Novedad" ADD CONSTRAINT "Novedad_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "public"."Organizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Novedad" ADD CONSTRAINT "Novedad_afiliadoId_fkey" FOREIGN KEY ("afiliadoId") REFERENCES "public"."Afiliado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Novedad" ADD CONSTRAINT "Novedad_padronId_fkey" FOREIGN KEY ("padronId") REFERENCES "public"."Padron"("id") ON DELETE SET NULL ON UPDATE CASCADE;
