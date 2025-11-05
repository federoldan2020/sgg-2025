-- CreateTable
CREATE TABLE "public"."Organizacion" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organizacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Afiliado" (
    "id" BIGSERIAL NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "dni" BIGINT NOT NULL,
    "apellido" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Afiliado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Padron" (
    "id" BIGSERIAL NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "afiliadoId" BIGINT NOT NULL,
    "padron" TEXT NOT NULL,
    "centro" INTEGER,
    "sector" INTEGER,
    "clase" TEXT,
    "situacion" TEXT,
    "fechaAlta" DATE,
    "fechaBaja" DATE,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Padron_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Concepto" (
    "id" BIGSERIAL NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Concepto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Obligacion" (
    "id" BIGSERIAL NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "afiliadoId" BIGINT NOT NULL,
    "padronId" BIGINT,
    "conceptoId" BIGINT NOT NULL,
    "periodo" TEXT NOT NULL,
    "origen" TEXT NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "saldo" DECIMAL(12,2) NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Obligacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Caja" (
    "id" BIGSERIAL NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "sede" TEXT,
    "fechaApertura" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaCierre" TIMESTAMP(3),
    "estado" TEXT NOT NULL DEFAULT 'abierta',

    CONSTRAINT "Caja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Pago" (
    "id" BIGSERIAL NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "cajaId" BIGINT NOT NULL,
    "afiliadoId" BIGINT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total" DECIMAL(12,2) NOT NULL,
    "numeroRecibo" TEXT,

    CONSTRAINT "Pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MetodoPago" (
    "id" BIGSERIAL NOT NULL,
    "pagoId" BIGINT NOT NULL,
    "metodo" TEXT NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "ref" TEXT,

    CONSTRAINT "MetodoPago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Aplicacion" (
    "id" BIGSERIAL NOT NULL,
    "pagoId" BIGINT NOT NULL,
    "obligacionId" BIGINT NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "Aplicacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Asiento" (
    "id" BIGSERIAL NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "descripcion" TEXT NOT NULL,
    "origen" TEXT NOT NULL,
    "referenciaId" TEXT,

    CONSTRAINT "Asiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LineaAsiento" (
    "id" BIGSERIAL NOT NULL,
    "asientoId" BIGINT NOT NULL,
    "cuenta" TEXT NOT NULL,
    "debe" DECIMAL(12,2) NOT NULL,
    "haber" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "LineaAsiento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organizacion_nombre_key" ON "public"."Organizacion"("nombre");

-- CreateIndex
CREATE INDEX "Afiliado_organizacionId_idx" ON "public"."Afiliado"("organizacionId");

-- CreateIndex
CREATE UNIQUE INDEX "Afiliado_organizacionId_dni_key" ON "public"."Afiliado"("organizacionId", "dni");

-- CreateIndex
CREATE INDEX "Padron_organizacionId_afiliadoId_idx" ON "public"."Padron"("organizacionId", "afiliadoId");

-- CreateIndex
CREATE UNIQUE INDEX "Padron_organizacionId_padron_key" ON "public"."Padron"("organizacionId", "padron");

-- CreateIndex
CREATE INDEX "Concepto_organizacionId_idx" ON "public"."Concepto"("organizacionId");

-- CreateIndex
CREATE UNIQUE INDEX "Concepto_organizacionId_codigo_key" ON "public"."Concepto"("organizacionId", "codigo");

-- CreateIndex
CREATE INDEX "Obligacion_organizacionId_afiliadoId_idx" ON "public"."Obligacion"("organizacionId", "afiliadoId");

-- CreateIndex
CREATE INDEX "Obligacion_organizacionId_conceptoId_idx" ON "public"."Obligacion"("organizacionId", "conceptoId");

-- CreateIndex
CREATE INDEX "Obligacion_organizacionId_periodo_idx" ON "public"."Obligacion"("organizacionId", "periodo");

-- CreateIndex
CREATE INDEX "Caja_organizacionId_estado_idx" ON "public"."Caja"("organizacionId", "estado");

-- CreateIndex
CREATE INDEX "Pago_organizacionId_cajaId_idx" ON "public"."Pago"("organizacionId", "cajaId");

-- CreateIndex
CREATE INDEX "Pago_organizacionId_afiliadoId_idx" ON "public"."Pago"("organizacionId", "afiliadoId");

-- CreateIndex
CREATE INDEX "MetodoPago_pagoId_idx" ON "public"."MetodoPago"("pagoId");

-- CreateIndex
CREATE INDEX "Aplicacion_pagoId_idx" ON "public"."Aplicacion"("pagoId");

-- CreateIndex
CREATE INDEX "Aplicacion_obligacionId_idx" ON "public"."Aplicacion"("obligacionId");

-- CreateIndex
CREATE INDEX "Asiento_organizacionId_fecha_idx" ON "public"."Asiento"("organizacionId", "fecha");

-- CreateIndex
CREATE INDEX "Asiento_organizacionId_origen_idx" ON "public"."Asiento"("organizacionId", "origen");

-- CreateIndex
CREATE INDEX "LineaAsiento_asientoId_idx" ON "public"."LineaAsiento"("asientoId");

-- AddForeignKey
ALTER TABLE "public"."Afiliado" ADD CONSTRAINT "Afiliado_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "public"."Organizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Padron" ADD CONSTRAINT "Padron_afiliadoId_fkey" FOREIGN KEY ("afiliadoId") REFERENCES "public"."Afiliado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Padron" ADD CONSTRAINT "Padron_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "public"."Organizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Concepto" ADD CONSTRAINT "Concepto_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "public"."Organizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Obligacion" ADD CONSTRAINT "Obligacion_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "public"."Organizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Obligacion" ADD CONSTRAINT "Obligacion_afiliadoId_fkey" FOREIGN KEY ("afiliadoId") REFERENCES "public"."Afiliado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Obligacion" ADD CONSTRAINT "Obligacion_padronId_fkey" FOREIGN KEY ("padronId") REFERENCES "public"."Padron"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Obligacion" ADD CONSTRAINT "Obligacion_conceptoId_fkey" FOREIGN KEY ("conceptoId") REFERENCES "public"."Concepto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Caja" ADD CONSTRAINT "Caja_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "public"."Organizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Pago" ADD CONSTRAINT "Pago_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "public"."Organizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Pago" ADD CONSTRAINT "Pago_cajaId_fkey" FOREIGN KEY ("cajaId") REFERENCES "public"."Caja"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Pago" ADD CONSTRAINT "Pago_afiliadoId_fkey" FOREIGN KEY ("afiliadoId") REFERENCES "public"."Afiliado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MetodoPago" ADD CONSTRAINT "MetodoPago_pagoId_fkey" FOREIGN KEY ("pagoId") REFERENCES "public"."Pago"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Aplicacion" ADD CONSTRAINT "Aplicacion_pagoId_fkey" FOREIGN KEY ("pagoId") REFERENCES "public"."Pago"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Aplicacion" ADD CONSTRAINT "Aplicacion_obligacionId_fkey" FOREIGN KEY ("obligacionId") REFERENCES "public"."Obligacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Asiento" ADD CONSTRAINT "Asiento_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "public"."Organizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LineaAsiento" ADD CONSTRAINT "LineaAsiento_asientoId_fkey" FOREIGN KEY ("asientoId") REFERENCES "public"."Asiento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
