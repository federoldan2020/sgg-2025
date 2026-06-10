-- AlterTable
ALTER TABLE "Padron" ADD COLUMN     "evaluadoCoberturaEn" TIMESTAMP(3),
ADD COLUMN     "ultimoMontoCobradoJ17" DECIMAL(14,2),
ADD COLUMN     "ultimoPeriodoCobranzaJ17" TEXT;

-- CreateTable
CREATE TABLE "ParametroJ17Minimo" (
    "id" BIGSERIAL NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "vigenteDesde" DATE NOT NULL,
    "vigenteHasta" DATE,
    "creadoPorId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParametroJ17Minimo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParametroJ17Cuota04" (
    "id" BIGSERIAL NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "vigenteDesde" DATE NOT NULL,
    "vigenteHasta" DATE,
    "creadoPorId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParametroJ17Cuota04_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AfiliadoSuspension" (
    "id" BIGSERIAL NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "afiliadoId" BIGINT NOT NULL,
    "periodoOrigen" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'provisoria',
    "fechaInicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaFirme" TIMESTAMP(3),
    "fechaFin" TIMESTAMP(3),
    "motivoFin" TEXT,
    "creadoPorId" TEXT,
    "finalizadoPorId" TEXT,
    "observacion" TEXT,

    CONSTRAINT "AfiliadoSuspension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AfiliadoExcepcionSuspension" (
    "id" BIGSERIAL NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "afiliadoId" BIGINT NOT NULL,
    "motivo" TEXT NOT NULL,
    "vigenciaHasta" DATE,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creadoPorId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "desactivadoEn" TIMESTAMP(3),
    "desactivadoPorId" TEXT,

    CONSTRAINT "AfiliadoExcepcionSuspension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoberturaAfiliadoPeriodo" (
    "id" BIGSERIAL NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "afiliadoId" BIGINT NOT NULL,
    "periodo" TEXT NOT NULL,
    "j17Esperado" DECIMAL(12,2) NOT NULL,
    "j17Cobrado" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "j22Esperado" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "j22Cobrado" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "j38Esperado" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "j38Cobrado" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "k16Esperado" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "k16Cobrado" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cubierto" BOOLEAN NOT NULL,
    "deudaTotal" DECIMAL(12,2) NOT NULL,
    "calculadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoberturaAfiliadoPeriodo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CierreMensual" (
    "id" BIGSERIAL NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'en_curso',
    "iniciadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizadoEn" TIMESTAMP(3),
    "iniciadoPorId" TEXT,
    "totalSuspendidos" INTEGER NOT NULL DEFAULT 0,
    "totalRehabilitados" INTEGER NOT NULL DEFAULT 0,
    "totalPadronesMarcados" INTEGER NOT NULL DEFAULT 0,
    "totalExcluidos" INTEGER NOT NULL DEFAULT 0,
    "resumen" JSONB,
    "errorMensaje" TEXT,

    CONSTRAINT "CierreMensual_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ParametroJ17Minimo_organizacionId_vigenteDesde_idx" ON "ParametroJ17Minimo"("organizacionId", "vigenteDesde");

-- CreateIndex
CREATE INDEX "ParametroJ17Cuota04_organizacionId_vigenteDesde_idx" ON "ParametroJ17Cuota04"("organizacionId", "vigenteDesde");

-- CreateIndex
CREATE INDEX "AfiliadoSuspension_organizacionId_afiliadoId_idx" ON "AfiliadoSuspension"("organizacionId", "afiliadoId");

-- CreateIndex
CREATE INDEX "AfiliadoSuspension_organizacionId_estado_idx" ON "AfiliadoSuspension"("organizacionId", "estado");

-- CreateIndex
CREATE INDEX "AfiliadoSuspension_organizacionId_periodoOrigen_idx" ON "AfiliadoSuspension"("organizacionId", "periodoOrigen");

-- CreateIndex
CREATE INDEX "AfiliadoSuspension_organizacionId_afiliadoId_estado_idx" ON "AfiliadoSuspension"("organizacionId", "afiliadoId", "estado");

-- CreateIndex
CREATE INDEX "AfiliadoExcepcionSuspension_organizacionId_afiliadoId_activ_idx" ON "AfiliadoExcepcionSuspension"("organizacionId", "afiliadoId", "activa");

-- CreateIndex
CREATE INDEX "AfiliadoExcepcionSuspension_organizacionId_activa_idx" ON "AfiliadoExcepcionSuspension"("organizacionId", "activa");

-- CreateIndex
CREATE INDEX "CoberturaAfiliadoPeriodo_organizacionId_periodo_cubierto_idx" ON "CoberturaAfiliadoPeriodo"("organizacionId", "periodo", "cubierto");

-- CreateIndex
CREATE INDEX "CoberturaAfiliadoPeriodo_organizacionId_afiliadoId_idx" ON "CoberturaAfiliadoPeriodo"("organizacionId", "afiliadoId");

-- CreateIndex
CREATE UNIQUE INDEX "CoberturaAfiliadoPeriodo_organizacionId_afiliadoId_periodo_key" ON "CoberturaAfiliadoPeriodo"("organizacionId", "afiliadoId", "periodo");

-- CreateIndex
CREATE INDEX "CierreMensual_organizacionId_periodo_idx" ON "CierreMensual"("organizacionId", "periodo");

-- CreateIndex
CREATE INDEX "CierreMensual_organizacionId_estado_idx" ON "CierreMensual"("organizacionId", "estado");

-- CreateIndex
CREATE INDEX "Afiliado_organizacionId_estado_idx" ON "Afiliado"("organizacionId", "estado");

-- AddForeignKey
ALTER TABLE "ParametroJ17Minimo" ADD CONSTRAINT "ParametroJ17Minimo_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "Organizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParametroJ17Cuota04" ADD CONSTRAINT "ParametroJ17Cuota04_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "Organizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AfiliadoSuspension" ADD CONSTRAINT "AfiliadoSuspension_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "Organizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AfiliadoSuspension" ADD CONSTRAINT "AfiliadoSuspension_afiliadoId_fkey" FOREIGN KEY ("afiliadoId") REFERENCES "Afiliado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AfiliadoExcepcionSuspension" ADD CONSTRAINT "AfiliadoExcepcionSuspension_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "Organizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AfiliadoExcepcionSuspension" ADD CONSTRAINT "AfiliadoExcepcionSuspension_afiliadoId_fkey" FOREIGN KEY ("afiliadoId") REFERENCES "Afiliado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoberturaAfiliadoPeriodo" ADD CONSTRAINT "CoberturaAfiliadoPeriodo_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "Organizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoberturaAfiliadoPeriodo" ADD CONSTRAINT "CoberturaAfiliadoPeriodo_afiliadoId_fkey" FOREIGN KEY ("afiliadoId") REFERENCES "Afiliado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CierreMensual" ADD CONSTRAINT "CierreMensual_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "Organizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
