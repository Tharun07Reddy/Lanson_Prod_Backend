import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as twilio from "twilio";
import { SmsConfig } from "../config/sms.config";
import { MessageInstance } from "twilio/lib/rest/api/v2010/account/message";
import { LoggingService } from "../logging/logging.service";
import { MessageStatus } from "@prisma/client";
import { maskSensitiveData } from "../common/utils/mask-sensitive-data.util";

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
  private readonly enabled: boolean = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly loggingService: LoggingService,
  ) {
    // Get SMS config with fallback to default values
    this.config = this.configService.get<SmsConfig>("sms") || {
      accountSid: '',
      authToken: '',
      phoneNumber: '',
      enabled: false,
      retryAttempts: 3,
      retryDelay: 1000,
      loggingEnabled: false,
      messageValidityPeriod: 14400
    };
    
    this.enabled = !!this.config?.enabled;
    
    if (this.enabled) {
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
    if (!this.client || !this.enabled) {
      this.logger.warn("SMS service is not available");
      return false;
    }
    
    // Format phone number
    const to = this.formatPhoneNumber(options.to);
    const from = options.from || this.config.phoneNumber;
    
    // Log with masked content for security
    const maskedBody = maskSensitiveData(options.body);
    this.logger.log(`Sending SMS to ${to} with content: ${maskedBody}`);
    
    // Create SMS log entry
    const smsLogId = await this.createSmsLog({
      from,
      to,
      body: options.body,
      status: MessageStatus.PENDING,
      provider: 'twilio',
      countryCode: to.substring(0, 3), // Extract country code from formatted number
    });
    
    const success = await this.sendWithRetry(options);
    
    // Update log with result
    if (smsLogId) {
      await this.updateSmsLog(smsLogId, {
        status: success ? MessageStatus.SENT : MessageStatus.FAILED,
        sentAt: success ? new Date() : undefined,
        errorMessage: success ? undefined : 'Failed to send SMS after retries',
      });
    }
    
    return success;
  }

  /**
   * Send a verification code SMS
   * @param to Recipient phone number
   * @param code Verification code
   * @returns Promise<boolean> Success status
   */
  async sendVerificationCode(to: string, code: string): Promise<boolean> {
    // Mask the verification code in logs
    const maskedCode = '*'.repeat(code.length);
    this.logger.log(`Sending verification code to ${to} (code masked: ${maskedCode})`);
    
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
        // Log with masked content
        const maskedBody = maskSensitiveData(options.body);
        this.logger.log(`SMS sent to ${to} with SID: ${message.sid} and content: ${maskedBody}`);
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
  
  /**
   * Create an SMS log entry
   */
  private async createSmsLog(data: {
    from: string;
    to: string;
    body: string;
    templateId?: string;
    templateData?: Record<string, any>;
    status: MessageStatus;
    provider: string;
    countryCode?: string;
  }): Promise<string | null> {
    try {
      const smsLog = await this.loggingService.logSms({
        ...data,
        metadata: {
          source: 'api',
        },
        tags: ['system'],
      });
      
      return smsLog?.id || null;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to create SMS log: ${err.message}`, err.stack);
      return null;
    }
  }
  
  /**
   * Update an SMS log entry
   */
  private async updateSmsLog(
    id: string,
    data: {
      status?: MessageStatus;
      sentAt?: Date;
      deliveredAt?: Date;
      errorMessage?: string;
      segmentCount?: number;
      price?: number;
    },
  ): Promise<void> {
    try {
      await this.loggingService.updateSmsLog(id, data);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to update SMS log: ${err.message}`, err.stack);
    }
  }
} 