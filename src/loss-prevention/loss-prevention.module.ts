import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { LossPreventionService } from './loss-prevention.service';
import { LossPreventionEvaluatorService } from './loss-prevention-evaluator.service';
import { LossPreventionController } from './loss-prevention.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    AuditModule,
  ],
  controllers: [LossPreventionController],
  providers: [LossPreventionService, LossPreventionEvaluatorService],
  exports: [LossPreventionService, LossPreventionEvaluatorService],
})
export class LossPreventionModule {}
