-- CreateTable
CREATE TABLE "public"."CuentaContable" (
    "id" BIGSERIAL NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "nivel" INTEGER,
    "imputable" BOOLEAN NOT NULL DEFAULT true,
    "padreId" BIGINT,

    CONSTRAINT "CuentaContable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CuentaMapeo" (
    "id" BIGSERIAL NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "origen" TEXT NOT NULL,
    "conceptoCodigo" TEXT,
    "metodoPago" TEXT,
    "debeCodigo" TEXT NOT NULL,
    "haberCodigo" TEXT NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CuentaMapeo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CuentaContable_organizacionId_idx" ON "public"."CuentaContable"("organizacionId");

-- CreateIndex
CREATE UNIQUE INDEX "CuentaContable_organizacionId_codigo_key" ON "public"."CuentaContable"("organizacionId", "codigo");

-- CreateIndex
CREATE INDEX "CuentaMapeo_organizacionId_origen_conceptoCodigo_metodoPago_idx" ON "public"."CuentaMapeo"("organizacionId", "origen", "conceptoCodigo", "metodoPago", "activo");

-- AddForeignKey
ALTER TABLE "public"."CuentaContable" ADD CONSTRAINT "CuentaContable_padreId_fkey" FOREIGN KEY ("padreId") REFERENCES "public"."CuentaContable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CuentaContable" ADD CONSTRAINT "CuentaContable_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "public"."Organizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CuentaMapeo" ADD CONSTRAINT "CuentaMapeo_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "public"."Organizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
