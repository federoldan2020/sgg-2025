import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ReglasService } from './reglas.service';
import type {
  CrearReglaBaseDto,
  EditarReglaBaseDto,
  CrearReglaColateralDto,
  EditarReglaColateralDto,
} from './dtos';

type ReqOrg = Request & { organizacionId?: string };

@Controller('parametricos/reglas')
export class ReglasController {
  constructor(private readonly svc: ReglasService) {}

  // ===== Base coseguro
  @Get('base')
  listarBase(@Req() req: ReqOrg) {
    if (!req.organizacionId) throw new Error('Falta organización');
    return this.svc.listarBase(req.organizacionId);
  }

  @Post('base')
  crearBase(@Req() req: ReqOrg, @Body() dto: CrearReglaBaseDto) {
    if (!req.organizacionId) throw new Error('Falta organización');
    return this.svc.crearBase(req.organizacionId, dto);
  }

  @Patch('base/:id')
  editarBase(@Req() req: ReqOrg, @Param('id') id: string, @Body() dto: EditarReglaBaseDto) {
    if (!req.organizacionId) throw new Error('Falta organización');
    return this.svc.editarBase(req.organizacionId, id, dto);
  }

  @Delete('base/:id')
  eliminarBase(@Req() req: ReqOrg, @Param('id') id: string) {
    if (!req.organizacionId) throw new Error('Falta organización');
    return this.svc.eliminarBase(req.organizacionId, id);
  }

  // ===== Colaterales
  @Get('colaterales')
  listarColaterales(@Req() req: ReqOrg) {
    if (!req.organizacionId) throw new Error('Falta organización');
    return this.svc.listarColaterales(req.organizacionId);
  }

  @Post('colaterales')
  crearColateral(@Req() req: ReqOrg, @Body() dto: CrearReglaColateralDto) {
    if (!req.organizacionId) throw new Error('Falta organización');
    return this.svc.crearColateral(req.organizacionId, dto);
  }

  @Patch('colaterales/:id')
  editarColateral(
    @Req() req: ReqOrg,
    @Param('id') id: string,
    @Body() dto: EditarReglaColateralDto,
  ) {
    if (!req.organizacionId) throw new Error('Falta organización');
    return this.svc.editarColateral(req.organizacionId, id, dto);
  }

  @Delete('colaterales/:id')
  eliminarColateral(@Req() req: ReqOrg, @Param('id') id: string) {
    if (!req.organizacionId) throw new Error('Falta organización');
    return this.svc.eliminarColateral(req.organizacionId, id);
  }
}
