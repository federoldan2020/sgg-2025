-- AlterTable
ALTER TABLE "public"."ReintegroItem" ADD COLUMN     "porcentaje" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "public"."ReintegroSolicitud" ADD COLUMN     "importeReintegro" DECIMAL(14,2),
ALTER COLUMN "actualizadoAt" DROP DEFAULT;
