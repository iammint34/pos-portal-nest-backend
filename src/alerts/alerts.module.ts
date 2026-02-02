import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AlertsService } from './alerts.service';
import { AlertConfigService } from './alert-config.service';
import { AlertEvaluatorService } from './alert-evaluator.service';
import { AlertsController } from './alerts.controller';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [AlertsController],
  providers: [AlertsService, AlertConfigService, AlertEvaluatorService],
  exports: [AlertsService, AlertConfigService],
})
export class AlertsModule {}
