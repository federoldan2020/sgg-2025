-- AlterEnum
ALTER TYPE "public"."RolUsuario" ADD VALUE 'SUPERADMIN';

-- CreateTable
CREATE TABLE "public"."EventoAuditoria" (
    "id" BIGSERIAL NOT NULL,
    "organizacionId" TEXT,
    "usuarioId" TEXT,
    "accion" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidadId" TEXT,
    "payloadAntes" JSONB,
    "payloadDespues" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventoAuditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventoAuditoria_organizacionId_creadoEn_idx" ON "public"."EventoAuditoria"("organizacionId", "creadoEn");

-- CreateIndex
CREATE INDEX "EventoAuditoria_usuarioId_creadoEn_idx" ON "public"."EventoAuditoria"("usuarioId", "creadoEn");

-- CreateIndex
CREATE INDEX "EventoAuditoria_entidad_entidadId_idx" ON "public"."EventoAuditoria"("entidad", "entidadId");

-- CreateIndex
CREATE INDEX "EventoAuditoria_accion_creadoEn_idx" ON "public"."EventoAuditoria"("accion", "creadoEn");

-- AddForeignKey
ALTER TABLE "public"."EventoAuditoria" ADD CONSTRAINT "EventoAuditoria_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "public"."Organizacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
