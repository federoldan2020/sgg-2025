import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/audit.service';
import { ParametrosService } from './parametros.service';
import { CoberturaService } from './cobertura.service';
import { SuspensionesService } from './suspensiones.service';
import { ExcepcionesService } from './excepciones.service';
import { CierreMensualService } from './cierre-mensual.service';
import { GateService } from './gate.service';
import { ObligacionesMensualesService } from './obligaciones-mensuales.service';
import { MovimientosModule } from '../movimientos/movimientos.module';
import {
  CierreMensualController,
  CoberturaController,
  ExcepcionesController,
  ExcepcionesGlobalController,
  ObligacionesMensualesController,
  ParametrosController,
  SuspensionesController,
} from './suspensiones.controller';

/**
 * Circuito de suspensiones (núcleo del modelo de mora por cobertura).
 * Doc: docs/CIRCUITO_AFILIADOS_DEUDA_SUSPENSION.md
 *
 * Exporta `GateService` para que otros módulos (coseguro, reintegros,
 * ordenes, comercios) consulten el estado del afiliado antes de habilitar
 * servicios.
 */
@Module({
  imports: [MovimientosModule],
  controllers: [
    ParametrosController,
    CoberturaController,
    SuspensionesController,
    ExcepcionesController,
    ExcepcionesGlobalController,
    CierreMensualController,
    ObligacionesMensualesController,
  ],
  providers: [
    PrismaService,
    AuditService,
    ParametrosService,
    CoberturaService,
    SuspensionesService,
    ExcepcionesService,
    CierreMensualService,
    GateService,
    ObligacionesMensualesService,
  ],
  exports: [
    ParametrosService,
    CoberturaService,
    SuspensionesService,
    ExcepcionesService,
    CierreMensualService,
    GateService,
    ObligacionesMensualesService,
  ],
})
export class SuspensionesModule {}
