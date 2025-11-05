-- CreateTable
CREATE TABLE "public"."LoteNovedad" (
    "id" BIGSERIAL NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "generadoPor" TEXT,
    "generadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalRegistros" INTEGER NOT NULL DEFAULT 0,
    "totalImporte" DECIMAL(14,2) NOT NULL DEFAULT 0,

    CONSTRAINT "LoteNovedad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."NovedadDetalle" (
    "id" BIGSERIAL NOT NULL,
    "loteId" BIGINT NOT NULL,
    "afiliadoId" BIGINT NOT NULL,
    "padronId" BIGINT,
    "codigo" TEXT NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "NovedadDetalle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LoteNomina" (
    "id" BIGSERIAL NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "archivoNombre" TEXT,
    "hashContenido" TEXT,
    "cargadoPor" TEXT,
    "cargadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" TEXT NOT NULL DEFAULT 'previsualizado',

    CONSTRAINT "LoteNomina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."NominaDetalle" (
    "id" BIGSERIAL NOT NULL,
    "loteId" BIGINT NOT NULL,
    "afiliadoId" BIGINT NOT NULL,
    "padronId" BIGINT,
    "codigo" TEXT NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "NominaDetalle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CreditoFavor" (
    "id" BIGSERIAL NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "afiliadoId" BIGINT NOT NULL,
    "periodo" TEXT,
    "origen" TEXT NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "saldo" DECIMAL(14,2) NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditoFavor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LoteNovedad_organizacionId_periodo_idx" ON "public"."LoteNovedad"("organizacionId", "periodo");

-- CreateIndex
CREATE INDEX "NovedadDetalle_loteId_idx" ON "public"."NovedadDetalle"("loteId");

-- CreateIndex
CREATE INDEX "NovedadDetalle_afiliadoId_idx" ON "public"."NovedadDetalle"("afiliadoId");

-- CreateIndex
CREATE INDEX "LoteNomina_organizacionId_periodo_idx" ON "public"."LoteNomina"("organizacionId", "periodo");

-- CreateIndex
CREATE UNIQUE INDEX "LoteNomina_organizacionId_periodo_hashContenido_key" ON "public"."LoteNomina"("organizacionId", "periodo", "hashContenido");

-- CreateIndex
CREATE INDEX "NominaDetalle_loteId_idx" ON "public"."NominaDetalle"("loteId");

-- CreateIndex
CREATE INDEX "NominaDetalle_afiliadoId_idx" ON "public"."NominaDetalle"("afiliadoId");

-- CreateIndex
CREATE INDEX "CreditoFavor_organizacionId_afiliadoId_idx" ON "public"."CreditoFavor"("organizacionId", "afiliadoId");

-- AddForeignKey
ALTER TABLE "public"."LoteNovedad" ADD CONSTRAINT "LoteNovedad_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "public"."Organizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NovedadDetalle" ADD CONSTRAINT "NovedadDetalle_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "public"."LoteNovedad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NovedadDetalle" ADD CONSTRAINT "NovedadDetalle_afiliadoId_fkey" FOREIGN KEY ("afiliadoId") REFERENCES "public"."Afiliado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NovedadDetalle" ADD CONSTRAINT "NovedadDetalle_padronId_fkey" FOREIGN KEY ("padronId") REFERENCES "public"."Padron"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LoteNomina" ADD CONSTRAINT "LoteNomina_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "public"."Organizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NominaDetalle" ADD CONSTRAINT "NominaDetalle_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "public"."LoteNomina"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NominaDetalle" ADD CONSTRAINT "NominaDetalle_afiliadoId_fkey" FOREIGN KEY ("afiliadoId") REFERENCES "public"."Afiliado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NominaDetalle" ADD CONSTRAINT "NominaDetalle_padronId_fkey" FOREIGN KEY ("padronId") REFERENCES "public"."Padron"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CreditoFavor" ADD CONSTRAINT "CreditoFavor_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "public"."Organizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CreditoFavor" ADD CONSTRAINT "CreditoFavor_afiliadoId_fkey" FOREIGN KEY ("afiliadoId") REFERENCES "public"."Afiliado"("id") ON DELETE CASCADE ON UPDATE CASCADE;
