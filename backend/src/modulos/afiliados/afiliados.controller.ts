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

@Controller('afiliados')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class AfiliadosController {
  constructor(private readonly service: AfiliadosService) {}

  @Post()
  async crear(@Req() req: Request, @Body() dto: CreateAfiliadoDto) {
    return this.service.create(req.organizacionId!, dto);
  }

  @Get()
  async listar(@Req() req: Request) {
    return this.service.findAll(req.organizacionId!);
  }

  @Get('paged')
  async paged(@Req() req: Request, @Query() query: AfiliadosQueryDto) {
    return this.service.findPaged(req.organizacionId!, query);
  }

  // RUTA ESTÁTICA ANTES DE /:id
  @Get('suggest')
  async suggest(@Req() req: Request, @Query() query: AfiliadosSuggestQueryDto) {
    return this.service.suggest(req.organizacionId!, query);
  }

  @Get(':id')
  async getOne(@Req() req: Request, @Param('id', BigIntParamPipe) id: bigint) {
    return this.service.findOne(req.organizacionId!, id);
  }

  @Patch(':id')
  async actualizar(
    @Req() req: Request,
    @Param('id', BigIntParamPipe) id: bigint,
    @Body() dto: UpdateAfiliadoDto,
  ) {
    return this.service.update(req.organizacionId!, id, dto);
  }

  @Delete(':id')
  async eliminar(
    @Req() req: Request,
    @Param('id', BigIntParamPipe) id: bigint,
    @Query('hard') hard?: string,
  ) {
    return this.service.remove(req.organizacionId!, id, hard === 'true');
  }
}
