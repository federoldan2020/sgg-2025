// =============================================================
// src/padrones/padrones.controller.ts
// =============================================================
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type { Request } from 'express';
import { PadronesService } from './padrones.service';
import { CreatePadronDto } from './dto/create-padron.dto';
import { UpdatePadronDto } from './dto/update-padron.dto';
import { PadronesQueryDto } from './dto/padrones-query.dto';
import { BigIntParamPipe } from '../../common/pipes/bigint-param.pipe';
import { AuditService } from '../../common/audit.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { Usuario } from '@prisma/client';

type ReqWithOrg = Request & { organizacionId?: string; ip?: string; headers?: Record<string, string> };

@Controller('padrones')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class PadronesController {
  constructor(
    private readonly service: PadronesService,
    private readonly audit: AuditService,
  ) {}

  @Post()
  async crear(
    @Req() req: ReqWithOrg,
    @Body() dto: CreatePadronDto,
    @CurrentUser() user: Usuario,
  ) {
    const result = await this.service.create(req.organizacionId!, dto);
    const res = result as { id?: string | bigint; padron?: string };
    await this.audit.log({
      usuarioId: user.id.toString(),
      organizacionId: req.organizacionId!,
      accion: 'PADRON_CREAR',
      entidad: 'Padron',
      entidadId: res?.id != null ? String(res.id) : undefined,
      payloadDespues: { padron: res?.padron ?? dto.padron },
      ipAddress: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
    return result;
  }

  @Get()
  async listar(@Req() req: ReqWithOrg, @Query('afiliadoId') afiliadoId?: string) {
    return this.service.findAll(req.organizacionId!, afiliadoId ? Number(afiliadoId) : undefined);
  }

  @Get('paged')
  async paged(@Req() req: ReqWithOrg, @Query() query: PadronesQueryDto) {
    return this.service.findPaged(req.organizacionId!, query);
  }

  @Get(':id')
  async getOne(@Req() req: ReqWithOrg, @Param('id', BigIntParamPipe) id: bigint) {
    return this.service.findOne(req.organizacionId!, id);
  }

  @Patch(':id')
  async actualizar(
    @Req() req: ReqWithOrg,
    @Param('id', BigIntParamPipe) id: bigint,
    @Body() dto: UpdatePadronDto,
    @CurrentUser() user: Usuario,
  ) {
    const result = await this.service.update(req.organizacionId!, id, dto);
    await this.audit.log({
      usuarioId: user.id.toString(),
      organizacionId: req.organizacionId!,
      accion: 'PADRON_ACTUALIZAR',
      entidad: 'Padron',
      entidadId: id.toString(),
      payloadDespues: dto as unknown as Record<string, unknown>,
      ipAddress: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
    return result;
  }

  @Delete(':id')
  async eliminar(
    @Req() req: ReqWithOrg,
    @Param('id', BigIntParamPipe) id: bigint,
    @Query('hard') hard?: string,
    @CurrentUser() user?: Usuario,
  ) {
    const result = await this.service.remove(req.organizacionId!, id, hard === 'true');
    if (user) {
      await this.audit.log({
        usuarioId: user.id.toString(),
        organizacionId: req.organizacionId!,
        accion: 'PADRON_ELIMINAR',
        entidad: 'Padron',
        entidadId: id.toString(),
        payloadDespues: { hard: hard === 'true' },
        ipAddress: req.ip,
        userAgent: req.headers?.['user-agent'],
      });
    }
    return result;
  }
}
