import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { LossPreventionService } from './loss-prevention.service';
import { LossPreventionEvaluatorService } from './loss-prevention-evaluator.service';
import { LossPreventionController } from './loss-prevention.controller';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
@Module({
  imports: [
    ScheduleModule.forRoot(),
    AuditModule,
    NotificationsModule,
  ],
  controllers: [LossPreventionController],
  providers: [LossPreventionService, LossPreventionEvaluatorService],
  exports: [LossPreventionService, LossPreventionEvaluatorService],
})
export class LossPreventionModule {}
