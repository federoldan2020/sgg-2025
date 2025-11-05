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

@Controller('padrones')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class PadronesController {
  constructor(private readonly service: PadronesService) {}

  @Post()
  async crear(@Req() req: Request, @Body() dto: CreatePadronDto) {
    return this.service.create(req.organizacionId!, dto);
  }

  @Get()
  async listar(@Req() req: Request, @Query('afiliadoId') afiliadoId?: string) {
    return this.service.findAll(req.organizacionId!, afiliadoId ? Number(afiliadoId) : undefined);
  }

  @Get('paged')
  async paged(@Req() req: Request, @Query() query: PadronesQueryDto) {
    return this.service.findPaged(req.organizacionId!, query);
  }

  @Get(':id')
  async getOne(@Req() req: Request, @Param('id', BigIntParamPipe) id: bigint) {
    return this.service.findOne(req.organizacionId!, id);
  }

  @Patch(':id')
  async actualizar(
    @Req() req: Request,
    @Param('id', BigIntParamPipe) id: bigint,
    @Body() dto: UpdatePadronDto,
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
