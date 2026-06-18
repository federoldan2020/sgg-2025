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
import { FarmaciasService } from './farmacias.service';
import {
  CrearFarmaciaDto,
  EditarFarmaciaDto,
  CambiarPasswordFarmaciaDto,
} from './dtos';

type ReqOrg = Request & { organizacionId?: string };
function reqOrg(req: ReqOrg): string {
  if (!req.organizacionId) throw new Error('Falta organización');
  return req.organizacionId;
}

@Controller('farmacias')
export class FarmaciasController {
  constructor(private readonly svc: FarmaciasService) {}

  @Get()
  list(@Req() req: ReqOrg) {
    return this.svc.list(reqOrg(req));
  }

  @Get(':id')
  get(@Req() req: ReqOrg, @Param('id') id: string) {
    return this.svc.get(reqOrg(req), id);
  }

  @Post()
  create(@Req() req: ReqOrg, @Body() dto: CrearFarmaciaDto) {
    return this.svc.create(reqOrg(req), dto);
  }

  @Patch(':id')
  update(@Req() req: ReqOrg, @Param('id') id: string, @Body() dto: EditarFarmaciaDto) {
    return this.svc.update(reqOrg(req), id, dto);
  }

  @Patch(':id/password')
  cambiarPassword(
    @Req() req: ReqOrg,
    @Param('id') id: string,
    @Body() dto: CambiarPasswordFarmaciaDto,
  ) {
    return this.svc.cambiarPassword(reqOrg(req), id, dto);
  }

  @Post(':id/reset-password')
  resetPassword(@Req() req: ReqOrg, @Param('id') id: string) {
    return this.svc.resetPassword(reqOrg(req), id);
  }

  @Delete(':id')
  remove(@Req() req: ReqOrg, @Param('id') id: string) {
    return this.svc.remove(reqOrg(req), id);
  }
}
