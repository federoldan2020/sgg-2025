import { Module } from '@nestjs/common';
import { ParentescosController } from './parentescos.controller';
import { ParentescosService } from './parentescos.service';
import { ReglasController } from './reglas.controller';
import { ReglasService } from './reglas.service';

@Module({
  controllers: [ParentescosController, ReglasController],
  providers: [ParentescosService, ReglasService],
})
export class ParametricosModule {}
