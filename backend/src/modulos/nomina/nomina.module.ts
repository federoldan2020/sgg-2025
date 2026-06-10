import { Module } from '@nestjs/common';
import { NominaController } from './nomina.controller';
import { NominaService } from './nomina.service';
import { ImportarCobranzaController } from './importar-cobranza.controller';
import { ImportarCobranzaService } from './importar-cobranza.service';
import { ImportarCobranzaAnsesController } from './importar-cobranza-anses.controller';
import { ImportarCobranzaAnsesService } from './importar-cobranza-anses.service';
import { AuditService } from '../../common/audit.service';
import { PrismaService } from '../../common/prisma.service';
import { SuspensionesModule } from '../suspensiones/suspensiones.module';

@Module({
  imports: [SuspensionesModule],
  controllers: [
    NominaController,
    ImportarCobranzaController,
    ImportarCobranzaAnsesController,
  ],
  providers: [
    NominaService,
    ImportarCobranzaService,
    ImportarCobranzaAnsesService,
    PrismaService,
    AuditService,
  ],
})
export class NominaModule {}
