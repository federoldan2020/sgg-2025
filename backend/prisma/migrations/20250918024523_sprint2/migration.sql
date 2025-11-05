-- CreateTable
CREATE TABLE "public"."Parentesco" (
    "id" BIGSERIAL NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "codigo" INTEGER NOT NULL,
    "descripcion" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Parentesco_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CoseguroAfiliado" (
    "id" BIGSERIAL NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "afiliadoId" BIGINT NOT NULL,
    "fechaAlta" DATE NOT NULL,
    "fechaBaja" DATE,
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "imputacionPadronIdCoseguro" BIGINT,
    "imputacionPadronIdColaterales" BIGINT,

    CONSTRAINT "CoseguroAfiliado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Colateral" (
    "id" BIGSERIAL NOT NULL,
    "coseguroId" BIGINT NOT NULL,
    "parentescoId" BIGINT NOT NULL,
    "nombre" TEXT NOT NULL,
    "fechaNacimiento" DATE,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Colateral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReglaPrecioCoseguro" (
    "id" BIGSERIAL NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "vigenteDesde" DATE NOT NULL,
    "vigenteHasta" DATE,
    "precioBase" DECIMAL(12,2) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ReglaPrecioCoseguro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReglaPrecioColateral" (
    "id" BIGSERIAL NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "parentescoId" BIGINT NOT NULL,
    "cantidadDesde" INTEGER NOT NULL,
    "cantidadHasta" INTEGER,
    "vigenteDesde" DATE NOT NULL,
    "vigenteHasta" DATE,
    "precioTotal" DECIMAL(12,2) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ReglaPrecioColateral_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Parentesco_organizacionId_idx" ON "public"."Parentesco"("organizacionId");

-- CreateIndex
CREATE UNIQUE INDEX "Parentesco_organizacionId_codigo_key" ON "public"."Parentesco"("organizacionId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "CoseguroAfiliado_afiliadoId_key" ON "public"."CoseguroAfiliado"("afiliadoId");

-- CreateIndex
CREATE INDEX "CoseguroAfiliado_organizacionId_afiliadoId_idx" ON "public"."CoseguroAfiliado"("organizacionId", "afiliadoId");

-- CreateIndex
CREATE INDEX "Colateral_coseguroId_idx" ON "public"."Colateral"("coseguroId");

-- CreateIndex
CREATE INDEX "Colateral_parentescoId_idx" ON "public"."Colateral"("parentescoId");

-- CreateIndex
CREATE INDEX "ReglaPrecioCoseguro_organizacionId_vigenteDesde_idx" ON "public"."ReglaPrecioCoseguro"("organizacionId", "vigenteDesde");

-- CreateIndex
CREATE INDEX "ReglaPrecioColateral_organizacionId_parentescoId_vigenteDes_idx" ON "public"."ReglaPrecioColateral"("organizacionId", "parentescoId", "vigenteDesde");

-- AddForeignKey
ALTER TABLE "public"."Parentesco" ADD CONSTRAINT "Parentesco_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "public"."Organizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CoseguroAfiliado" ADD CONSTRAINT "CoseguroAfiliado_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "public"."Organizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CoseguroAfiliado" ADD CONSTRAINT "CoseguroAfiliado_afiliadoId_fkey" FOREIGN KEY ("afiliadoId") REFERENCES "public"."Afiliado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CoseguroAfiliado" ADD CONSTRAINT "CoseguroAfiliado_imputacionPadronIdCoseguro_fkey" FOREIGN KEY ("imputacionPadronIdCoseguro") REFERENCES "public"."Padron"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CoseguroAfiliado" ADD CONSTRAINT "CoseguroAfiliado_imputacionPadronIdColaterales_fkey" FOREIGN KEY ("imputacionPadronIdColaterales") REFERENCES "public"."Padron"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Colateral" ADD CONSTRAINT "Colateral_coseguroId_fkey" FOREIGN KEY ("coseguroId") REFERENCES "public"."CoseguroAfiliado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Colateral" ADD CONSTRAINT "Colateral_parentescoId_fkey" FOREIGN KEY ("parentescoId") REFERENCES "public"."Parentesco"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReglaPrecioCoseguro" ADD CONSTRAINT "ReglaPrecioCoseguro_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "public"."Organizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReglaPrecioColateral" ADD CONSTRAINT "ReglaPrecioColateral_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "public"."Organizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReglaPrecioColateral" ADD CONSTRAINT "ReglaPrecioColateral_parentescoId_fkey" FOREIGN KEY ("parentescoId") REFERENCES "public"."Parentesco"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
