-- CreateEnum
CREATE TYPE "public"."RolUsuario" AS ENUM ('ADMIN', 'OPERACION', 'COSEGURO', 'NOMINA', 'CONTABILIDAD', 'TERCEROS', 'AFILIADOS', 'FINANZAS', 'TESORERIA', 'CAJA', 'SOLO_LECTURA');

-- CreateEnum
CREATE TYPE "public"."EstadoUsuario" AS ENUM ('ACTIVO', 'INACTIVO', 'BLOQUEADO', 'PENDIENTE_ACTIVACION');

-- CreateTable
CREATE TABLE "public"."Usuario" (
    "id" BIGSERIAL NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT,
    "passwordHash" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "roles" "public"."RolUsuario"[],
    "estado" "public"."EstadoUsuario" NOT NULL DEFAULT 'PENDIENTE_ACTIVACION',
    "ultimoLogin" TIMESTAMP(3),
    "intentosFallidos" INTEGER NOT NULL DEFAULT 0,
    "bloqueadoHasta" TIMESTAMP(3),
    "cambiarPassword" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "creadoPor" BIGINT,
    "sedeId" TEXT,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SesionUsuario" (
    "id" TEXT NOT NULL,
    "usuarioId" BIGINT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "tokenFamily" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "dispositivo" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "ultimoUso" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "SesionUsuario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Usuario_organizacionId_estado_idx" ON "public"."Usuario"("organizacionId", "estado");

-- CreateIndex
CREATE INDEX "Usuario_organizacionId_email_idx" ON "public"."Usuario"("organizacionId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_organizacionId_email_key" ON "public"."Usuario"("organizacionId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_organizacionId_username_key" ON "public"."Usuario"("organizacionId", "username");

-- CreateIndex
CREATE UNIQUE INDEX "SesionUsuario_refreshToken_key" ON "public"."SesionUsuario"("refreshToken");

-- CreateIndex
CREATE INDEX "SesionUsuario_usuarioId_activa_idx" ON "public"."SesionUsuario"("usuarioId", "activa");

-- CreateIndex
CREATE INDEX "SesionUsuario_organizacionId_usuarioId_idx" ON "public"."SesionUsuario"("organizacionId", "usuarioId");

-- CreateIndex
CREATE INDEX "SesionUsuario_refreshToken_idx" ON "public"."SesionUsuario"("refreshToken");

-- CreateIndex
CREATE INDEX "SesionUsuario_expiraEn_idx" ON "public"."SesionUsuario"("expiraEn");

-- AddForeignKey
ALTER TABLE "public"."Usuario" ADD CONSTRAINT "Usuario_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "public"."Organizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Usuario" ADD CONSTRAINT "Usuario_creadoPor_fkey" FOREIGN KEY ("creadoPor") REFERENCES "public"."Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SesionUsuario" ADD CONSTRAINT "SesionUsuario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SesionUsuario" ADD CONSTRAINT "SesionUsuario_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "public"."Organizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
