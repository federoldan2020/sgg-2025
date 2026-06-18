import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ReglasClasificacionService } from './reglas-clasificacion.service';
import type {
  CrearReglaClasificacionDto,
  EditarReglaClasificacionDto,
  ReordenarReglasClasificacionDto,
} from './dtos';

type ReqOrg = Request & { organizacionId?: string };

function reqOrg(req: ReqOrg): string {
  if (!req.organizacionId) throw new Error('Falta organización');
  return req.organizacionId;
}

@Controller('parametricos/reglas/clasificacion')
export class ReglasClasificacionController {
  constructor(private readonly svc: ReglasClasificacionService) {}

  @Get()
  list(@Req() req: ReqOrg) {
    return this.svc.list(reqOrg(req));
  }

  @Get(':id')
  get(@Req() req: ReqOrg, @Param('id') id: string) {
    return this.svc.get(reqOrg(req), id);
  }

  @Post()
  create(@Req() req: ReqOrg, @Body() dto: CrearReglaClasificacionDto) {
    return this.svc.create(reqOrg(req), dto);
  }

  @Patch('reordenar')
  reordenar(@Req() req: ReqOrg, @Body() dto: ReordenarReglasClasificacionDto) {
    return this.svc.reordenar(reqOrg(req), dto);
  }

  @Patch(':id')
  update(
    @Req() req: ReqOrg,
    @Param('id') id: string,
    @Body() dto: EditarReglaClasificacionDto,
  ) {
    return this.svc.update(reqOrg(req), id, dto);
  }

  @Patch(':id/estado')
  toggle(
    @Req() req: ReqOrg,
    @Param('id') id: string,
    @Body() body: { activo: boolean },
  ) {
    return this.svc.toggle(reqOrg(req), id, !!body.activo);
  }

  @Delete(':id')
  remove(@Req() req: ReqOrg, @Param('id') id: string) {
    return this.svc.remove(reqOrg(req), id);
  }
}
