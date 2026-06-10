import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { CupoController } from './cupo.controller';
import { CupoService } from './cupo.service';

@Module({
  controllers: [CupoController],
  providers: [PrismaService, CupoService],
  exports: [CupoService],
})
export class CupoModule {}
