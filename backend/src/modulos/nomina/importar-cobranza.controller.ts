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
import { ImportarCobranzaService } from './importar-cobranza.service';

type ReqOrg = Request & { organizacionId?: string };

function requireOrg(req: ReqOrg): string {
  if (!req.organizacionId) throw new BadRequestException('Falta organización');
  return req.organizacionId;
}

@Controller('nomina/importar-cobranza')
export class ImportarCobranzaController {
  constructor(private readonly service: ImportarCobranzaService) {}

  /**
   * Subida del TXT en multipart/form-data (campo `archivo`). Parsea, valida
   * que todos los padrones existan en la base, y devuelve un preview.
   * NO escribe nada.
   */
  @Public()
  @Post('preview')
  @UseInterceptors(FileInterceptor('archivo', { limits: { fileSize: 20 * 1024 * 1024 } }))
  async preview(
    @Req() req: ReqOrg,
    @UploadedFile() archivo: Express.Multer.File | undefined,
  ) {
    if (!archivo) throw new BadRequestException('Subí el archivo TXT en el campo "archivo".');
    const contenido = archivo.buffer.toString('utf8');
    return this.service.preview(requireOrg(req), contenido);
  }

  /**
   * Aplica la cobranza. Se reenvía el archivo entero para volver a parsear y
   * verificar (evita que un cliente armado a mano confirme con items
   * adulterados).
   */
  @Public()
  @Post('confirmar')
  @UseInterceptors(FileInterceptor('archivo', { limits: { fileSize: 20 * 1024 * 1024 } }))
  async confirmar(
    @Req() req: ReqOrg,
    @UploadedFile() archivo: Express.Multer.File | undefined,
    @CurrentUser() user?: Usuario,
  ) {
    if (!archivo) throw new BadRequestException('Subí el archivo TXT en el campo "archivo".');
    const contenido = archivo.buffer.toString('utf8');
    return this.service.confirmar(requireOrg(req), contenido, {
      usuarioId: user?.id?.toString(),
      archivoNombre: archivo.originalname,
    });
  }
}
