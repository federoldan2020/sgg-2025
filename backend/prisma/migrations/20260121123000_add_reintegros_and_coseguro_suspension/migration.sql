-- AlterTable
ALTER TABLE "public"."CoseguroAfiliado"
ADD COLUMN "suspendidoEn" DATE,
ADD COLUMN "motivoSuspension" TEXT,
ADD COLUMN "suspendidoPorId" TEXT;

-- CreateEnum
CREATE TYPE "ReintegroTipo" AS ENUM ('MEDICAMENTO', 'PRACTICA');

-- CreateEnum
CREATE TYPE "ReintegroEstado" AS ENUM ('BORRADOR', 'PRESENTADO', 'EN_REVISION', 'OBSERVADO', 'APROBADO', 'RECHAZADO', 'A_PAGAR', 'PAGADO', 'CERRADO');

-- CreateEnum
CREATE TYPE "ReintegroPersonaTipo" AS ENUM ('TITULAR', 'FAMILIAR');

-- CreateEnum
CREATE TYPE "ReintegroAdjuntoTipo" AS ENUM ('FACTURA', 'RECETA', 'ORDEN', 'INFORME', 'OTRO');

-- CreateEnum
CREATE TYPE "ReintegroMedioPago" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'CHEQUE', 'OTRO');

-- CreateEnum
CREATE TYPE "ReintegroPagoEstado" AS ENUM ('PENDIENTE', 'PAGADO', 'ANULADO');

