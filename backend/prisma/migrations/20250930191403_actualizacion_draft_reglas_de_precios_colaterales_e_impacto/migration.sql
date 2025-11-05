-- CreateEnum
CREATE TYPE "public"."PublicacionEstado" AS ENUM ('draft', 'publicada', 'cancelada');

-- CreateEnum
CREATE TYPE "public"."DraftOp" AS ENUM ('create', 'update', 'delete');

-- CreateTable
CREATE TABLE "public"."PublicacionReglas" (
    "id" BIGSERIAL NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "estado" "public"."PublicacionEstado" NOT NULL DEFAULT 'draft',
    "comentario" TEXT,
    "creadorId" TEXT,
    "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publicadoAt" TIMESTAMP(3),

    CONSTRAINT "PublicacionReglas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReglaPrecioColateralDraft" (
    "id" BIGSERIAL NOT NULL,
    "publicacionId" BIGINT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "op" "public"."DraftOp" NOT NULL,
    "targetId" BIGINT,
    "parentescoId" BIGINT,
    "cantidadDesde" INTEGER,
    "cantidadHasta" INTEGER,
    "vigenteDesde" DATE,
    "vigenteHasta" DATE,
    "precioTotal" DECIMAL(12,2),
    "activo" BOOLEAN,

    CONSTRAINT "ReglaPrecioColateralDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PublicacionReglas_organizacionId_estado_idx" ON "public"."PublicacionReglas"("organizacionId", "estado");

-- CreateIndex
CREATE INDEX "ReglaPrecioColateralDraft_publicacionId_idx" ON "public"."ReglaPrecioColateralDraft"("publicacionId");

-- CreateIndex
CREATE INDEX "ReglaPrecioColateralDraft_organizacionId_idx" ON "public"."ReglaPrecioColateralDraft"("organizacionId");

-- CreateIndex
CREATE INDEX "ReglaPrecioColateralDraft_op_idx" ON "public"."ReglaPrecioColateralDraft"("op");

-- AddForeignKey
ALTER TABLE "public"."ReglaPrecioColateralDraft" ADD CONSTRAINT "ReglaPrecioColateralDraft_publicacionId_fkey" FOREIGN KEY ("publicacionId") REFERENCES "public"."PublicacionReglas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
