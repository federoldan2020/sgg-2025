-- AlterTable
ALTER TABLE "public"."Obligacion" ADD COLUMN     "bloqueada" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "conciliacionEstado" TEXT NOT NULL DEFAULT 'pendiente',
ADD COLUMN     "conciliacionFecha" TIMESTAMP(3),
ADD COLUMN     "conciliacionImporte" DECIMAL(12,2),
ADD COLUMN     "novedadLoteId" BIGINT;

-- AlterTable
ALTER TABLE "public"."Pago" ADD COLUMN     "origen" TEXT;

-- CreateTable
CREATE TABLE "public"."OrganizacionConfig" (
    "id" BIGSERIAL NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "valorBool" BOOLEAN,
    "valorString" TEXT,
    "valorNumber" DECIMAL(12,2),

    CONSTRAINT "OrganizacionConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."NovedadLote" (
    "id" BIGSERIAL NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "fechaEnvio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" TEXT NOT NULL DEFAULT 'enviado',

    CONSTRAINT "NovedadLote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."NovedadItem" (
    "id" BIGSERIAL NOT NULL,
    "novedadLoteId" BIGINT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "afiliadoId" BIGINT NOT NULL,
    "padronId" BIGINT,
    "canal" TEXT NOT NULL,
    "conceptoId" BIGINT,
    "importeEnviado" DECIMAL(12,2) NOT NULL,
    "importeCobrado" DECIMAL(12,2),
    "conciliacionEstado" TEXT NOT NULL DEFAULT 'pendiente',
    "conciliacionFecha" TIMESTAMP(3),

    CONSTRAINT "NovedadItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."NovedadItemDetalle" (
    "id" BIGSERIAL NOT NULL,
    "novedadItemId" BIGINT NOT NULL,
    "obligacionId" BIGINT NOT NULL,
    "importe" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "NovedadItemDetalle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CreditoAfiliado" (
    "id" BIGSERIAL NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "afiliadoId" BIGINT NOT NULL,
    "origen" TEXT NOT NULL,
    "motivo" TEXT,
    "montoTotal" DECIMAL(12,2) NOT NULL,
    "montoDisponible" DECIMAL(12,2) NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'abierto',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditoAfiliado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AplicacionCredito" (
    "id" BIGSERIAL NOT NULL,
    "creditoId" BIGINT NOT NULL,
    "obligacionId" BIGINT NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AplicacionCredito_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrganizacionConfig_organizacionId_idx" ON "public"."OrganizacionConfig"("organizacionId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizacionConfig_organizacionId_clave_key" ON "public"."OrganizacionConfig"("organizacionId", "clave");

-- CreateIndex
CREATE INDEX "NovedadLote_organizacionId_periodo_idx" ON "public"."NovedadLote"("organizacionId", "periodo");

-- CreateIndex
CREATE INDEX "NovedadItem_organizacionId_novedadLoteId_idx" ON "public"."NovedadItem"("organizacionId", "novedadLoteId");

-- CreateIndex
CREATE INDEX "NovedadItem_organizacionId_afiliadoId_idx" ON "public"."NovedadItem"("organizacionId", "afiliadoId");

-- CreateIndex
CREATE INDEX "NovedadItem_organizacionId_canal_idx" ON "public"."NovedadItem"("organizacionId", "canal");

-- CreateIndex
CREATE INDEX "NovedadItemDetalle_novedadItemId_idx" ON "public"."NovedadItemDetalle"("novedadItemId");

-- CreateIndex
CREATE INDEX "NovedadItemDetalle_obligacionId_idx" ON "public"."NovedadItemDetalle"("obligacionId");

-- CreateIndex
CREATE INDEX "CreditoAfiliado_organizacionId_afiliadoId_idx" ON "public"."CreditoAfiliado"("organizacionId", "afiliadoId");

-- CreateIndex
CREATE INDEX "AplicacionCredito_creditoId_idx" ON "public"."AplicacionCredito"("creditoId");

-- CreateIndex
CREATE INDEX "AplicacionCredito_obligacionId_idx" ON "public"."AplicacionCredito"("obligacionId");

-- CreateIndex
CREATE INDEX "Obligacion_organizacionId_novedadLoteId_idx" ON "public"."Obligacion"("organizacionId", "novedadLoteId");

-- AddForeignKey
ALTER TABLE "public"."Obligacion" ADD CONSTRAINT "Obligacion_novedadLoteId_fkey" FOREIGN KEY ("novedadLoteId") REFERENCES "public"."NovedadLote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrganizacionConfig" ADD CONSTRAINT "OrganizacionConfig_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "public"."Organizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NovedadLote" ADD CONSTRAINT "NovedadLote_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "public"."Organizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NovedadItem" ADD CONSTRAINT "NovedadItem_novedadLoteId_fkey" FOREIGN KEY ("novedadLoteId") REFERENCES "public"."NovedadLote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NovedadItem" ADD CONSTRAINT "NovedadItem_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "public"."Organizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NovedadItem" ADD CONSTRAINT "NovedadItem_afiliadoId_fkey" FOREIGN KEY ("afiliadoId") REFERENCES "public"."Afiliado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NovedadItem" ADD CONSTRAINT "NovedadItem_padronId_fkey" FOREIGN KEY ("padronId") REFERENCES "public"."Padron"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NovedadItem" ADD CONSTRAINT "NovedadItem_conceptoId_fkey" FOREIGN KEY ("conceptoId") REFERENCES "public"."Concepto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NovedadItemDetalle" ADD CONSTRAINT "NovedadItemDetalle_novedadItemId_fkey" FOREIGN KEY ("novedadItemId") REFERENCES "public"."NovedadItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NovedadItemDetalle" ADD CONSTRAINT "NovedadItemDetalle_obligacionId_fkey" FOREIGN KEY ("obligacionId") REFERENCES "public"."Obligacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CreditoAfiliado" ADD CONSTRAINT "CreditoAfiliado_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "public"."Organizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CreditoAfiliado" ADD CONSTRAINT "CreditoAfiliado_afiliadoId_fkey" FOREIGN KEY ("afiliadoId") REFERENCES "public"."Afiliado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AplicacionCredito" ADD CONSTRAINT "AplicacionCredito_creditoId_fkey" FOREIGN KEY ("creditoId") REFERENCES "public"."CreditoAfiliado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AplicacionCredito" ADD CONSTRAINT "AplicacionCredito_obligacionId_fkey" FOREIGN KEY ("obligacionId") REFERENCES "public"."Obligacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
