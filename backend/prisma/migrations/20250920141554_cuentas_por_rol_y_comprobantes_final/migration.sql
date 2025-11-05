/*
  Warnings:

  - You are about to drop the column `saldoActual` on the `Tercero` table. All the data in the column will be lost.
  - You are about to drop the column `saldoInicial` on the `Tercero` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."TipoComprobanteTercero" AS ENUM ('FACTURA', 'PRESTACION', 'NOTA_CREDITO', 'NOTA_DEBITO');

-- CreateEnum
CREATE TYPE "public"."ClaseComprobanteAFIP" AS ENUM ('A', 'B', 'C', 'M', 'X');

-- CreateEnum
CREATE TYPE "public"."EstadoComprobanteTercero" AS ENUM ('borrador', 'emitido', 'contabilizado', 'pagado', 'anulado');

-- CreateEnum
CREATE TYPE "public"."TipoImpuestoComprobante" AS ENUM ('IVA', 'IVA_EXENTO', 'IVA_NO_GRAVADO', 'PERCEPCION_IVA', 'RETENCION_IVA', 'RETENCION_GANANCIAS', 'PERCEPCION_IIBB', 'RETENCION_IIBB', 'IMP_MUNICIPAL', 'IMP_INTERNO', 'OTRO', 'GASTO_ADMINISTRATIVO');

-- CreateEnum
CREATE TYPE "public"."EstadoOrdenPago" AS ENUM ('borrador', 'confirmado', 'anulado');

-- CreateEnum
CREATE TYPE "public"."MetodoPagoOP" AS ENUM ('transferencia', 'cheque', 'efectivo', 'otro');

-- AlterTable
ALTER TABLE "public"."Tercero" DROP COLUMN "saldoActual",
DROP COLUMN "saldoInicial";

-- CreateTable
CREATE TABLE "public"."CuentaTercero" (
    "id" BIGSERIAL NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "terceroId" BIGINT NOT NULL,
    "rol" "public"."RolTercero" NOT NULL,
    "saldoInicial" DECIMAL(18,2),
    "saldoActual" DECIMAL(18,2),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CuentaTercero_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MovimientoCuentaTercero" (
    "id" BIGSERIAL NOT NULL,
    "cuentaId" BIGINT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo" TEXT NOT NULL,
    "origen" TEXT NOT NULL,
    "referenciaId" BIGINT,
    "detalle" TEXT,
    "monto" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "MovimientoCuentaTercero_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ComprobanteTercero" (
    "id" BIGSERIAL NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "terceroId" BIGINT NOT NULL,
    "cuentaId" BIGINT NOT NULL,
    "rol" "public"."RolTercero" NOT NULL,
    "tipo" "public"."TipoComprobanteTercero" NOT NULL,
    "clase" "public"."ClaseComprobanteAFIP",
    "puntoVenta" INTEGER,
    "numero" INTEGER,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vencimiento" TIMESTAMP(3),
    "moneda" TEXT NOT NULL DEFAULT 'ARS',
    "estado" "public"."EstadoComprobanteTercero" NOT NULL DEFAULT 'borrador',
    "netoGravado21" DECIMAL(18,2),
    "netoGravado105" DECIMAL(18,2),
    "netoGravado27" DECIMAL(18,2),
    "netoNoGravado" DECIMAL(18,2),
    "netoExento" DECIMAL(18,2),
    "iva21" DECIMAL(18,2),
    "iva105" DECIMAL(18,2),
    "iva27" DECIMAL(18,2),
    "percepIVA" DECIMAL(18,2),
    "retIVA" DECIMAL(18,2),
    "retGanancias" DECIMAL(18,2),
    "percepIIBB" DECIMAL(18,2),
    "retIIBB" DECIMAL(18,2),
    "impMunicipal" DECIMAL(18,2),
    "impInterno" DECIMAL(18,2),
    "gastoAdmin" DECIMAL(18,2),
    "otrosImpuestos" DECIMAL(18,2),
    "total" DECIMAL(18,2) NOT NULL,
    "cae" TEXT,
    "cuitEmisor" VARCHAR(20),
    "observaciones" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComprobanteTercero_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ComprobanteTerceroLinea" (
    "id" BIGSERIAL NOT NULL,
    "comprobanteId" BIGINT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "cantidad" DECIMAL(18,4) NOT NULL,
    "precioUnitario" DECIMAL(18,6) NOT NULL,
    "alicuotaIVA" DECIMAL(5,2),
    "importeNeto" DECIMAL(18,2) NOT NULL,
    "importeIVA" DECIMAL(18,2),
    "importeTotal" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "ComprobanteTerceroLinea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ComprobanteTerceroImpuesto" (
    "id" BIGSERIAL NOT NULL,
    "comprobanteId" BIGINT NOT NULL,
    "tipo" "public"."TipoImpuestoComprobante" NOT NULL,
    "detalle" TEXT,
    "jurisdiccion" TEXT,
    "alicuota" DECIMAL(7,4),
    "baseImponible" DECIMAL(18,2),
    "importe" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "ComprobanteTerceroImpuesto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OrdenPagoTercero" (
    "id" BIGSERIAL NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "terceroId" BIGINT NOT NULL,
    "cuentaId" BIGINT NOT NULL,
    "rol" "public"."RolTercero" NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" "public"."EstadoOrdenPago" NOT NULL DEFAULT 'borrador',
    "total" DECIMAL(18,2) NOT NULL,
    "observaciones" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrdenPagoTercero_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OrdenPagoAplicacion" (
    "id" BIGSERIAL NOT NULL,
    "ordenId" BIGINT NOT NULL,
    "comprobanteId" BIGINT NOT NULL,
    "montoAplicado" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "OrdenPagoAplicacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OrdenPagoMetodo" (
    "id" BIGSERIAL NOT NULL,
    "ordenId" BIGINT NOT NULL,
    "metodo" "public"."MetodoPagoOP" NOT NULL,
    "monto" DECIMAL(18,2) NOT NULL,
    "ref" TEXT,

    CONSTRAINT "OrdenPagoMetodo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CuentaTercero_organizacionId_rol_idx" ON "public"."CuentaTercero"("organizacionId", "rol");

-- CreateIndex
CREATE INDEX "CuentaTercero_terceroId_rol_idx" ON "public"."CuentaTercero"("terceroId", "rol");

-- CreateIndex
CREATE UNIQUE INDEX "CuentaTercero_organizacionId_terceroId_rol_key" ON "public"."CuentaTercero"("organizacionId", "terceroId", "rol");

-- CreateIndex
CREATE INDEX "MovimientoCuentaTercero_cuentaId_fecha_idx" ON "public"."MovimientoCuentaTercero"("cuentaId", "fecha");

-- CreateIndex
CREATE INDEX "ComprobanteTercero_organizacionId_rol_estado_idx" ON "public"."ComprobanteTercero"("organizacionId", "rol", "estado");

-- CreateIndex
CREATE INDEX "ComprobanteTercero_terceroId_rol_estado_idx" ON "public"."ComprobanteTercero"("terceroId", "rol", "estado");

-- CreateIndex
CREATE INDEX "ComprobanteTercero_cuentaId_estado_idx" ON "public"."ComprobanteTercero"("cuentaId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "ComprobanteTercero_organizacionId_terceroId_tipo_clase_punt_key" ON "public"."ComprobanteTercero"("organizacionId", "terceroId", "tipo", "clase", "puntoVenta", "numero");

-- CreateIndex
CREATE INDEX "ComprobanteTerceroLinea_comprobanteId_idx" ON "public"."ComprobanteTerceroLinea"("comprobanteId");

-- CreateIndex
CREATE INDEX "ComprobanteTerceroImpuesto_comprobanteId_tipo_idx" ON "public"."ComprobanteTerceroImpuesto"("comprobanteId", "tipo");

-- CreateIndex
CREATE INDEX "OrdenPagoTercero_organizacionId_rol_estado_idx" ON "public"."OrdenPagoTercero"("organizacionId", "rol", "estado");

-- CreateIndex
CREATE INDEX "OrdenPagoTercero_terceroId_rol_estado_idx" ON "public"."OrdenPagoTercero"("terceroId", "rol", "estado");

-- CreateIndex
CREATE INDEX "OrdenPagoTercero_cuentaId_estado_idx" ON "public"."OrdenPagoTercero"("cuentaId", "estado");

-- CreateIndex
CREATE INDEX "OrdenPagoAplicacion_ordenId_idx" ON "public"."OrdenPagoAplicacion"("ordenId");

-- CreateIndex
CREATE INDEX "OrdenPagoAplicacion_comprobanteId_idx" ON "public"."OrdenPagoAplicacion"("comprobanteId");

-- CreateIndex
CREATE INDEX "OrdenPagoMetodo_ordenId_idx" ON "public"."OrdenPagoMetodo"("ordenId");

-- AddForeignKey
ALTER TABLE "public"."CuentaTercero" ADD CONSTRAINT "CuentaTercero_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "public"."Organizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CuentaTercero" ADD CONSTRAINT "CuentaTercero_terceroId_fkey" FOREIGN KEY ("terceroId") REFERENCES "public"."Tercero"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MovimientoCuentaTercero" ADD CONSTRAINT "MovimientoCuentaTercero_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "public"."CuentaTercero"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ComprobanteTercero" ADD CONSTRAINT "ComprobanteTercero_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "public"."Organizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ComprobanteTercero" ADD CONSTRAINT "ComprobanteTercero_terceroId_fkey" FOREIGN KEY ("terceroId") REFERENCES "public"."Tercero"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ComprobanteTercero" ADD CONSTRAINT "ComprobanteTercero_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "public"."CuentaTercero"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ComprobanteTerceroLinea" ADD CONSTRAINT "ComprobanteTerceroLinea_comprobanteId_fkey" FOREIGN KEY ("comprobanteId") REFERENCES "public"."ComprobanteTercero"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ComprobanteTerceroImpuesto" ADD CONSTRAINT "ComprobanteTerceroImpuesto_comprobanteId_fkey" FOREIGN KEY ("comprobanteId") REFERENCES "public"."ComprobanteTercero"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrdenPagoTercero" ADD CONSTRAINT "OrdenPagoTercero_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "public"."Organizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrdenPagoTercero" ADD CONSTRAINT "OrdenPagoTercero_terceroId_fkey" FOREIGN KEY ("terceroId") REFERENCES "public"."Tercero"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrdenPagoTercero" ADD CONSTRAINT "OrdenPagoTercero_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "public"."CuentaTercero"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrdenPagoAplicacion" ADD CONSTRAINT "OrdenPagoAplicacion_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "public"."OrdenPagoTercero"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrdenPagoAplicacion" ADD CONSTRAINT "OrdenPagoAplicacion_comprobanteId_fkey" FOREIGN KEY ("comprobanteId") REFERENCES "public"."ComprobanteTercero"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrdenPagoMetodo" ADD CONSTRAINT "OrdenPagoMetodo_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "public"."OrdenPagoTercero"("id") ON DELETE CASCADE ON UPDATE CASCADE;
