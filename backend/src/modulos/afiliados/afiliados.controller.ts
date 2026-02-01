// =============================================================
// src/afiliados/afiliados.controller.ts (extensiones)
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
import { AfiliadosService } from './afiliados.service';
import { CreateAfiliadoDto } from './dto/create-afiliado.dto';
import { UpdateAfiliadoDto } from './dto/update-afiliado.dto';
import { AfiliadosQueryDto } from './dto/afiliados-query.dto';
import { AfiliadosSuggestQueryDto } from './dto/afiliados-suggest.dto';
import { BigIntParamPipe } from '../../common/pipes/bigint-param.pipe';
import { Public } from '../auth/decorators/public.decorator';
import { AuditService } from '../../common/audit.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { Usuario } from '@prisma/client';

type ReqWithOrg = Request & { organizacionId?: string; ip?: string; headers?: Record<string, string> };

@Controller('afiliados')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Public() // Temporalmente público para testing
export class AfiliadosController {
  constructor(
    private readonly service: AfiliadosService,
    private readonly audit: AuditService,
  ) {}

  @Post()
  async crear(
    @Req() req: ReqWithOrg,
    @Body() dto: CreateAfiliadoDto,
    @CurrentUser() user?: Usuario,
  ) {
    const result = await this.service.create(req.organizacionId!, dto);
    if (user) {
      await this.audit.log({
        usuarioId: user.id.toString(),
        organizacionId: req.organizacionId!,
        accion: 'AFILIADO_CREAR',
        entidad: 'Afiliado',
        entidadId: (result as unknown as { id?: bigint })?.id != null ? String((result as unknown as { id: bigint }).id) : undefined,
        payloadDespues: { dni: dto.dni, apellido: dto.apellido, nombre: dto.nombre },
        ipAddress: req.ip,
        userAgent: req.headers?.['user-agent'],
      });
    }
    return result;
  }

  @Get()
  async listar(@Req() req: ReqWithOrg) {
    return this.service.findAll(req.organizacionId!);
  }

  @Get('paged')
  async paged(@Req() req: ReqWithOrg, @Query() query: AfiliadosQueryDto) {
    return this.service.findPaged(req.organizacionId!, query);
  }

  // RUTA ESTÁTICA ANTES DE /:id
  @Get('suggest')
  async suggest(@Req() req: ReqWithOrg, @Query() query: AfiliadosSuggestQueryDto) {
    return this.service.suggest(req.organizacionId!, query);
  }

  @Get(':id')
  async getOne(@Req() req: ReqWithOrg, @Param('id', BigIntParamPipe) id: bigint) {
    return this.service.findOne(req.organizacionId!, id);
  }

  @Patch(':id')
  async actualizar(
    @Req() req: ReqWithOrg,
    @Param('id', BigIntParamPipe) id: bigint,
    @Body() dto: UpdateAfiliadoDto,
    @CurrentUser() user?: Usuario,
  ) {
    const result = await this.service.update(req.organizacionId!, id, dto);
    if (user) {
      await this.audit.log({
        usuarioId: user.id.toString(),
        organizacionId: req.organizacionId!,
        accion: 'AFILIADO_ACTUALIZAR',
        entidad: 'Afiliado',
        entidadId: id.toString(),
        payloadDespues: dto as unknown as Record<string, unknown>,
        ipAddress: req.ip,
        userAgent: req.headers?.['user-agent'],
      });
    }
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
        accion: 'AFILIADO_ELIMINAR',
        entidad: 'Afiliado',
        entidadId: id.toString(),
        payloadDespues: { hard: hard === 'true' },
        ipAddress: req.ip,
        userAgent: req.headers?.['user-agent'],
      });
    }
    return result;
  }
}
