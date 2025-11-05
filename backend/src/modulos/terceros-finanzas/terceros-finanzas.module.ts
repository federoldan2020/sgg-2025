// src/modulos/terceros-finanzas/terceros-finanzas.module.ts
import { Module } from '@nestjs/common';
import { CuentasService } from './cuentas.service';
import { ComprobantesService } from './comprobantes.service';
import { ComprobantesController } from './comprobantes.controller';
import { OrdenesPagoService } from './ordenes-pago.service';
import { OrdenesPagoController } from './ordenes-pago.controller';
import { ContabilidadService } from '../contabilidad/contabilidad.service';
import { CuentasExtractoController } from './cuentas-extracto.controller';
import { CuentasExtractoService } from './cuentas-extracto.service';
import { ImpresionService } from '../impresion/impresion.service';

@Module({
  providers: [
    CuentasService,
    ComprobantesService,
    OrdenesPagoService,
    ContabilidadService,
    CuentasExtractoService,
    ImpresionService,
  ],
  controllers: [ComprobantesController, OrdenesPagoController, CuentasExtractoController],
  exports: [CuentasService, ComprobantesService, OrdenesPagoService, CuentasExtractoService],
})
export class TercerosFinanzasModule {}
