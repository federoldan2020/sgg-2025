import { Module } from '@nestjs/common';
import { ParentescosController } from './parentescos.controller';
import { ParentescosService } from './parentescos.service';
import { ReglasController } from './reglas.controller';
import { ReglasService } from './reglas.service';
import { PrismaService } from '../../common/prisma.service';

@Module({
  controllers: [ParentescosController, ReglasController],
  providers: [ParentescosService, ReglasService, PrismaService],
})
export class ParametricosModule {}
