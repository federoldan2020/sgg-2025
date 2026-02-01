import { Module } from '@nestjs/common';
import { OrganizacionesController } from './organizaciones.controller';
import { OrganizacionesService } from './organizaciones.service';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/audit.service';

@Module({
  controllers: [OrganizacionesController],
  providers: [OrganizacionesService, PrismaService, AuditService],
  exports: [OrganizacionesService],
})
export class OrganizacionesModule {}
