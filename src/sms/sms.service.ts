import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as twilio from "twilio";
import { SmsConfig } from "../config/sms.config";
import { MessageInstance } from "twilio/lib/rest/api/v2010/account/message";

export interface SmsOptions {
  to: string;
  body: string;
  from?: string;
  validityPeriod?: number;
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly client: twilio.Twilio | null = null;
  private readonly config: SmsConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = this.configService.get<SmsConfig>("sms") as SmsConfig;
    
    if (this.config.enabled) {
      try {
        this.client = twilio(this.config.accountSid, this.config.authToken);
        this.logger.log("Twilio client initialized successfully");
      } catch (error: unknown) {
        const err = error as Error;
        this.logger.error(`Failed to initialize Twilio client: ${err.message}`, err.stack);
      }
    } else {
      this.logger.warn("SMS service is disabled due to missing configuration");
    }
  }

  /**
   * Send an SMS with retry mechanism
   * @param options SMS options
   * @returns Promise<boolean> Success status
   */
  async sendSms(options: SmsOptions): Promise<boolean> {
    if (!this.client || !this.config.enabled) {
      this.logger.warn("SMS service is not available");
      return false;
    }

    return this.sendWithRetry(options);
  }

  /**
   * Send a verification code SMS
   * @param to Recipient phone number
   * @param code Verification code
   * @returns Promise<boolean> Success status
   */
  async sendVerificationCode(to: string, code: string): Promise<boolean> {
    return this.sendSms({
      to,
      body: `Your verification code is: ${code}. It will expire in 10 minutes.`,
    });
  }

  /**
   * Private method to send SMS with retry mechanism
   */
  private async sendWithRetry(
    options: SmsOptions,
    retryCount = 0,
  ): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      // Format phone number if needed
      const to = this.formatPhoneNumber(options.to);
      
      // Send SMS
      const message = await this.client.messages.create({
        to,
        body: options.body,
        from: options.from || this.config.phoneNumber,
        validityPeriod: options.validityPeriod || this.config.messageValidityPeriod,
      });

      if (this.config.loggingEnabled) {
        this.logger.log(`SMS sent to ${to} with SID: ${message.sid}`);
      }

      return this.isMessageSuccess(message);
    } catch (error: unknown) {
      const err = error as Error;
      if (retryCount < this.config.retryAttempts) {
        this.logger.warn(`Failed to send SMS, retrying (${retryCount + 1}/${this.config.retryAttempts})...`);
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
        return this.sendWithRetry(options, retryCount + 1);
      }

      this.logger.error(`Failed to send SMS after ${this.config.retryAttempts} attempts: ${err.message}`, err.stack);
      return false;
    }
  }

  /**
   * Check if the message was sent successfully
   */
  private isMessageSuccess(message: MessageInstance): boolean {
    // Message is successful if status is not 'failed' or 'undelivered'
    return message.status !== "failed" && message.status !== "undelivered";
  }

  /**
   * Format phone number to E.164 format
   */
  private formatPhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters
    let digits = phoneNumber.replace(/\D/g, "");
    
    // If the number doesn't start with +, add the + sign
    if (!phoneNumber.startsWith("+")) {
      // If the number doesn't start with country code (assuming US/Canada as default)
      if (!digits.startsWith("91")) {
        digits = "91" + digits;
      }
      return "+" + digits;
    }
    
    return phoneNumber;
  }
} 