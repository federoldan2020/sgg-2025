import { Module } from '@nestjs/common';
import { TercerosService } from './terceros.service';
import { TercerosController } from './terceros.controller';
import { TercerosImportController } from './terceros.import.controller';

@Module({
  controllers: [TercerosController, TercerosImportController],
  providers: [TercerosService],
  exports: [TercerosService],
})
export class TercerosModule {}
