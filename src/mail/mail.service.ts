/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger } from "@nestjs/common";
import { MailerService } from "@nestjs-modules/mailer";
import { ConfigService } from "@nestjs/config";
import * as fs from "fs";
import * as path from "path";
import { LoggingService } from "../logging/logging.service";
import { MessageStatus } from "@prisma/client";
import { maskSensitiveData, maskSensitiveObject } from "../common/utils/mask-sensitive-data.util";

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000; // 1 second
  private readonly fromEmail: string;

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
    private readonly loggingService: LoggingService,
  ) {
    this.fromEmail = this.configService.get<string>("mail.defaults.from") || 'noreply@example.com';
  }

  /**
   * Send an email with retry mechanism
   * @param to Recipient email address
   * @param subject Email subject
   * @param template Template name (without extension)
   * @param context Template context data
   * @param attachments Email attachments
   * @returns Promise<boolean> Success status
   */
  async sendMail(
    to: string | string[],
    subject: string,
    template: string,
    context: Record<string, any> = {},
    attachments: Array<{
      filename: string;
      content?: any;
      path?: string;
      contentType?: string;
    }> = [],
  ): Promise<boolean> {
    // Create email log entry
    const toArray = Array.isArray(to) ? to : [to];
    
    // Log with masked context for security
    const maskedContext = maskSensitiveObject(context);
    this.logger.log(`Sending email to ${toArray.join(', ')} using template ${template} with context: ${JSON.stringify(maskedContext)}`);
    
    const emailLogId = await this.createEmailLog({
      from: this.fromEmail,
      to: toArray,
      subject,
      body: `Template: ${template}`,
      templateId: template,
      templateData: context,
      status: MessageStatus.PENDING,
      provider: 'nodemailer',
      attachments: attachments.length > 0 ? attachments : undefined,
    });
    
    const success = await this.sendWithRetry(to, subject, template, context, attachments);
    
    // Update log with result
    if (emailLogId) {
      await this.updateEmailLog(emailLogId, {
        status: success ? MessageStatus.SENT : MessageStatus.FAILED,
        sentAt: success ? new Date() : undefined,
        errorMessage: success ? undefined : 'Failed to send email after retries',
      });
    }
    
    return success;
  }

  /**
   * Send a transactional email
   * @param to Recipient email address
   * @param subject Email subject
   * @param text Plain text content
   * @param html HTML content
   * @returns Promise<boolean> Success status
   */
  async sendTransactionalMail(
    to: string | string[],
    subject: string,
    text: string,
    html?: string,
  ): Promise<boolean> {
    const toArray = Array.isArray(to) ? to : [to];
    
    // Log with masked content for security
    const maskedText = maskSensitiveData(text);
    this.logger.log(`Sending transactional email to ${toArray.join(', ')} with subject: ${subject}`);
    this.logger.debug(`Email content (masked): ${maskedText}`);
    
    // Create email log entry
    const emailLogId = await this.createEmailLog({
      from: this.fromEmail,
      to: toArray,
      subject,
      body: html || text,
      status: MessageStatus.PENDING,
      provider: 'nodemailer',
    });
    
    try {
      await this.mailerService.sendMail({
        to,
        subject,
        text,
        html: html || text,
        from: this.fromEmail,
      });
      
      this.logger.log(`Transactional email sent to ${Array.isArray(to) ? to.join(", ") : to}`);
      
      // Update log with success
      if (emailLogId) {
        await this.updateEmailLog(emailLogId, {
          status: MessageStatus.SENT,
          sentAt: new Date(),
        });
      }
      
      return true;
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`Failed to send transactional email: ${err.message}`, err.stack);
      
      // Update log with failure
      if (emailLogId) {
        await this.updateEmailLog(emailLogId, {
          status: MessageStatus.FAILED,
          errorMessage: err.message,
        });
      }
      
      return false;
    }
  }

  /**
   * Private method to send email with retry mechanism
   */
  private async sendWithRetry(
    to: string | string[],
    subject: string,
    template: string,
    context: Record<string, any> = {},
    attachments: Array<{
      filename: string;
      content?: any;
      path?: string;
      contentType?: string;
    }> = [],
    retryCount = 0,
  ): Promise<boolean> {
    try {
      // Validate template existence
      const templateExists = this.validateTemplate(template);
      if (!templateExists) {
        this.logger.error(`Template ${template} does not exist`);
        return false;
      }

      // Send email
      await this.mailerService.sendMail({
        to,
        subject,
        template,
        context,
        attachments,
        from: this.fromEmail,
      });

      this.logger.log(`Email sent to ${Array.isArray(to) ? to.join(", ") : to} using template ${template}`);
      return true;
    } catch (error: unknown) {
      const err = error as Error;
      if (retryCount < this.maxRetries) {
        this.logger.warn(`Failed to send email, retrying (${retryCount + 1}/${this.maxRetries})...`);
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        return this.sendWithRetry(to, subject, template, context, attachments, retryCount + 1);
      }

      this.logger.error(`Failed to send email after ${this.maxRetries} attempts: ${err.message}`, err.stack);
      return false;
    }
  }

  /**
   * Validate that a template exists
   */
  private validateTemplate(templateName: string): boolean {
    try {
      const templatesDir = path.join(process.cwd(), "src/mail/templates");
      const templatePath = path.join(templatesDir, `${templateName}.hbs`);
      return fs.existsSync(templatePath);
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`Error validating template: ${err.message}`, err.stack);
      return false;
    }
  }
  
  /**
   * Create an email log entry
   */
  private async createEmailLog(data: {
    from: string;
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    body: string;
    templateId?: string;
    templateData?: Record<string, any>;
    status: MessageStatus;
    provider: string;
    attachments?: Array<any>;
  }): Promise<string | null> {
    try {
      const emailLog = await this.loggingService.logEmail({
        ...data,
        metadata: {
          ipAddress: '127.0.0.1', // In a real app, get this from the request
          userAgent: 'Server',
        },
        tags: ['system'],
      });
      
      return emailLog?.id || null;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to create email log: ${err.message}`, err.stack);
      return null;
    }
  }
  
  /**
   * Update an email log entry
   */
  private async updateEmailLog(
    id: string,
    data: {
      status?: MessageStatus;
      sentAt?: Date;
      deliveredAt?: Date;
      openedAt?: Date;
      clickedAt?: Date;
      errorMessage?: string;
    },
  ): Promise<void> {
    try {
      await this.loggingService.updateEmailLog(id, data);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to update email log: ${err.message}`, err.stack);
    }
  }
} 