-- CreateTable
CREATE TABLE "public"."ReintegroSolicitud" (
    "id" BIGSERIAL NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "personaTipo" "ReintegroPersonaTipo" NOT NULL,
    "afiliadoId" BIGINT NOT NULL,
    "familiarId" BIGINT,
    "tipo" "ReintegroTipo" NOT NULL,
    "estado" "ReintegroEstado" NOT NULL DEFAULT 'BORRADOR',
    "fechaFactura" DATE NOT NULL,
    "fechaPresentacion" DATE,
    "importeTotal" DECIMAL(14,2) NOT NULL,
    "importeAprobado" DECIMAL(14,2),
    "padronId" BIGINT,
    "observaciones" TEXT,
    "creadoPorId" TEXT,
    "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReintegroSolicitud_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReintegroItem" (
    "id" BIGSERIAL NOT NULL,
    "solicitudId" BIGINT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "importe" DECIMAL(14,2) NOT NULL,
    "importeAprobado" DECIMAL(14,2),
    "codigoNomenclador" TEXT,
    "tipoItem" "ReintegroTipo" NOT NULL,

    CONSTRAINT "ReintegroItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReintegroAdjunto" (
    "id" BIGSERIAL NOT NULL,
    "solicitudId" BIGINT NOT NULL,
    "tipoAdjunto" "ReintegroAdjuntoTipo" NOT NULL,
    "url" TEXT NOT NULL,
    "hash" TEXT,
    "mime" TEXT,
    "size" INTEGER,
    "fechaSubida" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subidoPorId" TEXT,

    CONSTRAINT "ReintegroAdjunto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReintegroHistorialEstado" (
    "id" BIGSERIAL NOT NULL,
    "solicitudId" BIGINT NOT NULL,
    "estadoAnterior" "ReintegroEstado",
    "estadoNuevo" "ReintegroEstado" NOT NULL,
    "observacion" TEXT,
    "actorId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payloadAntes" JSONB,
    "payloadDespues" JSONB,

    CONSTRAINT "ReintegroHistorialEstado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReintegroPolitica" (
    "id" BIGSERIAL NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "vigenteDesde" DATE NOT NULL,
    "vigenteHasta" DATE,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "topeMensual" DECIMAL(14,2),
    "topeAnual" DECIMAL(14,2),
    "porcentajeMedicamento" DECIMAL(5,2),
    "porcentajePractica" DECIMAL(5,2),
    "diasVentanaPresentacion" INTEGER,
    "carenciaMeses" INTEGER,
    "maxOrdenesPorGrupo" INTEGER,
    "maxMedicamentosPorOrden" INTEGER,
    "topesPrestaciones" JSONB,
    "requisitosAdjuntos" JSONB,
    "exclusiones" JSONB,

    CONSTRAINT "ReintegroPolitica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReintegroPago" (
    "id" BIGSERIAL NOT NULL,
    "solicitudId" BIGINT NOT NULL,
    "ordenPagoId" BIGINT,
    "monto" DECIMAL(14,2) NOT NULL,
    "medioPago" "ReintegroMedioPago" NOT NULL,
    "fechaPago" DATE,
    "estadoPago" "ReintegroPagoEstado" NOT NULL DEFAULT 'PENDIENTE',

    CONSTRAINT "ReintegroPago_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReintegroSolicitud_organizacionId_afiliadoId_idx" ON "public"."ReintegroSolicitud"("organizacionId", "afiliadoId");
CREATE INDEX "ReintegroSolicitud_organizacionId_estado_idx" ON "public"."ReintegroSolicitud"("organizacionId", "estado");
CREATE INDEX "ReintegroSolicitud_organizacionId_tipo_idx" ON "public"."ReintegroSolicitud"("organizacionId", "tipo");
CREATE INDEX "ReintegroSolicitud_fechaFactura_idx" ON "public"."ReintegroSolicitud"("fechaFactura");

-- CreateIndex
CREATE INDEX "ReintegroItem_solicitudId_idx" ON "public"."ReintegroItem"("solicitudId");

-- CreateIndex
CREATE INDEX "ReintegroAdjunto_solicitudId_idx" ON "public"."ReintegroAdjunto"("solicitudId");

-- CreateIndex
CREATE INDEX "ReintegroHistorialEstado_solicitudId_idx" ON "public"."ReintegroHistorialEstado"("solicitudId");
CREATE INDEX "ReintegroHistorialEstado_estadoNuevo_idx" ON "public"."ReintegroHistorialEstado"("estadoNuevo");

-- CreateIndex
CREATE INDEX "ReintegroPolitica_organizacionId_vigenteDesde_idx" ON "public"."ReintegroPolitica"("organizacionId", "vigenteDesde");
CREATE INDEX "ReintegroPolitica_organizacionId_activo_idx" ON "public"."ReintegroPolitica"("organizacionId", "activo");

-- CreateIndex
CREATE INDEX "ReintegroPago_solicitudId_idx" ON "public"."ReintegroPago"("solicitudId");

-- AddForeignKey
ALTER TABLE "public"."ReintegroSolicitud" ADD CONSTRAINT "ReintegroSolicitud_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "public"."Organizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."ReintegroSolicitud" ADD CONSTRAINT "ReintegroSolicitud_afiliadoId_fkey" FOREIGN KEY ("afiliadoId") REFERENCES "public"."Afiliado"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."ReintegroSolicitud" ADD CONSTRAINT "ReintegroSolicitud_familiarId_fkey" FOREIGN KEY ("familiarId") REFERENCES "public"."Colateral"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."ReintegroSolicitud" ADD CONSTRAINT "ReintegroSolicitud_padronId_fkey" FOREIGN KEY ("padronId") REFERENCES "public"."Padron"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."ReintegroItem" ADD CONSTRAINT "ReintegroItem_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "public"."ReintegroSolicitud"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."ReintegroAdjunto" ADD CONSTRAINT "ReintegroAdjunto_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "public"."ReintegroSolicitud"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."ReintegroHistorialEstado" ADD CONSTRAINT "ReintegroHistorialEstado_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "public"."ReintegroSolicitud"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."ReintegroPago" ADD CONSTRAINT "ReintegroPago_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "public"."ReintegroSolicitud"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."ReintegroPolitica" ADD CONSTRAINT "ReintegroPolitica_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "public"."Organizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
