-- CreateTable
CREATE TABLE "public"."NovedadPendientePadron" (
    "id" BIGSERIAL NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "periodoDestino" TEXT NOT NULL,
    "padronId" BIGINT NOT NULL,
    "centro" INTEGER,
    "sistema" TEXT,
    "j17" DECIMAL(12,2),
    "j22" DECIMAL(12,2),
    "j38" DECIMAL(12,2),
    "k16" DECIMAL(12,2),
    "ocurridoEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NovedadPendientePadron_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "npp_idx_org_period" ON "public"."NovedadPendientePadron"("organizacionId", "periodoDestino");

-- CreateIndex
CREATE UNIQUE INDEX "NovedadPendientePadron_organizacionId_periodoDestino_padron_key" ON "public"."NovedadPendientePadron"("organizacionId", "periodoDestino", "padronId");

-- AddForeignKey
ALTER TABLE "public"."NovedadPendientePadron" ADD CONSTRAINT "NovedadPendientePadron_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "public"."Organizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NovedadPendientePadron" ADD CONSTRAINT "NovedadPendientePadron_padronId_fkey" FOREIGN KEY ("padronId") REFERENCES "public"."Padron"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
