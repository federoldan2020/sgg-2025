import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { PrestacionesService } from './prestaciones.service';
import type {
  CrearPrestacionTipoDto,
  EditarPrestacionTipoDto,
  CrearPrestacionSubtipoDto,
  EditarPrestacionSubtipoDto,
  CrearPrestacionPracticaDto,
  EditarPrestacionPracticaDto,
  CrearPrestacionReglaDto,
  EditarPrestacionReglaDto,
} from './prestaciones.dtos';

type ReqOrg = Request & { organizacionId?: string };

@Controller('reintegros/prestaciones')
export class PrestacionesController {
  constructor(private readonly svc: PrestacionesService) {}

  // ===== Tipos =====
  @Get('tipos')
  listarTipos(@Req() req: ReqOrg) {
    if (!req.organizacionId) throw new Error('Falta organización');
    return this.svc.listarTipos(req.organizacionId);
  }

  @Post('tipos')
  crearTipo(@Req() req: ReqOrg, @Body() dto: CrearPrestacionTipoDto) {
    if (!req.organizacionId) throw new Error('Falta organización');
    return this.svc.crearTipo(req.organizacionId, dto);
  }

  @Patch('tipos/:id')
  editarTipo(@Req() req: ReqOrg, @Param('id') id: string, @Body() dto: EditarPrestacionTipoDto) {
    if (!req.organizacionId) throw new Error('Falta organización');
    return this.svc.editarTipo(req.organizacionId, id, dto);
  }

  @Delete('tipos/:id')
  eliminarTipo(@Req() req: ReqOrg, @Param('id') id: string) {
    if (!req.organizacionId) throw new Error('Falta organización');
    return this.svc.eliminarTipo(req.organizacionId, id);
  }

  // ===== Subtipos =====
  @Get('subtipos')
  listarSubtipos(@Req() req: ReqOrg, @Query('tipoId') tipoId?: string) {
    if (!req.organizacionId) throw new Error('Falta organización');
    return this.svc.listarSubtipos(req.organizacionId, tipoId);
  }

  @Post('subtipos')
  crearSubtipo(@Req() req: ReqOrg, @Body() dto: CrearPrestacionSubtipoDto) {
    if (!req.organizacionId) throw new Error('Falta organización');
    return this.svc.crearSubtipo(req.organizacionId, dto);
  }

  @Patch('subtipos/:id')
  editarSubtipo(
    @Req() req: ReqOrg,
    @Param('id') id: string,
    @Body() dto: EditarPrestacionSubtipoDto,
  ) {
    if (!req.organizacionId) throw new Error('Falta organización');
    return this.svc.editarSubtipo(req.organizacionId, id, dto);
  }

  @Delete('subtipos/:id')
  eliminarSubtipo(@Req() req: ReqOrg, @Param('id') id: string) {
    if (!req.organizacionId) throw new Error('Falta organización');
    return this.svc.eliminarSubtipo(req.organizacionId, id);
  }

  // ===== Prácticas =====
  @Get('practicas')
  listarPracticas(
    @Req() req: ReqOrg,
    @Query('tipoId') tipoId?: string,
    @Query('subtipoId') subtipoId?: string,
    @Query('q') q?: string,
  ) {
    if (!req.organizacionId) throw new Error('Falta organización');
    return this.svc.listarPracticas(req.organizacionId, { tipoId, subtipoId, q });
  }

  @Post('practicas')
  crearPractica(@Req() req: ReqOrg, @Body() dto: CrearPrestacionPracticaDto) {
    if (!req.organizacionId) throw new Error('Falta organización');
    return this.svc.crearPractica(req.organizacionId, dto);
  }

  @Patch('practicas/:id')
  editarPractica(
    @Req() req: ReqOrg,
    @Param('id') id: string,
    @Body() dto: EditarPrestacionPracticaDto,
  ) {
    if (!req.organizacionId) throw new Error('Falta organización');
    return this.svc.editarPractica(req.organizacionId, id, dto);
  }

  @Delete('practicas/:id')
  eliminarPractica(@Req() req: ReqOrg, @Param('id') id: string) {
    if (!req.organizacionId) throw new Error('Falta organización');
    return this.svc.eliminarPractica(req.organizacionId, id);
  }

  // ===== Reglas =====
  @Get('reglas')
  listarReglas(
    @Req() req: ReqOrg,
    @Query('tipoId') tipoId?: string,
    @Query('subtipoId') subtipoId?: string,
    @Query('practicaId') practicaId?: string,
  ) {
    if (!req.organizacionId) throw new Error('Falta organización');
    return this.svc.listarReglas(req.organizacionId, { tipoId, subtipoId, practicaId });
  }

  @Post('reglas')
  crearRegla(@Req() req: ReqOrg, @Body() dto: CrearPrestacionReglaDto) {
    if (!req.organizacionId) throw new Error('Falta organización');
    return this.svc.crearRegla(req.organizacionId, dto);
  }

  @Patch('reglas/:id')
  editarRegla(@Req() req: ReqOrg, @Param('id') id: string, @Body() dto: EditarPrestacionReglaDto) {
    if (!req.organizacionId) throw new Error('Falta organización');
    return this.svc.editarRegla(req.organizacionId, id, dto);
  }

  @Delete('reglas/:id')
  eliminarRegla(@Req() req: ReqOrg, @Param('id') id: string) {
    if (!req.organizacionId) throw new Error('Falta organización');
    return this.svc.eliminarRegla(req.organizacionId, id);
  }
}
