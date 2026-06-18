import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { DossanjuanAuthService } from './dossanjuan-auth.service';
import { DossanjuanService } from './dossanjuan.service';
import { DossanjuanSyncService } from './dossanjuan-sync.service';
import { DossanjuanController } from './dossanjuan.controller';

@Module({
  controllers: [DossanjuanController],
  providers: [
    PrismaService,
    DossanjuanAuthService,
    DossanjuanService,
    DossanjuanSyncService,
  ],
  exports: [DossanjuanSyncService],
})
export class DossanjuanModule {}
