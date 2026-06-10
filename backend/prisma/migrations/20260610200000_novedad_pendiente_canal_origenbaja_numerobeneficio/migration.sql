-- Migration: Cambios del 2026-06-10
--   1) NovedadPendiente: cola operator-driven de altas/bajas/modificaciones J17/J22/J38.
--   2) LoteNomina.canal: distingue lotes Cómputos (ESC) de ANSES.
--   3) CoseguroAfiliado.origenBaja: para decidir reactivación automática post-pago.
--   4) Padron.numeroBeneficio: clave de match contra TXT UDAME de ANSES.

-- ──────────────────────────────────────────────────────────────────
-- 1) NovedadPendiente
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE "NovedadPendiente" (
    "id" BIGSERIAL NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "padronId" BIGINT NOT NULL,
    "afiliadoId" BIGINT NOT NULL,
    "concepto" TEXT NOT NULL,
    "tipoMovimiento" TEXT NOT NULL,
    "destino" TEXT NOT NULL,
    "valor" DECIMAL(12,2),
    "periodoObjetivo" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "origenEvento" TEXT NOT NULL,
    "observacion" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPorId" TEXT,
    "loteId" BIGINT,
    "enviadaEn" TIMESTAMP(3),
    "canceladaEn" TIMESTAMP(3),
    "canceladaPorId" TEXT,
    "motivoCancelacion" TEXT,

    CONSTRAINT "NovedadPendiente_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NovedadPendiente_organizacionId_estado_periodoObjetivo_dest_idx"
    ON "NovedadPendiente"("organizacionId", "estado", "periodoObjetivo", "destino");
CREATE INDEX "NovedadPendiente_padronId_concepto_estado_idx"
    ON "NovedadPendiente"("padronId", "concepto", "estado");
CREATE INDEX "NovedadPendiente_loteId_idx" ON "NovedadPendiente"("loteId");

ALTER TABLE "NovedadPendiente"
    ADD CONSTRAINT "NovedadPendiente_organizacionId_fkey"
    FOREIGN KEY ("organizacionId") REFERENCES "Organizacion"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NovedadPendiente"
    ADD CONSTRAINT "NovedadPendiente_padronId_fkey"
    FOREIGN KEY ("padronId") REFERENCES "Padron"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NovedadPendiente"
    ADD CONSTRAINT "NovedadPendiente_afiliadoId_fkey"
    FOREIGN KEY ("afiliadoId") REFERENCES "Afiliado"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NovedadPendiente"
    ADD CONSTRAINT "NovedadPendiente_loteId_fkey"
    FOREIGN KEY ("loteId") REFERENCES "NovedadLote"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ──────────────────────────────────────────────────────────────────
-- 2) LoteNomina.canal
-- ──────────────────────────────────────────────────────────────────
ALTER TABLE "LoteNomina"
    ADD COLUMN "canal" TEXT NOT NULL DEFAULT 'ESC';

CREATE INDEX "LoteNomina_organizacionId_canal_periodo_idx"
    ON "LoteNomina"("organizacionId", "canal", "periodo");

-- ──────────────────────────────────────────────────────────────────
-- 3) CoseguroAfiliado.origenBaja
-- ──────────────────────────────────────────────────────────────────
ALTER TABLE "CoseguroAfiliado"
    ADD COLUMN "origenBaja" TEXT;

-- ──────────────────────────────────────────────────────────────────
-- 4) Padron.numeroBeneficio
-- ──────────────────────────────────────────────────────────────────
ALTER TABLE "Padron"
    ADD COLUMN "numeroBeneficio" TEXT;

CREATE INDEX "Padron_organizacionId_numeroBeneficio_idx"
    ON "Padron"("organizacionId", "numeroBeneficio");
