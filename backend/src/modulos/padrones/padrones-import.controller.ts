import { Body, Controller, Get, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PadronesImportService } from './padrones-import.service';
import { type ImportOptionsDto, type ImportPreviewResponse, type ImportResultResponse } from './dto/import-padrones.dto';

@UseGuards(JwtAuthGuard)
@Controller('padrones/import')
export class PadronesImportController {
  constructor(private readonly service: PadronesImportService) {}

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
  async confirm(@Body('previewId') previewId: string, @Body('org') org: string): Promise<ImportResultResponse> {
    return this.service.confirmar(org, previewId);
  }
}
