import { Module } from '@nestjs/common';
import { CoseguroController } from './coseguro.controller';
import { CoseguroService } from './coseguro.service';
import { PrismaService } from '../../common/prisma.service';
import { NovedadesModule } from '../novedades/novedades.module';
import { CoseguroReglasController } from './coseguro-reglas.controller';
import { CoseguroReglasService } from './coseguro-reglas.service';

@Module({
  imports: [NovedadesModule],
  controllers: [CoseguroController, CoseguroReglasController],
  providers: [CoseguroService, PrismaService, CoseguroReglasService],
  exports: [CoseguroService],
})
export class CoseguroModule {}
