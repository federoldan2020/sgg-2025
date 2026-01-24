-- AlterTable
ALTER TABLE "public"."ReintegroItem" ADD COLUMN     "prestacionId" BIGINT;

-- CreateTable
CREATE TABLE "public"."PrestacionTipo" (
    "id" BIGSERIAL NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER,

    CONSTRAINT "PrestacionTipo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PrestacionSubtipo" (
    "id" BIGSERIAL NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "tipoId" BIGINT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER,

    CONSTRAINT "PrestacionSubtipo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PrestacionPractica" (
    "id" BIGSERIAL NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "tipoId" BIGINT NOT NULL,
    "subtipoId" BIGINT,
    "codigo" TEXT,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER,

    CONSTRAINT "PrestacionPractica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PrestacionRegla" (
    "id" BIGSERIAL NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "tipoId" BIGINT,
    "subtipoId" BIGINT,
    "practicaId" BIGINT,
    "porcentaje" DECIMAL(5,2),
    "tope" DECIMAL(14,2),
    "vigenteDesde" DATE NOT NULL,
    "vigenteHasta" DATE,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PrestacionRegla_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrestacionTipo_organizacionId_activo_idx" ON "public"."PrestacionTipo"("organizacionId", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "PrestacionTipo_organizacionId_nombre_key" ON "public"."PrestacionTipo"("organizacionId", "nombre");

-- CreateIndex
CREATE INDEX "PrestacionSubtipo_organizacionId_tipoId_idx" ON "public"."PrestacionSubtipo"("organizacionId", "tipoId");

-- CreateIndex
CREATE INDEX "PrestacionSubtipo_organizacionId_activo_idx" ON "public"."PrestacionSubtipo"("organizacionId", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "PrestacionSubtipo_organizacionId_tipoId_nombre_key" ON "public"."PrestacionSubtipo"("organizacionId", "tipoId", "nombre");

-- CreateIndex
CREATE INDEX "PrestacionPractica_organizacionId_tipoId_idx" ON "public"."PrestacionPractica"("organizacionId", "tipoId");

-- CreateIndex
CREATE INDEX "PrestacionPractica_organizacionId_subtipoId_idx" ON "public"."PrestacionPractica"("organizacionId", "subtipoId");

-- CreateIndex
CREATE INDEX "PrestacionPractica_organizacionId_codigo_idx" ON "public"."PrestacionPractica"("organizacionId", "codigo");

-- CreateIndex
CREATE INDEX "PrestacionPractica_organizacionId_activo_idx" ON "public"."PrestacionPractica"("organizacionId", "activo");

-- CreateIndex
CREATE INDEX "PrestacionRegla_organizacionId_vigenteDesde_idx" ON "public"."PrestacionRegla"("organizacionId", "vigenteDesde");

-- CreateIndex
CREATE INDEX "PrestacionRegla_organizacionId_activo_idx" ON "public"."PrestacionRegla"("organizacionId", "activo");

-- CreateIndex
CREATE INDEX "PrestacionRegla_organizacionId_tipoId_idx" ON "public"."PrestacionRegla"("organizacionId", "tipoId");

-- CreateIndex
CREATE INDEX "PrestacionRegla_organizacionId_subtipoId_idx" ON "public"."PrestacionRegla"("organizacionId", "subtipoId");

-- CreateIndex
CREATE INDEX "PrestacionRegla_organizacionId_practicaId_idx" ON "public"."PrestacionRegla"("organizacionId", "practicaId");

-- CreateIndex
CREATE INDEX "ReintegroItem_prestacionId_idx" ON "public"."ReintegroItem"("prestacionId");

-- AddForeignKey
ALTER TABLE "public"."ReintegroItem" ADD CONSTRAINT "ReintegroItem_prestacionId_fkey" FOREIGN KEY ("prestacionId") REFERENCES "public"."PrestacionPractica"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PrestacionTipo" ADD CONSTRAINT "PrestacionTipo_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "public"."Organizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PrestacionSubtipo" ADD CONSTRAINT "PrestacionSubtipo_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "public"."Organizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PrestacionSubtipo" ADD CONSTRAINT "PrestacionSubtipo_tipoId_fkey" FOREIGN KEY ("tipoId") REFERENCES "public"."PrestacionTipo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PrestacionPractica" ADD CONSTRAINT "PrestacionPractica_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "public"."Organizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PrestacionPractica" ADD CONSTRAINT "PrestacionPractica_tipoId_fkey" FOREIGN KEY ("tipoId") REFERENCES "public"."PrestacionTipo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PrestacionPractica" ADD CONSTRAINT "PrestacionPractica_subtipoId_fkey" FOREIGN KEY ("subtipoId") REFERENCES "public"."PrestacionSubtipo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PrestacionRegla" ADD CONSTRAINT "PrestacionRegla_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "public"."Organizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PrestacionRegla" ADD CONSTRAINT "PrestacionRegla_tipoId_fkey" FOREIGN KEY ("tipoId") REFERENCES "public"."PrestacionTipo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PrestacionRegla" ADD CONSTRAINT "PrestacionRegla_subtipoId_fkey" FOREIGN KEY ("subtipoId") REFERENCES "public"."PrestacionSubtipo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PrestacionRegla" ADD CONSTRAINT "PrestacionRegla_practicaId_fkey" FOREIGN KEY ("practicaId") REFERENCES "public"."PrestacionPractica"("id") ON DELETE CASCADE ON UPDATE CASCADE;
