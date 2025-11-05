import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';
import { RolTercero } from '@prisma/client';
import { TercerosService, type TerceroUpsert } from './terceros.service';

type ReqOrg = Request & { organizacionId?: string };

@Controller('terceros')
export class TercerosController {
  constructor(private readonly svc: TercerosService) {}

  @Get('buscar')
  async buscar(@Req() req: ReqOrg, @Query() q: { q: string; rol?: RolTercero; limit?: string }) {
    const org = req.organizacionId;
    if (!org) throw new BadRequestException('Falta organización');
    const term = (q.q ?? '').trim();
    if (!term) return [];
    const limit = q.limit ? Number(q.limit) : 20;
    return this.svc.buscar(org, term, q.rol ?? null, limit);
  }

  @Get()
  async listar(
    @Req() req: ReqOrg,
    @Query() q: { q?: string; rol?: RolTercero; activo?: string; page?: string; pageSize?: string },
  ) {
    const org = req.organizacionId;
    if (!org) throw new BadRequestException('Falta organización');

    const activo =
      q.activo === undefined
        ? null
        : q.activo === 'true'
          ? true
          : q.activo === 'false'
            ? false
            : null;

    return this.svc.listar(org, {
      q: q.q ?? null,
      rol: q.rol ?? null,
      activo,
      page: q.page ? Number(q.page) : 1,
      pageSize: q.pageSize ? Number(q.pageSize) : 20,
    });
  }

  // ===== Rutas by-id (evitan colisión con subrutas) =====
  @Get('by-id/:id')
  async getById(@Req() req: ReqOrg, @Param('id') id: string) {
    const org = req.organizacionId;
    if (!org) throw new BadRequestException('Falta organización');
    const num = Number(id);
    if (!Number.isFinite(num) || num < 1) throw new BadRequestException('Id inválido');
    return this.svc.obtener(org, BigInt(num));
  }

  @Post()
  async crear(@Req() req: ReqOrg, @Body() body: TerceroUpsert) {
    const org = req.organizacionId;
    if (!org) throw new BadRequestException('Falta organización');
    return this.svc.crear(org, body);
  }

  @Put('by-id/:id')
  async actualizar(@Req() req: ReqOrg, @Param('id') id: string, @Body() body: TerceroUpsert) {
    const org = req.organizacionId;
    if (!org) throw new BadRequestException('Falta organización');
    const num = Number(id);
    if (!Number.isFinite(num) || num < 1) throw new BadRequestException('Id inválido');
    return this.svc.actualizar(org, BigInt(num), body);
  }

  @Patch('by-id/:id/toggle')
  async toggle(@Req() req: ReqOrg, @Param('id') id: string, @Body() b: { activo: boolean }) {
    const org = req.organizacionId;
    if (!org) throw new BadRequestException('Falta organización');
    const num = Number(id);
    if (!Number.isFinite(num) || num < 1) throw new BadRequestException('Id inválido');
    return this.svc.toggleActivo(org, BigInt(num), Boolean(b.activo));
  }

  @Delete('by-id/:id')
  async eliminar(@Req() req: ReqOrg, @Param('id') id: string) {
    const org = req.organizacionId;
    if (!org) throw new BadRequestException('Falta organización');
    const num = Number(id);
    if (!Number.isFinite(num) || num < 1) throw new BadRequestException('Id inválido');
    return this.svc.eliminar(org, BigInt(num));
  }

  /* ===== Alias numéricos para compat con el front actual =====
  // OJO: usar \\d+ (doble backslash) para evitar el error de path-to-regexp
  @Get(':id(\\d+)')
  aliasGet(@Req() req: ReqOrg, @Param('id') id: string) {
    return this.getById(req, id);
  }

  @Put(':id(\\d+)')
  aliasPut(@Req() req: ReqOrg, @Param('id') id: string, @Body() body: TerceroUpsert) {
    return this.actualizar(req, id, body);
  }

  @Patch(':id(\\d+)/toggle')
  aliasToggle(@Req() req: ReqOrg, @Param('id') id: string, @Body() b: { activo: boolean }) {
    return this.toggle(req, id, b);
  }

  @Delete(':id(\\d+)')
  aliasDelete(@Req() req: ReqOrg, @Param('id') id: string) {
    return this.eliminar(req, id);
  }
    */
}
