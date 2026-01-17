import { Module } from '@nestjs/common';
import { SyncService } from './sync.service';
import { SyncController } from './sync.controller';
import { PosModule } from '../pos/pos.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PosModule, AuditModule],
  controllers: [SyncController],
  providers: [SyncService],
  exports: [SyncService],
})
export class SyncModule {}
