import { Injectable, Logger } from "@nestjs/common";
import { MailerService } from "@nestjs-modules/mailer";
import { ConfigService } from "@nestjs/config";
import * as fs from "fs";
import * as path from "path";

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000; // 1 second

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}

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
    return this.sendWithRetry(to, subject, template, context, attachments);
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
    try {
      const fromEmail = this.configService.get<string>("mail.defaults.from");
      
      await this.mailerService.sendMail({
        to,
        subject,
        text,
        html: html || text,
        from: fromEmail,
      });
      
      this.logger.log(`Transactional email sent to ${Array.isArray(to) ? to.join(", ") : to}`);
      return true;
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`Failed to send transactional email: ${err.message}`, err.stack);
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
} 