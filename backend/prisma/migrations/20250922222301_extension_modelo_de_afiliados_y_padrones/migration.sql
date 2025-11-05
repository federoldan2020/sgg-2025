/*
  Warnings:

  - A unique constraint covering the columns `[organizacionId,cuit]` on the table `Afiliado` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "public"."Sexo" AS ENUM ('M', 'F', 'X');

-- CreateEnum
CREATE TYPE "public"."AfiliadoTipo" AS ENUM ('TITULAR', 'FAMILIAR', 'JUBILADO', 'OTRO');

-- CreateEnum
CREATE TYPE "public"."Sistema" AS ENUM ('ESC', 'SGR', 'SG');

-- AlterTable
ALTER TABLE "public"."Afiliado" ADD COLUMN     "barrio" TEXT,
ADD COLUMN     "calle" TEXT,
ADD COLUMN     "casa" TEXT,
ADD COLUMN     "celular" TEXT,
ADD COLUMN     "cuit" TEXT,
ADD COLUMN     "cupo" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "depto" TEXT,
ADD COLUMN     "fechaNacimiento" DATE,
ADD COLUMN     "localidad" TEXT,
ADD COLUMN     "manzana" TEXT,
ADD COLUMN     "monoblock" TEXT,
ADD COLUMN     "numero" TEXT,
ADD COLUMN     "numeroSocio" TEXT,
ADD COLUMN     "observaciones" TEXT,
ADD COLUMN     "orientacion" TEXT,
ADD COLUMN     "piso" TEXT,
ADD COLUMN     "saldo" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "sexo" "public"."Sexo",
ADD COLUMN     "telefono" TEXT,
ADD COLUMN     "tipo" "public"."AfiliadoTipo";

-- AlterTable
ALTER TABLE "public"."Padron" ADD COLUMN     "beneficiarioJubilado" TEXT,
ADD COLUMN     "cajaAhorro" TEXT,
ADD COLUMN     "cupo" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "j17" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "j22" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "j38" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "k16" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "motivoBaja" TEXT,
ADD COLUMN     "saldo" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "sistema" "public"."Sistema",
ADD COLUMN     "sueldoBasico" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Afiliado_organizacionId_numeroSocio_idx" ON "public"."Afiliado"("organizacionId", "numeroSocio");

-- CreateIndex
CREATE INDEX "Afiliado_organizacionId_apellido_nombre_idx" ON "public"."Afiliado"("organizacionId", "apellido", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Afiliado_organizacionId_cuit_key" ON "public"."Afiliado"("organizacionId", "cuit");

-- CreateIndex
CREATE INDEX "Padron_organizacionId_sistema_idx" ON "public"."Padron"("organizacionId", "sistema");
