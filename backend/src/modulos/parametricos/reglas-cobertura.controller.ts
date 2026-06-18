import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ReglasCoberturaService } from './reglas-cobertura.service';
import type { CrearReglaCoberturaDto, EditarReglaCoberturaDto } from './dtos';

type ReqOrg = Request & { organizacionId?: string };

function reqOrg(req: ReqOrg): string {
  if (!req.organizacionId) throw new Error('Falta organización');
  return req.organizacionId;
}

@Controller('parametricos/reglas/cobertura')
export class ReglasCoberturaController {
  constructor(private readonly svc: ReglasCoberturaService) {}

  @Get()
  list(@Req() req: ReqOrg) {
    return this.svc.list(reqOrg(req));
  }

  @Get('vigente')
  getVigente(@Req() req: ReqOrg, @Query('fecha') fecha?: string) {
    return this.svc.getVigente(reqOrg(req), fecha);
  }

  @Post()
  create(@Req() req: ReqOrg, @Body() dto: CrearReglaCoberturaDto) {
    return this.svc.create(reqOrg(req), dto);
  }

  @Patch(':id')
  update(@Req() req: ReqOrg, @Param('id') id: string, @Body() dto: EditarReglaCoberturaDto) {
    return this.svc.update(reqOrg(req), id, dto);
  }

  @Delete(':id')
  remove(@Req() req: ReqOrg, @Param('id') id: string) {
    return this.svc.remove(reqOrg(req), id);
  }
}
