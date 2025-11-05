/*
  Warnings:

  - A unique constraint covering the columns `[organizacionId,origen,conceptoCodigo,metodoPago]` on the table `CuentaMapeo` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "public"."TipoPersona" AS ENUM ('FISICA', 'JURIDICA', 'OTRO');

-- CreateEnum
CREATE TYPE "public"."CondIva" AS ENUM ('INSCRIPTO', 'MONOTRIBUTO', 'EXENTO', 'CONSUMIDOR_FINAL', 'NO_RESPONSABLE');

-- CreateEnum
CREATE TYPE "public"."RolTercero" AS ENUM ('PROVEEDOR', 'PRESTADOR', 'AFILIADO', 'OTRO');

-- CreateEnum
CREATE TYPE "public"."TipoContacto" AS ENUM ('EMAIL', 'TELEFONO', 'WHATSAPP', 'WEB', 'OTRO');

-- CreateEnum
CREATE TYPE "public"."TipoCuentaBancaria" AS ENUM ('CBU', 'ALIAS', 'CVU', 'CCI', 'OTRO');

-- DropIndex
DROP INDEX "public"."CuentaMapeo_organizacionId_origen_conceptoCodigo_metodoPago_idx";

-- AlterTable
ALTER TABLE "public"."CuentaMapeo" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "public"."Tercero" (
    "id" BIGSERIAL NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "codigo" TEXT,
    "tipoPersona" "public"."TipoPersona",
    "nombre" TEXT NOT NULL,
    "fantasia" TEXT,
    "cuit" VARCHAR(20),
    "iibb" TEXT,
    "condIva" "public"."CondIva",
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "saldoInicial" DECIMAL(18,2),
    "saldoActual" DECIMAL(18,2),
    "notas" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tercero_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TerceroRol" (
    "id" BIGSERIAL NOT NULL,
    "terceroId" BIGINT NOT NULL,
    "rol" "public"."RolTercero" NOT NULL,

    CONSTRAINT "TerceroRol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TerceroDireccion" (
    "id" BIGSERIAL NOT NULL,
    "terceroId" BIGINT NOT NULL,
    "etiqueta" TEXT,
    "calle" TEXT,
    "numero" TEXT,
    "piso" TEXT,
    "dpto" TEXT,
    "ciudad" TEXT,
    "provincia" TEXT,
    "cp" TEXT,
    "pais" TEXT,
    "principal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TerceroDireccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TerceroContacto" (
    "id" BIGSERIAL NOT NULL,
    "terceroId" BIGINT NOT NULL,
    "tipo" "public"."TipoContacto" NOT NULL,
    "valor" TEXT NOT NULL,
    "etiqueta" TEXT,
    "principal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TerceroContacto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TerceroBanco" (
    "id" BIGSERIAL NOT NULL,
    "terceroId" BIGINT NOT NULL,
    "banco" TEXT,
    "tipo" "public"."TipoCuentaBancaria" NOT NULL,
    "numero" TEXT NOT NULL,
    "titular" TEXT,
    "cuitTitular" TEXT,

    CONSTRAINT "TerceroBanco_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TerceroImpositivo" (
    "id" BIGSERIAL NOT NULL,
    "terceroId" BIGINT NOT NULL,
    "exentoIva" BOOLEAN NOT NULL DEFAULT false,
    "percepIva" DECIMAL(6,2),
    "retGanancias" DECIMAL(6,2),
    "percepIibb" DECIMAL(6,2),

    CONSTRAINT "TerceroImpositivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Clasificacion" (
    "id" BIGSERIAL NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "Clasificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TerceroClasificacion" (
    "id" BIGSERIAL NOT NULL,
    "terceroId" BIGINT NOT NULL,
    "clasificacionId" BIGINT NOT NULL,

    CONSTRAINT "TerceroClasificacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Tercero_organizacionId_cuit_idx" ON "public"."Tercero"("organizacionId", "cuit");

-- CreateIndex
CREATE INDEX "Tercero_organizacionId_codigo_idx" ON "public"."Tercero"("organizacionId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "org_cuit_tercero" ON "public"."Tercero"("organizacionId", "cuit");

-- CreateIndex
CREATE UNIQUE INDEX "TerceroRol_terceroId_rol_key" ON "public"."TerceroRol"("terceroId", "rol");

-- CreateIndex
CREATE INDEX "TerceroBanco_numero_idx" ON "public"."TerceroBanco"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "TerceroImpositivo_terceroId_key" ON "public"."TerceroImpositivo"("terceroId");

-- CreateIndex
CREATE UNIQUE INDEX "Clasificacion_organizacionId_nombre_key" ON "public"."Clasificacion"("organizacionId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "TerceroClasificacion_terceroId_clasificacionId_key" ON "public"."TerceroClasificacion"("terceroId", "clasificacionId");

-- CreateIndex
CREATE INDEX "CuentaMapeo_organizacionId_origen_activo_idx" ON "public"."CuentaMapeo"("organizacionId", "origen", "activo");

-- CreateIndex
CREATE INDEX "CuentaMapeo_organizacionId_activo_idx" ON "public"."CuentaMapeo"("organizacionId", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "CuentaMapeo_organizacionId_origen_conceptoCodigo_metodoPago_key" ON "public"."CuentaMapeo"("organizacionId", "origen", "conceptoCodigo", "metodoPago");

-- AddForeignKey
ALTER TABLE "public"."Tercero" ADD CONSTRAINT "Tercero_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "public"."Organizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TerceroRol" ADD CONSTRAINT "TerceroRol_terceroId_fkey" FOREIGN KEY ("terceroId") REFERENCES "public"."Tercero"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TerceroDireccion" ADD CONSTRAINT "TerceroDireccion_terceroId_fkey" FOREIGN KEY ("terceroId") REFERENCES "public"."Tercero"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TerceroContacto" ADD CONSTRAINT "TerceroContacto_terceroId_fkey" FOREIGN KEY ("terceroId") REFERENCES "public"."Tercero"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TerceroBanco" ADD CONSTRAINT "TerceroBanco_terceroId_fkey" FOREIGN KEY ("terceroId") REFERENCES "public"."Tercero"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TerceroImpositivo" ADD CONSTRAINT "TerceroImpositivo_terceroId_fkey" FOREIGN KEY ("terceroId") REFERENCES "public"."Tercero"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Clasificacion" ADD CONSTRAINT "Clasificacion_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "public"."Organizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TerceroClasificacion" ADD CONSTRAINT "TerceroClasificacion_terceroId_fkey" FOREIGN KEY ("terceroId") REFERENCES "public"."Tercero"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TerceroClasificacion" ADD CONSTRAINT "TerceroClasificacion_clasificacionId_fkey" FOREIGN KEY ("clasificacionId") REFERENCES "public"."Clasificacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
