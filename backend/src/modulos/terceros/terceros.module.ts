import { Module } from '@nestjs/common';
import { TercerosService } from './terceros.service';
import { TercerosController } from './terceros.controller';
import { TercerosImportController } from './terceros.import.controller';
import { AuditService } from '../../common/audit.service';
import { PrismaService } from '../../common/prisma.service';

@Module({
  controllers: [TercerosController, TercerosImportController],
  providers: [TercerosService, PrismaService, AuditService],
  exports: [TercerosService],
})
export class TercerosModule {}
