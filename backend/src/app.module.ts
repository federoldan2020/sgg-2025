import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AfiliadosController } from './modulos/afiliados/afiliados.controller';
import { PadronesController } from './modulos/padrones/padrones.controller';
import { ObligacionesController } from './modulos/obligaciones/obligaciones.controller';
import { CajaController } from './modulos/caja/caja.controller';
import { AsientosController } from './modulos/contabilidad/asientos.controller';
import { CoseguroModule } from './modulos/coseguro/coseguro.module';
import { ParametricosModule } from './modulos/parametricos/parametricos.module';
import { OrdenesModule } from './modulos/ordenes/ordenes.module';
import { NovedadesModule } from './modulos/novedades/novedades.module';
import { NominaModule } from './modulos/nomina/nomina.module';
import { ContabilidadModule } from './modulos/contabilidad/contabilidad.module';
import { TercerosModule } from './modulos/terceros/terceros.module';
import { TercerosFinanzasModule } from './modulos/terceros-finanzas/terceros-finanzas.module';
import { AfiliadosModule } from './modulos/afiliados/afiliados.module';
import { PadronesModule } from './modulos/padrones/padrones.module';
import { ImpresionModule } from './modulos/impresion/impresion.module';
import { ColateralesModule } from './modulos/colaterales/colaterales.module';
import { PublicacionesModule } from './modulos/publicaciones/publicaciones.module';
import { orgMiddleware } from './middleware/org.middleware';
import { ComerciosModule } from './modulos/comercios/comercios.module';
import { MovimientosModule } from './modulos/movimientos/movimientos.module';

@Module({
  imports: [
    AfiliadosModule,
    PadronesModule,
    CoseguroModule,
    ColateralesModule,
    ParametricosModule,
    OrdenesModule,
    NovedadesModule,
    NominaModule,
    ContabilidadModule,
    TercerosModule,
    TercerosFinanzasModule,
    ImpresionModule,
    PublicacionesModule,
    ComerciosModule,
    MovimientosModule,
    OrdenesModule,
  ],
  controllers: [
    AfiliadosController,
    PadronesController,
    ObligacionesController,
    CajaController,
    AsientosController,
  ],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(orgMiddleware).forRoutes('*');
  }
}
