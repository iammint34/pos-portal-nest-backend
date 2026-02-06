import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SendSmsDto, NotificationResult } from '../notifications.types';

/**
 * SMS Provider - Placeholder implementation
 *
 * This can be extended to integrate with SMS providers like:
 * - Twilio
 * - Semaphore (Philippines)
 * - AWS SNS
 * - Nexmo/Vonage
 */
@Injectable()
export class SmsProvider {
  private readonly logger = new Logger(SmsProvider.name);
  private isConfigured = false;

  constructor(private configService: ConfigService) {
    this.initialize();
  }

  private initialize(): void {
    const apiKey = this.configService.get<string>('SMS_API_KEY');
    const provider = this.configService.get<string>('SMS_PROVIDER');

    if (!apiKey || !provider) {
      this.logger.warn(
        'SMS not configured. SMS notifications will be logged but not sent.',
      );
      return;
    }

    this.isConfigured = true;
    this.logger.log(`SMS provider configured: ${provider}`);
  }

  /**
   * Check if SMS provider is configured
   */
  isAvailable(): boolean {
    return this.isConfigured;
  }

  /**
   * Send an SMS
   */
  async send(dto: SendSmsDto): Promise<NotificationResult> {
    this.logger.log(`Sending SMS to: ${dto.to}`);

    if (!this.isAvailable()) {
      // In development without SMS config, just log and return success
      this.logger.warn('SMS not configured - message logged but not sent');
      this.logger.debug(`SMS content: ${dto.message}`);
      return {
        success: true,
        messageId: `dev-sms-${Date.now()}`,
      };
    }

    try {
      // TODO: Implement actual SMS sending based on configured provider
      // Example for Twilio:
      // const client = require('twilio')(accountSid, authToken);
      // const message = await client.messages.create({
      //   body: dto.message,
      //   to: dto.to,
      //   from: this.configService.get('SMS_FROM_NUMBER'),
      // });

      // For now, just log
      this.logger.log(`SMS would be sent to ${dto.to}: ${dto.message}`);

      return {
        success: true,
        messageId: `sms-${Date.now()}`,
      };
    } catch (error: any) {
      this.logger.error(`Failed to send SMS to ${dto.to}`, error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
