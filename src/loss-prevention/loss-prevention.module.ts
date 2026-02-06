import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { LossPreventionService } from './loss-prevention.service';
import { LossPreventionEvaluatorService } from './loss-prevention-evaluator.service';
import { LossPreventionController } from './loss-prevention.controller';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    AuditModule,
    NotificationsModule,
    FeatureFlagsModule,
  ],
  controllers: [LossPreventionController],
  providers: [LossPreventionService, LossPreventionEvaluatorService],
  exports: [LossPreventionService, LossPreventionEvaluatorService],
})
export class LossPreventionModule {}
