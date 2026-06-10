/*
  Warnings:

  - You are about to drop the column `motivoSuspension` on the `CoseguroAfiliado` table. All the data in the column will be lost.
  - You are about to drop the column `suspendidoEn` on the `CoseguroAfiliado` table. All the data in the column will be lost.
  - You are about to drop the column `suspendidoPorId` on the `CoseguroAfiliado` table. All the data in the column will be lost.
  - You are about to drop the `Novedad` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `NovedadCalendario` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `NovedadGenerada` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `NovedadGeneradaItem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `NovedadPendiente` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `NovedadPendientePadron` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Novedad" DROP CONSTRAINT "Novedad_afiliadoId_fkey";

-- DropForeignKey
ALTER TABLE "Novedad" DROP CONSTRAINT "Novedad_organizacionId_fkey";

-- DropForeignKey
ALTER TABLE "Novedad" DROP CONSTRAINT "Novedad_padronId_fkey";

-- DropForeignKey
ALTER TABLE "NovedadCalendario" DROP CONSTRAINT "NovedadCalendario_organizacionId_fkey";

-- DropForeignKey
ALTER TABLE "NovedadGenerada" DROP CONSTRAINT "NovedadGenerada_organizacionId_fkey";

-- DropForeignKey
ALTER TABLE "NovedadGeneradaItem" DROP CONSTRAINT "NovedadGeneradaItem_afiliadoId_fkey";

-- DropForeignKey
ALTER TABLE "NovedadGeneradaItem" DROP CONSTRAINT "NovedadGeneradaItem_novedadGeneradaId_fkey";

-- DropForeignKey
ALTER TABLE "NovedadGeneradaItem" DROP CONSTRAINT "NovedadGeneradaItem_organizacionId_fkey";

-- DropForeignKey
ALTER TABLE "NovedadGeneradaItem" DROP CONSTRAINT "NovedadGeneradaItem_padronId_fkey";

-- DropForeignKey
ALTER TABLE "NovedadPendiente" DROP CONSTRAINT "NovedadPendiente_organizacionId_fkey";

-- DropForeignKey
ALTER TABLE "NovedadPendientePadron" DROP CONSTRAINT "NovedadPendientePadron_organizacionId_fkey";

-- DropForeignKey
ALTER TABLE "NovedadPendientePadron" DROP CONSTRAINT "NovedadPendientePadron_padronId_fkey";

-- AlterTable
ALTER TABLE "CoseguroAfiliado" DROP COLUMN "motivoSuspension",
DROP COLUMN "suspendidoEn",
DROP COLUMN "suspendidoPorId";

-- DropTable
DROP TABLE "Novedad";

-- DropTable
DROP TABLE "NovedadCalendario";

-- DropTable
DROP TABLE "NovedadGenerada";

-- DropTable
DROP TABLE "NovedadGeneradaItem";

-- DropTable
DROP TABLE "NovedadPendiente";

-- DropTable
DROP TABLE "NovedadPendientePadron";
