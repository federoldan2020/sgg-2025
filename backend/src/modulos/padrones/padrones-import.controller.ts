import { Body, Controller, Get, Post, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PadronesImportService } from './padrones-import.service';
import { type ImportOptionsDto, type ImportPreviewResponse, type ImportResultResponse } from './dto/import-padrones.dto';
import { AuditService } from '../../common/audit.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { Usuario } from '@prisma/client';

type ReqWithIp = { ip?: string; headers?: Record<string, string> };

@UseGuards(JwtAuthGuard)
@Controller('padrones/import')
export class PadronesImportController {
  constructor(
    private readonly service: PadronesImportService,
    private readonly audit: AuditService,
  ) {}

  @Get('template')
  getTemplate(): string {
    return this.service.generarPlantilla();
  }

  @Get('ejemplo')
  getEjemplo(): string {
    return this.service.generarEjemplo();
  }

  @Post('preview')
  @UseInterceptors(FileInterceptor('file'))
  async preview(@UploadedFile() file: Express.Multer.File, @Body() body: ImportOptionsDto, @Body('org') org: string): Promise<ImportPreviewResponse> {
    return this.service.preview(org, file.buffer, body);
  }

  @Post('confirm')
  async confirm(
    @Body('previewId') previewId: string,
    @Body('org') org: string,
    @Req() req: ReqWithIp,
    @CurrentUser() user: Usuario,
  ): Promise<ImportResultResponse> {
    const result = await this.service.confirmar(org, previewId);
    await this.audit.log({
      usuarioId: user.id.toString(),
      organizacionId: org,
      accion: 'PADRON_IMPORT',
      entidad: 'Padron',
      entidadId: undefined,
      payloadDespues: { previewId, creados: (result as { creados?: number })?.creados, actualizados: (result as { actualizados?: number })?.actualizados },
      ipAddress: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
    return result;
  }
}
