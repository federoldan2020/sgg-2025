-- AddForeignKey
ALTER TABLE "public"."MovimientoAfiliado" ADD CONSTRAINT "MovimientoAfiliado_obligacionId_fkey" FOREIGN KEY ("obligacionId") REFERENCES "public"."Obligacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MovimientoAfiliado" ADD CONSTRAINT "MovimientoAfiliado_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "public"."OrdenCredito"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MovimientoAfiliado" ADD CONSTRAINT "MovimientoAfiliado_cuotaId_fkey" FOREIGN KEY ("cuotaId") REFERENCES "public"."OrdenCreditoCuota"("id") ON DELETE SET NULL ON UPDATE CASCADE;
