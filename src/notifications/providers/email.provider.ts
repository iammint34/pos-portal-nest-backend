import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { SendEmailDto, NotificationResult } from '../notifications.types';

@Injectable()
export class EmailProvider {
  private readonly logger = new Logger(EmailProvider.name);
  private transporter: nodemailer.Transporter | null = null;
  private isConfigured = false;

  constructor(private configService: ConfigService) {
    this.initializeTransporter();
  }

  private initializeTransporter(): void {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<number>('SMTP_PORT');
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    if (!host || !port) {
      this.logger.warn(
        'SMTP not configured. Email notifications will be logged but not sent.',
      );
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth:
          user && pass
            ? {
                user,
                pass,
              }
            : undefined,
      });

      this.isConfigured = true;
      this.logger.log(`Email provider configured with SMTP host: ${host}`);
    } catch (error) {
      this.logger.error('Failed to initialize email transporter', error);
    }
  }

  /**
   * Check if email provider is configured
   */
  isAvailable(): boolean {
    return this.isConfigured && this.transporter !== null;
  }

  /**
   * Send an email
   */
  async send(dto: SendEmailDto): Promise<NotificationResult> {
    const fromAddress =
      dto.from ||
      this.configService.get<string>('SMTP_FROM') ||
      'noreply@pos-portal.com';

    // Log the email for debugging/development
    this.logger.log(`Sending email to: ${dto.to}, subject: ${dto.subject}`);

    if (!this.isAvailable()) {
      // In development without SMTP, just log and return success
      this.logger.warn('SMTP not configured - email logged but not sent');
      this.logger.debug(
        `Email content: ${dto.text || dto.html.substring(0, 200)}...`,
      );
      return {
        success: true,
        messageId: `dev-${Date.now()}`,
      };
    }

    try {
      const result = await this.transporter!.sendMail({
        from: fromAddress,
        to: dto.to,
        replyTo: dto.replyTo,
        subject: dto.subject,
        html: dto.html,
        text: dto.text,
      });

      this.logger.log(`Email sent successfully: ${result.messageId}`);
      return {
        success: true,
        messageId: result.messageId,
      };
    } catch (error: any) {
      this.logger.error(`Failed to send email to ${dto.to}`, error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Verify SMTP connection
   */
  async verify(): Promise<boolean> {
    if (!this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      return true;
    } catch {
      return false;
    }
  }
}
