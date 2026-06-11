import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { Usuario } from '@prisma/client';
import { ImportarNovedadesService } from './importar-novedades.service';

type ReqOrg = Request & { organizacionId?: string };

function requireOrg(req: ReqOrg): string {
  if (!req.organizacionId) throw new BadRequestException('Falta organización');
  return req.organizacionId;
}

/**
 * Importa la planilla de NOVEDADES del legacy (lo que se envió a Cómputos) y
 * la siembra como obligaciones, para luego conciliar contra el TXT de retorno.
 *
 * Subir el .xlsx en multipart/form-data (campo `archivo`) + `periodo` (YYYY-MM).
 */
@Controller('nomina/importar-novedades')
export class ImportarNovedadesController {
  constructor(private readonly service: ImportarNovedadesService) {}

  /** Lee la planilla, matchea padrones y reporta qué se sembraría. NO escribe. */
  @Public()
  @Post('preview')
  @UseInterceptors(FileInterceptor('archivo', { limits: { fileSize: 20 * 1024 * 1024 } }))
  async preview(
    @Req() req: ReqOrg,
    @UploadedFile() archivo: Express.Multer.File | undefined,
    @Body('periodo') periodo?: string,
  ) {
    if (!archivo) throw new BadRequestException('Subí el archivo .xlsx en el campo "archivo".');
    if (!periodo) throw new BadRequestException('Indicá el período (campo "periodo", formato YYYY-MM).');
    return this.service.preview(requireOrg(req), archivo.buffer, periodo);
  }

  /** Crea las obligaciones (idempotente). */
  @Public()
  @Post('confirmar')
  @UseInterceptors(FileInterceptor('archivo', { limits: { fileSize: 20 * 1024 * 1024 } }))
  async confirmar(
    @Req() req: ReqOrg,
    @UploadedFile() archivo: Express.Multer.File | undefined,
    @Body('periodo') periodo?: string,
    @CurrentUser() user?: Usuario,
  ) {
    if (!archivo) throw new BadRequestException('Subí el archivo .xlsx en el campo "archivo".');
    if (!periodo) throw new BadRequestException('Indicá el período (campo "periodo", formato YYYY-MM).');
    return this.service.confirmar(requireOrg(req), archivo.buffer, periodo, {
      usuarioId: user?.id?.toString(),
      archivoNombre: archivo.originalname,
    });
  }
}
