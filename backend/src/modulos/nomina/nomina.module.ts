import { Module } from '@nestjs/common';
import { NominaController } from './nomina.controller';
import { NominaService } from './nomina.service';
import { AuditService } from '../../common/audit.service';

@Module({
  controllers: [NominaController],
  providers: [NominaService, AuditService],
})
export class NominaModule {}
