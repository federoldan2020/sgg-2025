// src/modulos/comercios/comercios.import.controller.ts
import {
  BadRequestException,
  Controller,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ComerciosImportService } from './comercios.import.service';
import { OrgId } from 'src/common/decorators/org-id.decorator';

@Controller('comercios')
export class ComerciosImportController {
  constructor(private readonly importSvc: ComerciosImportService) {}

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  async importar(
    @OrgId() organizacionId: string,
    @UploadedFile() file: Express.Multer.File,
    @Query('dry') dry?: string,
  ) {
    if (!file) throw new BadRequestException('Falta archivo CSV (campo "file").');
    const isDryRun = dry === 'true';
    return this.importSvc.importCsv(organizacionId, file.buffer, { dryRun: isDryRun });
  }
}
