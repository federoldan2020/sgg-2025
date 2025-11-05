import { Module } from '@nestjs/common';
import { ComerciosController } from './comercios.controller';
import { ComerciosService } from './comercios.service';
import { PrismaService } from 'src/common/prisma.service';
import { ComerciosImportService } from './comercios.import.service';
import { ComerciosImportController } from './comercios.import.controller';

@Module({
  controllers: [ComerciosImportController, ComerciosController],
  providers: [ComerciosService, ComerciosImportService, PrismaService],
  exports: [ComerciosService],
})
export class ComerciosModule {}
