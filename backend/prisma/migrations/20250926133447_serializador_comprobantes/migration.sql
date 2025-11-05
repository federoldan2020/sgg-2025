-- CreateEnum
CREATE TYPE "public"."ComprobanteTipo" AS ENUM ('ORDEN_PAGO', 'RECIBO_AFILIADO', 'REINTEGRO_AFILIADO');

-- CreateEnum
CREATE TYPE "public"."ComprobanteFormato" AS ENUM ('A4', 'A5', 'TICKET_80MM');

-- CreateEnum
CREATE TYPE "public"."ComprobanteEstado" AS ENUM ('EMITIDO', 'ANULADO');

-- CreateTable
CREATE TABLE "public"."Numerador" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "tipo" "public"."ComprobanteTipo" NOT NULL,
    "ptoVta" INTEGER NOT NULL DEFAULT 1,
    "serie" TEXT,
    "ultimoNumero" INTEGER NOT NULL DEFAULT 0,
    "longitud" INTEGER NOT NULL DEFAULT 8,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Numerador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Comprobante" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "tipo" "public"."ComprobanteTipo" NOT NULL,
    "ptoVta" INTEGER NOT NULL DEFAULT 1,
    "serie" TEXT,
    "numero" INTEGER,
    "numeroCompleto" TEXT,
    "titulo" TEXT,
    "fechaEmision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "terceroId" TEXT,
    "terceroNombre" TEXT,
    "terceroCuit" TEXT,
    "subtotal" DECIMAL(18,2),
    "descuentos" DECIMAL(18,2),
    "percepciones" DECIMAL(18,2),
    "impuestos" DECIMAL(18,2),
    "total" DECIMAL(18,2) NOT NULL,
    "notas" TEXT,
    "formato" "public"."ComprobanteFormato" NOT NULL DEFAULT 'A4',
    "copias" INTEGER NOT NULL DEFAULT 2,
    "templateArchivo" TEXT NOT NULL,
    "templateCss" TEXT NOT NULL,
    "templateVersion" TEXT,
    "pdfStorageKey" TEXT,
    "pdfHash" TEXT,
    "payload" JSONB NOT NULL,
    "estado" "public"."ComprobanteEstado" NOT NULL DEFAULT 'EMITIDO',
    "anuladoMotivo" TEXT,
    "anuladoAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comprobante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ComprobanteItem" (
    "id" TEXT NOT NULL,
    "comprobanteId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "desc" TEXT NOT NULL,
    "cantidad" DECIMAL(12,2) NOT NULL,
    "pUnit" DECIMAL(12,2),
    "importe" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "ComprobanteItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Numerador_organizacionId_tipo_ptoVta_serie_key" ON "public"."Numerador"("organizacionId", "tipo", "ptoVta", "serie");

-- CreateIndex
CREATE INDEX "Comprobante_organizacionId_fechaEmision_idx" ON "public"."Comprobante"("organizacionId", "fechaEmision");

-- CreateIndex
CREATE INDEX "Comprobante_tipo_fechaEmision_idx" ON "public"."Comprobante"("tipo", "fechaEmision");

-- CreateIndex
CREATE UNIQUE INDEX "Comprobante_organizacionId_tipo_ptoVta_serie_numero_key" ON "public"."Comprobante"("organizacionId", "tipo", "ptoVta", "serie", "numero");

-- CreateIndex
CREATE INDEX "ComprobanteItem_comprobanteId_orden_idx" ON "public"."ComprobanteItem"("comprobanteId", "orden");

-- AddForeignKey
ALTER TABLE "public"."ComprobanteItem" ADD CONSTRAINT "ComprobanteItem_comprobanteId_fkey" FOREIGN KEY ("comprobanteId") REFERENCES "public"."Comprobante"("id") ON DELETE CASCADE ON UPDATE CASCADE;
