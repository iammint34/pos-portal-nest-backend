// Job Processor Interface
// Implement this interface to create custom job processors

import { JobType } from './jobs.constants';
import { JobProcessorContext, JobProcessorResult } from './jobs.types';

/**
 * Interface for job processors.
 * Each processor handles a specific job type.
 */
export interface IJobProcessor {
  /**
   * The job type this processor handles
   */
  readonly jobType: JobType;

  /**
   * Process the job
   * @param context - Contains the job data and helper functions
   * @returns Promise with the result of the job processing
   */
  process(context: JobProcessorContext): Promise<JobProcessorResult>;

  /**
   * Optional: Called before job processing starts
   * Use for validation or setup
   */
  beforeProcess?(context: JobProcessorContext): Promise<void>;

  /**
   * Optional: Called after job processing completes (success or failure)
   * Use for cleanup
   */
  afterProcess?(
    context: JobProcessorContext,
    result: JobProcessorResult,
  ): Promise<void>;

  /**
   * Optional: Called when job fails and will be retried
   */
  onRetry?(context: JobProcessorContext, attempt: number): Promise<void>;

  /**
   * Optional: Called when job fails permanently (max attempts reached)
   */
  onFailure?(context: JobProcessorContext, error: Error): Promise<void>;
}

/**
 * Token for injecting job processors
 */
export const JOB_PROCESSORS = 'JOB_PROCESSORS';
