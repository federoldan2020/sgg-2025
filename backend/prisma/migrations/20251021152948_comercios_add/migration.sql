-- AlterTable
ALTER TABLE "public"."OrdenCredito" ADD COLUMN     "comercioId" BIGINT;

-- AlterTable
ALTER TABLE "public"."OrdenCreditoCuota" ADD COLUMN     "comercioId" BIGINT;

-- CreateTable
CREATE TABLE "public"."Comercio" (
    "id" BIGSERIAL NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "domicilio" TEXT,
    "localidad" TEXT,
    "fechaIngreso" TIMESTAMP(3),
    "telefono1" TEXT,
    "telefono2" TEXT,
    "email" TEXT,
    "grupo" INTEGER,
    "departamento" INTEGER,
    "rubro" INTEGER,
    "tipo" INTEGER,
    "cuoMax" INTEGER,
    "pIVA" DECIMAL(6,2),
    "pGanancia" DECIMAL(6,2),
    "pIngresosBrutos" DECIMAL(6,2),
    "pLoteHogar" DECIMAL(6,2),
    "pRetencion" DECIMAL(6,2),
    "cuit" TEXT,
    "iibb" TEXT,
    "usoContable" BOOLEAN,
    "baja" BOOLEAN,
    "confirma" BOOLEAN,
    "saldoActual" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comercio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Comercio_organizacionId_baja_idx" ON "public"."Comercio"("organizacionId", "baja");

-- CreateIndex
CREATE UNIQUE INDEX "Comercio_organizacionId_codigo_key" ON "public"."Comercio"("organizacionId", "codigo");

-- CreateIndex
CREATE INDEX "OrdenCredito_organizacionId_comercioId_idx" ON "public"."OrdenCredito"("organizacionId", "comercioId");

-- CreateIndex
CREATE INDEX "OrdenCreditoCuota_comercioId_periodoVenc_estado_idx" ON "public"."OrdenCreditoCuota"("comercioId", "periodoVenc", "estado");

-- AddForeignKey
ALTER TABLE "public"."OrdenCredito" ADD CONSTRAINT "OrdenCredito_comercioId_fkey" FOREIGN KEY ("comercioId") REFERENCES "public"."Comercio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrdenCreditoCuota" ADD CONSTRAINT "OrdenCreditoCuota_comercioId_fkey" FOREIGN KEY ("comercioId") REFERENCES "public"."Comercio"("id") ON DELETE SET NULL ON UPDATE CASCADE;
