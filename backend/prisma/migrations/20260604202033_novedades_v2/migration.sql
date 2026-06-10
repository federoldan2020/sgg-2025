-- CreateTable
CREATE TABLE "NovedadLote" (
    "id" BIGSERIAL NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "canal" TEXT NOT NULL DEFAULT 'ESC',
    "estado" TEXT NOT NULL DEFAULT 'borrador',
    "generadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generadoPorId" TEXT,
    "enviadoEn" TIMESTAMP(3),
    "enviadoPorId" TEXT,
    "conciliadoEn" TIMESTAMP(3),
    "anuladoEn" TIMESTAMP(3),
    "anuladoPorId" TEXT,
    "motivoAnulacion" TEXT,
    "archivoNombre" TEXT,
    "archivoHash" TEXT,
    "archivoContenido" TEXT,
    "totalLineas" INTEGER NOT NULL DEFAULT 0,
    "totalAfiliados" INTEGER NOT NULL DEFAULT 0,
    "totalJ22" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalJ38" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalK16" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalJ17Altas" INTEGER NOT NULL DEFAULT 0,
    "totalJ17Bajas" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "NovedadLote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NovedadLoteItem" (
    "id" BIGSERIAL NOT NULL,
    "loteId" BIGINT NOT NULL,
    "padronId" BIGINT NOT NULL,
    "afiliadoId" BIGINT NOT NULL,
    "centroSnapshot" INTEGER,
    "padronSnapshot" TEXT NOT NULL,
    "lineaCompleta" TEXT NOT NULL,
    "tipoMovimiento" TEXT NOT NULL,
    "indicador" TEXT NOT NULL DEFAULT 'B3',
    "valorJ17" DECIMAL(12,2),
    "valorJ22" DECIMAL(12,2),
    "valorJ38" DECIMAL(12,2),
    "valorK16" DECIMAL(12,2),

    CONSTRAINT "NovedadLoteItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NovedadK16Detalle" (
    "id" BIGSERIAL NOT NULL,
    "loteItemId" BIGINT NOT NULL,
    "obligacionId" BIGINT NOT NULL,
    "componente" TEXT NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "periodoOrigen" TEXT NOT NULL,

    CONSTRAINT "NovedadK16Detalle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NovedadLoteObligacion" (
    "id" BIGSERIAL NOT NULL,
    "loteId" BIGINT NOT NULL,
    "obligacionId" BIGINT NOT NULL,
    "desbloqueadaEn" TIMESTAMP(3),

    CONSTRAINT "NovedadLoteObligacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BajaInformable" (
    "id" BIGSERIAL NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "padronId" BIGINT NOT NULL,
    "codigo" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "observacion" TEXT,
    "fechaSolicitada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "solicitadoPorId" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "loteEnvioId" BIGINT,
    "fechaInformada" TIMESTAMP(3),
    "fechaCancelada" TIMESTAMP(3),
    "canceladaPorId" TEXT,
    "motivoCancelacion" TEXT,

    CONSTRAINT "BajaInformable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NovedadLote_organizacionId_periodo_canal_estado_idx" ON "NovedadLote"("organizacionId", "periodo", "canal", "estado");

-- CreateIndex
CREATE INDEX "NovedadLoteItem_loteId_padronId_idx" ON "NovedadLoteItem"("loteId", "padronId");

-- CreateIndex
CREATE INDEX "NovedadLoteItem_padronId_idx" ON "NovedadLoteItem"("padronId");

-- CreateIndex
CREATE INDEX "NovedadK16Detalle_loteItemId_idx" ON "NovedadK16Detalle"("loteItemId");

-- CreateIndex
CREATE INDEX "NovedadLoteObligacion_obligacionId_idx" ON "NovedadLoteObligacion"("obligacionId");

-- CreateIndex
CREATE UNIQUE INDEX "NovedadLoteObligacion_loteId_obligacionId_key" ON "NovedadLoteObligacion"("loteId", "obligacionId");

-- CreateIndex
CREATE INDEX "BajaInformable_organizacionId_estado_idx" ON "BajaInformable"("organizacionId", "estado");

-- CreateIndex
CREATE INDEX "BajaInformable_padronId_codigo_estado_idx" ON "BajaInformable"("padronId", "codigo", "estado");

-- AddForeignKey
ALTER TABLE "NovedadLote" ADD CONSTRAINT "NovedadLote_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "Organizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NovedadLoteItem" ADD CONSTRAINT "NovedadLoteItem_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "NovedadLote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NovedadLoteItem" ADD CONSTRAINT "NovedadLoteItem_padronId_fkey" FOREIGN KEY ("padronId") REFERENCES "Padron"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NovedadLoteItem" ADD CONSTRAINT "NovedadLoteItem_afiliadoId_fkey" FOREIGN KEY ("afiliadoId") REFERENCES "Afiliado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NovedadK16Detalle" ADD CONSTRAINT "NovedadK16Detalle_loteItemId_fkey" FOREIGN KEY ("loteItemId") REFERENCES "NovedadLoteItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NovedadK16Detalle" ADD CONSTRAINT "NovedadK16Detalle_obligacionId_fkey" FOREIGN KEY ("obligacionId") REFERENCES "Obligacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NovedadLoteObligacion" ADD CONSTRAINT "NovedadLoteObligacion_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "NovedadLote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NovedadLoteObligacion" ADD CONSTRAINT "NovedadLoteObligacion_obligacionId_fkey" FOREIGN KEY ("obligacionId") REFERENCES "Obligacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BajaInformable" ADD CONSTRAINT "BajaInformable_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "Organizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BajaInformable" ADD CONSTRAINT "BajaInformable_padronId_fkey" FOREIGN KEY ("padronId") REFERENCES "Padron"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BajaInformable" ADD CONSTRAINT "BajaInformable_loteEnvioId_fkey" FOREIGN KEY ("loteEnvioId") REFERENCES "NovedadLote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
