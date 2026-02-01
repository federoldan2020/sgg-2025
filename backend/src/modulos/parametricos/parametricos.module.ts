import { Module } from '@nestjs/common';
import { ParentescosController } from './parentescos.controller';
import { ParentescosService } from './parentescos.service';
import { ReglasController } from './reglas.controller';
import { ReglasService } from './reglas.service';
import { ParentescosImportController } from './parentescos-import.controller';
import { ParentescosImportService } from './parentescos-import.service';
import { PrismaService } from '../../common/prisma.service';

@Module({
  controllers: [ParentescosController, ReglasController, ParentescosImportController],
  providers: [ParentescosService, ReglasService, ParentescosImportService, PrismaService],
})
export class ParametricosModule {}
