import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { IsIn, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { Usuario } from '@prisma/client';
import { NovedadesService } from './novedades.service';

type ReqOrg = Request & { organizacionId?: string };

function requireOrg(req: ReqOrg): string {
  if (!req.organizacionId) throw new BadRequestException('Falta organización');
  return req.organizacionId;
}

class GenerarBorradorDto {
  @IsString()
  @Length(7, 7)
  periodo!: string;

  @IsOptional()
  @IsIn(['ESC'])
  canal?: 'ESC';
}

class AnularLoteDto {
  @IsString()
  @IsNotEmpty()
  motivo!: string;
}

class CancelarBajaDto {
  @IsString()
  @IsNotEmpty()
  motivo!: string;
}

@Controller('novedades')
export class NovedadesController {
  constructor(private readonly service: NovedadesService) {}

  // -------- Lotes --------

  @Public()
  @Get('lotes')
  async listar(@Req() req: ReqOrg, @Query('limit') limit?: string) {
    return this.service.listar(requireOrg(req), limit ? Number(limit) : 20);
  }

  @Public()
  @Post('generar')
  async generar(
    @Req() req: ReqOrg,
    @Body() dto: GenerarBorradorDto,
    @CurrentUser() user?: Usuario,
  ) {
    return this.service.generarBorrador({
      organizacionId: requireOrg(req),
      periodo: dto.periodo,
      canal: dto.canal ?? 'ESC',
      usuarioId: user?.id?.toString(),
    });
  }

  @Public()
  @Get('lotes/:id')
  async detalle(@Req() req: ReqOrg, @Param('id', ParseIntPipe) id: number) {
    return this.service.detalle(requireOrg(req), BigInt(id));
  }

  @Public()
  @Get('lotes/:id/items')
  async items(@Req() req: ReqOrg, @Param('id', ParseIntPipe) id: number) {
    return this.service.items(requireOrg(req), BigInt(id));
  }

  @Public()
  @Get('lotes/:id/archivo')
  async archivo(
    @Req() req: ReqOrg,
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const { contenido, nombre } = await this.service.getArchivo(requireOrg(req), BigInt(id));
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
    res.send(contenido);
  }

  @Public()
  @Post('lotes/:id/marcar-enviado')
  async marcarEnviado(
    @Req() req: ReqOrg,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user?: Usuario,
  ) {
    return this.service.marcarEnviado(requireOrg(req), BigInt(id), user?.id?.toString());
  }

  @Public()
  @Post('lotes/:id/anular')
  async anular(
    @Req() req: ReqOrg,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AnularLoteDto,
    @CurrentUser() user?: Usuario,
  ) {
    return this.service.anular(
      requireOrg(req),
      BigInt(id),
      dto.motivo,
      user?.id?.toString(),
    );
  }

  // -------- Bajas Informables --------

  @Public()
  @Get('bajas-pendientes')
  async listarBajas(@Req() req: ReqOrg) {
    return this.service.listarBajasPendientes(requireOrg(req));
  }

  @Public()
  @Post('bajas/:id/cancelar')
  async cancelarBaja(
    @Req() req: ReqOrg,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelarBajaDto,
    @CurrentUser() user?: Usuario,
  ) {
    return this.service.cancelarBaja(
      requireOrg(req),
      BigInt(id),
      dto.motivo,
      user?.id?.toString(),
    );
  }
}
