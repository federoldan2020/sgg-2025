-- CreateTable
CREATE TABLE "public"."OrdenCredito" (
    "id" BIGSERIAL NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "afiliadoId" BIGINT NOT NULL,
    "padronId" BIGINT,
    "descripcion" TEXT NOT NULL,
    "fechaAlta" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enCuotas" BOOLEAN NOT NULL DEFAULT false,
    "cantidadCuotas" INTEGER,
    "cuotaActual" INTEGER,
    "importeTotal" DECIMAL(12,2) NOT NULL,
    "saldoTotal" DECIMAL(12,2) NOT NULL,
    "periodoPrimera" TEXT,
    "tasaInteres" DECIMAL(7,4),
    "sistemaAmortizacion" TEXT,
    "preMaterializarMeses" INTEGER,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "referenciaExterna" TEXT,
    "obligacionId" BIGINT,

    CONSTRAINT "OrdenCredito_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OrdenCreditoCuota" (
    "id" BIGSERIAL NOT NULL,
    "ordenId" BIGINT NOT NULL,
    "numero" INTEGER NOT NULL,
    "periodoVenc" TEXT NOT NULL,
    "importe" DECIMAL(12,2) NOT NULL,
    "cancelado" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "saldo" DECIMAL(12,2) NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "obligacionId" BIGINT,
    "fechaGeneracionObligacion" TIMESTAMP(3),
    "fechaCancelacion" TIMESTAMP(3),

    CONSTRAINT "OrdenCreditoCuota_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrdenCredito_organizacionId_afiliadoId_estado_idx" ON "public"."OrdenCredito"("organizacionId", "afiliadoId", "estado");

-- CreateIndex
CREATE INDEX "OrdenCredito_organizacionId_padronId_idx" ON "public"."OrdenCredito"("organizacionId", "padronId");

-- CreateIndex
CREATE INDEX "OrdenCreditoCuota_periodoVenc_estado_idx" ON "public"."OrdenCreditoCuota"("periodoVenc", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "OrdenCreditoCuota_ordenId_numero_key" ON "public"."OrdenCreditoCuota"("ordenId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "OrdenCreditoCuota_ordenId_periodoVenc_key" ON "public"."OrdenCreditoCuota"("ordenId", "periodoVenc");

-- AddForeignKey
ALTER TABLE "public"."OrdenCredito" ADD CONSTRAINT "OrdenCredito_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "public"."Organizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrdenCredito" ADD CONSTRAINT "OrdenCredito_afiliadoId_fkey" FOREIGN KEY ("afiliadoId") REFERENCES "public"."Afiliado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrdenCredito" ADD CONSTRAINT "OrdenCredito_padronId_fkey" FOREIGN KEY ("padronId") REFERENCES "public"."Padron"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrdenCredito" ADD CONSTRAINT "OrdenCredito_obligacionId_fkey" FOREIGN KEY ("obligacionId") REFERENCES "public"."Obligacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrdenCreditoCuota" ADD CONSTRAINT "OrdenCreditoCuota_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "public"."OrdenCredito"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrdenCreditoCuota" ADD CONSTRAINT "OrdenCreditoCuota_obligacionId_fkey" FOREIGN KEY ("obligacionId") REFERENCES "public"."Obligacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
