// src/modulos/contabilidad/plan.import.controller.ts
import { Controller, Post, UseInterceptors, UploadedFile, Req } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express'; // 👈 IMPORTANTE: solo tipos
import { ContabilidadService } from './contabilidad.service';

@Controller('contabilidad/plan')
export class PlanImportController {
  constructor(private readonly contabilidad: ContabilidadService) {}

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  async importar(@Req() req: any, @UploadedFile() file: Express.Multer.File) {
    const org = req.organizacionId as string | undefined;
    if (!org) throw new Error('Falta organización');
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new Error('Archivo vacío o ausente');
    }

    // 🔒 Narrowing runtime + tipo concreto para el linter
    const buf: Buffer = Buffer.isBuffer(file.buffer)
      ? file.buffer
      : Buffer.from(file.buffer as ArrayBuffer);

    return this.contabilidad.importarPlanDesdeCSV(org, buf);
  }
}
