-- CreateTable
CREATE TABLE "public"."NovedadPendiente" (
    "id" BIGSERIAL NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "periodoDestino" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "afiliadoId" BIGINT NOT NULL,
    "padronId" BIGINT,
    "canal" TEXT,
    "conceptoId" BIGINT,
    "importe" DECIMAL(12,2),
    "referenciaId" BIGINT,
    "observacion" TEXT,
    "ocurridoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NovedadPendiente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."NovedadCalendario" (
    "id" BIGSERIAL NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "diaCorte" INTEGER NOT NULL,
    "fechaCorte" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NovedadCalendario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NovedadPendiente_organizacionId_periodoDestino_idx" ON "public"."NovedadPendiente"("organizacionId", "periodoDestino");

-- CreateIndex
CREATE INDEX "NovedadPendiente_organizacionId_afiliadoId_idx" ON "public"."NovedadPendiente"("organizacionId", "afiliadoId");

-- CreateIndex
CREATE UNIQUE INDEX "NovedadCalendario_organizacionId_periodo_key" ON "public"."NovedadCalendario"("organizacionId", "periodo");

-- AddForeignKey
ALTER TABLE "public"."NovedadPendiente" ADD CONSTRAINT "NovedadPendiente_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "public"."Organizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NovedadCalendario" ADD CONSTRAINT "NovedadCalendario_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "public"."Organizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
