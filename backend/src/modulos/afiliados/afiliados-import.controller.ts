import {
  Controller,
  Post,
  Get,
  Body,
  UseInterceptors,
  UploadedFile,
  Res,
  UseGuards,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AfiliadosImportService } from './afiliados-import.service';
import { ImportOptionsDto, ConfirmImportDto } from './dto/import-afiliados.dto';

@Controller('afiliados/import')
@UseGuards(JwtAuthGuard)
export class AfiliadosImportController {
  constructor(private readonly importService: AfiliadosImportService) {}

  /**
   * Descarga plantilla CSV vacía
   */
  @Get('template')
  descargarPlantilla(@Res() res: Response) {
    const csv = this.importService.generarPlantilla();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="plantilla_afiliados.csv"');
    res.send(csv);
  }

  /**
   * Descarga plantilla XLSX vacía
   */
  @Get('template.xlsx')
  async descargarPlantillaXlsx(@Res() res: Response) {
    const xlsx = await this.importService.generarPlantillaXlsx();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename="plantilla_afiliados.xlsx"');
    res.send(xlsx);
  }

  /**
   * Descarga CSV de ejemplo con datos ficticios
   */
  @Get('ejemplo')
  descargarEjemplo(@Res() res: Response) {
    const csv = this.importService.generarEjemplo();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="ejemplo_afiliados.csv"');
    res.send(csv);
  }

  /**
   * Descarga XLSX de ejemplo con datos ficticios
   */
  @Get('ejemplo.xlsx')
  async descargarEjemploXlsx(@Res() res: Response) {
    const xlsx = await this.importService.generarEjemploXlsx();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename="ejemplo_afiliados.xlsx"');
    res.send(xlsx);
  }

  /**
   * Preview de importación (valida sin grabar)
   */
  @Post('preview')
  @UseInterceptors(FileInterceptor('file'))
  async preview(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Body() optionsDto: ImportOptionsDto,
  ) {
    const organizacionId = req.organizacionId as string;
    if (!organizacionId) {
      throw new Error('X-Organizacion-ID requerido');
    }

    if (!file) {
      throw new Error('Archivo requerido');
    }

    return this.importService.preview(
      organizacionId,
      file.buffer,
      optionsDto,
      file.originalname,
      file.mimetype,
    );
  }

  /**
   * Confirmar importación (graba en BD)
   */
  @Post('confirm')
  async confirmar(@Req() req: any, @Body() confirmDto: ConfirmImportDto) {
    const organizacionId = req.organizacionId as string;
    if (!organizacionId) {
      throw new Error('X-Organizacion-ID requerido');
    }
    return this.importService.confirmar(
      organizacionId,
      confirmDto.previewId,
      confirmDto.ignoreWarnings || false,
    );
  }
}
