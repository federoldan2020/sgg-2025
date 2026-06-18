import { Module } from '@nestjs/common';
import { ParentescosController } from './parentescos.controller';
import { ParentescosService } from './parentescos.service';
import { ReglasController } from './reglas.controller';
import { ReglasService } from './reglas.service';
import { ParentescosImportController } from './parentescos-import.controller';
import { ParentescosImportService } from './parentescos-import.service';
import { ReglasCoberturaController } from './reglas-cobertura.controller';
import { ReglasCoberturaService } from './reglas-cobertura.service';
import { ReglasClasificacionController } from './reglas-clasificacion.controller';
import { ReglasClasificacionService } from './reglas-clasificacion.service';
import { PrismaService } from '../../common/prisma.service';

@Module({
  controllers: [
    ParentescosController,
    ReglasController,
    ParentescosImportController,
    ReglasCoberturaController,
    ReglasClasificacionController,
  ],
  providers: [
    ParentescosService,
    ReglasService,
    ParentescosImportService,
    ReglasCoberturaService,
    ReglasClasificacionService,
    PrismaService,
  ],
})
export class ParametricosModule {}
