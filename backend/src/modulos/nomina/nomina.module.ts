import { Module } from '@nestjs/common';
import { NominaController } from './nomina.controller';
import { NominaService } from './nomina.service';
import { AuditService } from '../../common/audit.service';
import { PrismaService } from '../../common/prisma.service';

@Module({
  controllers: [NominaController],
  providers: [NominaService, PrismaService, AuditService],
})
export class NominaModule {}
