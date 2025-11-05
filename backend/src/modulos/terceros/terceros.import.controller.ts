import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Req,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { TercerosService } from './terceros.service';

type ReqOrg = Request & { organizacionId?: string };
type TipoImport = 'prestadores' | 'proveedores' | 'terceros';
const TIPO_DEF: TipoImport = 'terceros';
const normTipo = (t?: string): TipoImport =>
  t === 'prestadores' || t === 'proveedores' || t === 'terceros' ? t : TIPO_DEF;

@Controller('terceros/import')
export class TercerosImportController {
  constructor(private readonly svc: TercerosService) {}

  @Post('preview')
  @UseInterceptors(FileInterceptor('file'))
  preview(@UploadedFile() file: Express.Multer.File, @Query('tipo') tipo?: TipoImport) {
    if (!file) throw new BadRequestException('Archivo ausente');
    const buf = file.buffer;
    if (!buf?.length) throw new BadRequestException('Archivo vacío o almacenamiento no es memoria');
    return this.svc.importPreview(buf, normTipo(tipo));
  }

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async importar(
    @Req() req: ReqOrg,
    @UploadedFile() file: Express.Multer.File,
    @Query('tipo') tipo?: TipoImport,
    @Query('organizacionId') orgQ?: string,
  ) {
    if (!file) throw new BadRequestException('Archivo ausente');
    const buf = file.buffer;
    if (!buf?.length) throw new BadRequestException('Archivo vacío o almacenamiento no es memoria');

    const org = req.organizacionId || orgQ || process.env.ORGANIZACION_ID;
    if (!org) throw new BadRequestException('Falta organización');

    return this.svc.importExecute(org, buf, normTipo(tipo));
  }
}
