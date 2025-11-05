import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ParentescosService } from './parentescos.service';
import type { CrearParentescoDto, EditarParentescoDto } from './dtos';

type ReqOrg = Request & { organizacionId?: string };

@Controller('parametricos/parentescos')
export class ParentescosController {
  constructor(private readonly svc: ParentescosService) {}

  @Get()
  listar(@Req() req: ReqOrg) {
    if (!req.organizacionId) throw new Error('Falta organización');
    return this.svc.listar(req.organizacionId);
  }

  @Post()
  crear(@Req() req: ReqOrg, @Body() dto: CrearParentescoDto) {
    if (!req.organizacionId) throw new Error('Falta organización');
    return this.svc.crear(req.organizacionId, dto);
  }

  @Patch(':id')
  editar(@Req() req: ReqOrg, @Param('id') id: string, @Body() dto: EditarParentescoDto) {
    if (!req.organizacionId) throw new Error('Falta organización');
    return this.svc.editar(req.organizacionId, Number(id), dto);
  }

  @Delete(':id')
  eliminar(@Req() req: ReqOrg, @Param('id') id: string) {
    if (!req.organizacionId) throw new Error('Falta organización');
    return this.svc.eliminar(req.organizacionId, Number(id));
  }
}
