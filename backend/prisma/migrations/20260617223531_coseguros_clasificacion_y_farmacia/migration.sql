-- CreateEnum
CREATE TYPE "ClasifResultado" AS ENUM ('GF', 'J38', 'SIN_COBERTURA');

-- DropForeignKey
ALTER TABLE "ReglaPrecioColateral" DROP CONSTRAINT "ReglaPrecioColateral_parentescoId_fkey";

-- AlterTable
ALTER TABLE "Colateral" ADD COLUMN     "aportesCertificadoVence" DATE,
ADD COLUMN     "esDiscapacitado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "esEstudiante" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tieneAportes" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ReglaPrecioColateral" ADD COLUMN     "precioPorColateral" DECIMAL(12,2),
ALTER COLUMN "parentescoId" DROP NOT NULL,
ALTER COLUMN "precioTotal" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ReglaPrecioColateralDraft" ADD COLUMN     "precioPorColateral" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "ReglaClasificacionIntegrante" (
    "id" BIGSERIAL NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "parentescoId" BIGINT,
    "sexoTitular" "Sexo",
    "edadDesde" INTEGER,
    "edadHasta" INTEGER,
    "requiereEstudiante" BOOLEAN,
    "requiereAportes" BOOLEAN,
    "requiereDiscapacidad" BOOLEAN,
    "resultado" "ClasifResultado" NOT NULL,
    "prioridad" INTEGER NOT NULL,
    "vigenteDesde" DATE NOT NULL,
    "vigenteHasta" DATE,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "descripcion" TEXT,

    CONSTRAINT "ReglaClasificacionIntegrante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReglaCoberturaCoseguro" (
    "id" BIGSERIAL NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "ordenesPorMes" INTEGER NOT NULL,
    "vigenteDesde" DATE NOT NULL,
    "vigenteHasta" DATE,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ReglaCoberturaCoseguro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Farmacia" (
    "id" BIGSERIAL NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "cuit" TEXT,
    "direccion" TEXT,
    "localidad" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "esInterna" BOOLEAN NOT NULL DEFAULT false,
    "usuario" TEXT,
    "passwordHash" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Farmacia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrdenFarmaciaConsumo" (
    "id" BIGSERIAL NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "afiliadoTitularId" BIGINT NOT NULL,
    "integranteColateralId" BIGINT,
    "periodo" VARCHAR(6) NOT NULL,
    "numeroOrdenEnMes" INTEGER NOT NULL,
    "farmaciaId" BIGINT NOT NULL,
    "consumidaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "monto" DECIMAL(12,2),
    "observacion" TEXT,
    "anuladaEn" TIMESTAMP(3),
    "anuladaPor" TEXT,
    "anuladaMotivo" TEXT,

    CONSTRAINT "OrdenFarmaciaConsumo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReglaClasificacionIntegrante_organizacionId_activo_priorida_idx" ON "ReglaClasificacionIntegrante"("organizacionId", "activo", "prioridad");

-- CreateIndex
CREATE INDEX "ReglaCoberturaCoseguro_organizacionId_vigenteDesde_idx" ON "ReglaCoberturaCoseguro"("organizacionId", "vigenteDesde");

-- CreateIndex
CREATE UNIQUE INDEX "Farmacia_usuario_key" ON "Farmacia"("usuario");

-- CreateIndex
CREATE INDEX "Farmacia_organizacionId_activo_idx" ON "Farmacia"("organizacionId", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "Farmacia_organizacionId_codigo_key" ON "Farmacia"("organizacionId", "codigo");

-- CreateIndex
CREATE INDEX "OrdenFarmaciaConsumo_organizacionId_periodo_idx" ON "OrdenFarmaciaConsumo"("organizacionId", "periodo");

-- CreateIndex
CREATE INDEX "OrdenFarmaciaConsumo_afiliadoTitularId_periodo_idx" ON "OrdenFarmaciaConsumo"("afiliadoTitularId", "periodo");

-- CreateIndex
CREATE INDEX "OrdenFarmaciaConsumo_farmaciaId_consumidaEn_idx" ON "OrdenFarmaciaConsumo"("farmaciaId", "consumidaEn");

-- CreateIndex
CREATE UNIQUE INDEX "OrdenFarmaciaConsumo_organizacionId_afiliadoTitularId_perio_key" ON "OrdenFarmaciaConsumo"("organizacionId", "afiliadoTitularId", "periodo", "numeroOrdenEnMes");

-- AddForeignKey
ALTER TABLE "ReglaPrecioColateral" ADD CONSTRAINT "ReglaPrecioColateral_parentescoId_fkey" FOREIGN KEY ("parentescoId") REFERENCES "Parentesco"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReglaClasificacionIntegrante" ADD CONSTRAINT "ReglaClasificacionIntegrante_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "Organizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReglaClasificacionIntegrante" ADD CONSTRAINT "ReglaClasificacionIntegrante_parentescoId_fkey" FOREIGN KEY ("parentescoId") REFERENCES "Parentesco"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReglaCoberturaCoseguro" ADD CONSTRAINT "ReglaCoberturaCoseguro_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "Organizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Farmacia" ADD CONSTRAINT "Farmacia_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "Organizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenFarmaciaConsumo" ADD CONSTRAINT "OrdenFarmaciaConsumo_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "Organizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenFarmaciaConsumo" ADD CONSTRAINT "OrdenFarmaciaConsumo_afiliadoTitularId_fkey" FOREIGN KEY ("afiliadoTitularId") REFERENCES "Afiliado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenFarmaciaConsumo" ADD CONSTRAINT "OrdenFarmaciaConsumo_integranteColateralId_fkey" FOREIGN KEY ("integranteColateralId") REFERENCES "Colateral"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenFarmaciaConsumo" ADD CONSTRAINT "OrdenFarmaciaConsumo_farmaciaId_fkey" FOREIGN KEY ("farmaciaId") REFERENCES "Farmacia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
