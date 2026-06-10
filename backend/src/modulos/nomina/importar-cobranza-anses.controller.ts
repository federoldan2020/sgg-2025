import {
  BadRequestException,
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
import { ImportarCobranzaAnsesService } from './importar-cobranza-anses.service';

type ReqOrg = Request & { organizacionId?: string };

function requireOrg(req: ReqOrg): string {
  if (!req.organizacionId) throw new BadRequestException('Falta organización');
  return req.organizacionId;
}

/**
 * Importación del TXT UDAME de ANSES (jubilados).
 * El archivo viene en encoding latin-1 → lo decodificamos acá antes de
 * pasarlo al service.
 */
@Controller('nomina/importar-cobranza-anses')
export class ImportarCobranzaAnsesController {
  constructor(private readonly service: ImportarCobranzaAnsesService) {}

  @Public()
  @Post('preview')
  @UseInterceptors(FileInterceptor('archivo', { limits: { fileSize: 20 * 1024 * 1024 } }))
  async preview(
    @Req() req: ReqOrg,
    @UploadedFile() archivo: Express.Multer.File | undefined,
  ) {
    if (!archivo) throw new BadRequestException('Subí el archivo TXT en el campo "archivo".');
    const contenido = archivo.buffer.toString('latin1');
    return this.service.preview(requireOrg(req), contenido);
  }

  @Public()
  @Post('confirmar')
  @UseInterceptors(FileInterceptor('archivo', { limits: { fileSize: 20 * 1024 * 1024 } }))
  async confirmar(
    @Req() req: ReqOrg,
    @UploadedFile() archivo: Express.Multer.File | undefined,
    @CurrentUser() user?: Usuario,
  ) {
    if (!archivo) throw new BadRequestException('Subí el archivo TXT en el campo "archivo".');
    const contenido = archivo.buffer.toString('latin1');
    return this.service.confirmar(requireOrg(req), contenido, {
      usuarioId: user?.id?.toString(),
      archivoNombre: archivo.originalname,
    });
  }
}
