import { Module, DynamicModule, Provider } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { IJobProcessor, JOB_PROCESSORS } from './job-processor.interface';

export interface JobsModuleOptions {
  processors?: Provider<IJobProcessor>[];
}

@Module({})
export class JobsModule {
  /**
   * Register the JobsModule with optional job processors
   *
   * @example
   * // In app.module.ts
   * JobsModule.register({
   *   processors: [DailyDigestProcessor, AlertNotificationProcessor],
   * })
   */
  static register(options: JobsModuleOptions = {}): DynamicModule {
    const processorProviders = options.processors || [];

    return {
      module: JobsModule,
      imports: [ScheduleModule.forRoot()],
      controllers: [JobsController],
      providers: [
        JobsService,
        ...processorProviders,
        {
          provide: JOB_PROCESSORS,
          useFactory: (...processors: IJobProcessor[]) => processors,
          inject: processorProviders.map((p) =>
            typeof p === 'function'
              ? p
              : (p as any).useClass || (p as any).provide,
          ),
        },
      ],
      exports: [JobsService],
    };
  }

  /**
   * Register the JobsModule for root (global) use
   */
  static forRoot(options: JobsModuleOptions = {}): DynamicModule {
    const module = this.register(options);
    return {
      ...module,
      global: true,
    };
  }
}
