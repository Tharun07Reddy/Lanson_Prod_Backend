import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { EmailLog, Prisma, SmsLog } from '@prisma/client';
import { EmailLogData, EmailLogUpdateData, SmsLogData, SmsLogUpdateData } from './interfaces';
import { tryCatchDb } from '../common/utils/try-catch.util';
import { maskSensitiveData, maskSensitiveObject } from '../common/utils/mask-sensitive-data.util';

/**
 * Service for logging email and SMS messages
 */
@Injectable()
export class LoggingService {
  private readonly logger = new Logger(LoggingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Log an email message
   * @param data Email log data
   * @returns Created email log
   */
  async logEmail(data: EmailLogData): Promise<EmailLog | null> {
    // Mask sensitive data in the email body and template data before logging
    const maskedData = this.maskEmailData(data);
    
    this.logger.debug(`Logging email to ${maskedData.to.join(', ')} with subject "${maskedData.subject}"`);
    
    try {
      const [emailLog, error] = await tryCatchDb(
        this.prisma.emailLog.create({
          data: {
            ...data, // Store original data in the database
            // Set default values if not provided
            cc: data.cc || [],
            bcc: data.bcc || [],
            tags: data.tags || [],
            retryCount: data.retryCount || 0,
          } as Prisma.EmailLogCreateInput,
        }),
        `Failed to log email to ${maskedData.to.join(', ')}`
      );

      if (error) {
        this.logger.error(`Error logging email: ${error.message}`, error.stack);
        return null;
      }

      return emailLog;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Unexpected error logging email: ${err.message}`, err.stack);
      return null;
    }
  }

  /**
   * Update an existing email log
   * @param id Email log ID
   * @param data Update data
   * @returns Updated email log
   */
  async updateEmailLog(id: string, data: EmailLogUpdateData): Promise<EmailLog | null> {
    this.logger.debug(`Updating email log ${id} with status ${data.status}`);
    
    try {
      const [emailLog, error] = await tryCatchDb(
        this.prisma.emailLog.update({
          where: { id },
          data: data as Prisma.EmailLogUpdateInput,
        }),
        `Failed to update email log ${id}`
      );

      if (error) {
        this.logger.error(`Error updating email log: ${error.message}`, error.stack);
        return null;
      }

      return emailLog;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Unexpected error updating email log: ${err.message}`, err.stack);
      return null;
    }
  }

  /**
   * Log an SMS message
   * @param data SMS log data
   * @returns Created SMS log
   */
  async logSms(data: SmsLogData): Promise<SmsLog | null> {
    // Mask sensitive data in the SMS body before logging
    const maskedData = this.maskSmsData(data);
    
    this.logger.debug(`Logging SMS to ${maskedData.to} with content length ${maskedData.body.length}`);
    
    try {
      const [smsLog, error] = await tryCatchDb(
        this.prisma.smsLog.create({
          data: {
            ...data, // Store original data in the database
            // Set default values if not provided
            tags: data.tags || [],
            retryCount: data.retryCount || 0,
          } as Prisma.SmsLogCreateInput,
        }),
        `Failed to log SMS to ${maskedData.to}`
      );

      if (error) {
        this.logger.error(`Error logging SMS: ${error.message}`, error.stack);
        return null;
      }

      return smsLog;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Unexpected error logging SMS: ${err.message}`, err.stack);
      return null;
    }
  }

  /**
   * Update an existing SMS log
   * @param id SMS log ID
   * @param data Update data
   * @returns Updated SMS log
   */
  async updateSmsLog(id: string, data: SmsLogUpdateData): Promise<SmsLog | null> {
    this.logger.debug(`Updating SMS log ${id} with status ${data.status}`);
    
    try {
      const [smsLog, error] = await tryCatchDb(
        this.prisma.smsLog.update({
          where: { id },
          data: data as Prisma.SmsLogUpdateInput,
        }),
        `Failed to update SMS log ${id}`
      );

      if (error) {
        this.logger.error(`Error updating SMS log: ${error.message}`, error.stack);
        return null;
      }

      return smsLog;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Unexpected error updating SMS log: ${err.message}`, err.stack);
      return null;
    }
  }

  /**
   * Find email logs by criteria
   * @param filters Filter criteria
   * @param page Page number
   * @param limit Items per page
   * @returns Email logs and count
   */
  async findEmailLogs(
    filters: Partial<EmailLogData> = {},
    page = 1,
    limit = 10
  ): Promise<{ logs: EmailLog[]; total: number }> {
    const skip = (page - 1) * limit;
    
    // Build where clause based on filters
    const where: Prisma.EmailLogWhereInput = {};
    
    if (filters.status) where.status = filters.status;
    if (filters.from) where.from = { contains: filters.from };
    if (filters.to?.length) where.to = { hasSome: filters.to };
    if (filters.subject) where.subject = { contains: filters.subject };
    if (filters.tags?.length) where.tags = { hasSome: filters.tags };
    
    try {
      const [result, error] = await tryCatchDb(
        this.prisma.$transaction([
          this.prisma.emailLog.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
          }),
          this.prisma.emailLog.count({ where }),
        ]),
        'Failed to fetch email logs'
      );

      if (error) {
        this.logger.error(`Error fetching email logs: ${error.message}`, error.stack);
        return { logs: [], total: 0 };
      }

      const [logs, total] = result as [EmailLog[], number];
      
      // Mask sensitive data in logs before returning
      const maskedLogs = logs.map(log => {
        return {
          ...log,
          body: maskSensitiveData(log.body),
          templateData: log.templateData && typeof log.templateData === 'object' 
            ? maskSensitiveObject(log.templateData as Record<string, any>) 
            : log.templateData,
        };
      });
      
      return { logs: maskedLogs as EmailLog[], total };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Unexpected error fetching email logs: ${err.message}`, err.stack);
      return { logs: [], total: 0 };
    }
  }

  /**
   * Find SMS logs by criteria
   * @param filters Filter criteria
   * @param page Page number
   * @param limit Items per page
   * @returns SMS logs and count
   */
  async findSmsLogs(
    filters: Partial<SmsLogData> = {},
    page = 1,
    limit = 10
  ): Promise<{ logs: SmsLog[]; total: number }> {
    const skip = (page - 1) * limit;
    
    // Build where clause based on filters
    const where: Prisma.SmsLogWhereInput = {};
    
    if (filters.status) where.status = filters.status;
    if (filters.from) where.from = { contains: filters.from };
    if (filters.to) where.to = { contains: filters.to };
    if (filters.tags?.length) where.tags = { hasSome: filters.tags };
    
    try {
      const [result, error] = await tryCatchDb(
        this.prisma.$transaction([
          this.prisma.smsLog.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
          }),
          this.prisma.smsLog.count({ where }),
        ]),
        'Failed to fetch SMS logs'
      );

      if (error) {
        this.logger.error(`Error fetching SMS logs: ${error.message}`, error.stack);
        return { logs: [], total: 0 };
      }

      const [logs, total] = result as [SmsLog[], number];
      
      // Mask sensitive data in logs before returning
      const maskedLogs = logs.map(log => {
        return {
          ...log,
          body: maskSensitiveData(log.body),
          templateData: log.templateData && typeof log.templateData === 'object' 
            ? maskSensitiveObject(log.templateData as Record<string, any>) 
            : log.templateData,
        };
      });
      
      return { logs: maskedLogs as SmsLog[], total };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Unexpected error fetching SMS logs: ${err.message}`, err.stack);
      return { logs: [], total: 0 };
    }
  }

  /**
   * Get email delivery statistics
   * @param startDate Start date for statistics
   * @param endDate End date for statistics
   * @returns Email delivery statistics
   */
  async getEmailStats(
    startDate?: Date,
    endDate?: Date
  ): Promise<Record<string, number>> {
    const dateFilter = this.getDateFilter(startDate, endDate);
    
    try {
      const [stats, error] = await tryCatchDb(
        this.prisma.$transaction([
          this.prisma.emailLog.count({ where: { ...dateFilter, status: 'SENT' } }),
          this.prisma.emailLog.count({ where: { ...dateFilter, status: 'DELIVERED' } }),
          this.prisma.emailLog.count({ where: { ...dateFilter, status: 'FAILED' } }),
          this.prisma.emailLog.count({ where: { ...dateFilter, status: 'BOUNCED' } }),
          this.prisma.emailLog.count({ where: { ...dateFilter, status: 'REJECTED' } }),
          this.prisma.emailLog.count({ where: { ...dateFilter, status: 'OPENED' } }),
          this.prisma.emailLog.count({ where: { ...dateFilter, status: 'CLICKED' } }),
          this.prisma.emailLog.count({ where: dateFilter }),
        ]),
        'Failed to fetch email statistics'
      );

      if (error) {
        this.logger.error(`Error fetching email statistics: ${error.message}`, error.stack);
        return { total: 0 };
      }

      const [sent, delivered, failed, bounced, rejected, opened, clicked, total] = stats as number[];
      
      return {
        sent,
        delivered,
        failed,
        bounced,
        rejected,
        opened,
        clicked,
        total,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Unexpected error fetching email statistics: ${err.message}`, err.stack);
      return { total: 0 };
    }
  }

  /**
   * Get SMS delivery statistics
   * @param startDate Start date for statistics
   * @param endDate End date for statistics
   * @returns SMS delivery statistics
   */
  async getSmsStats(
    startDate?: Date,
    endDate?: Date
  ): Promise<Record<string, number>> {
    const dateFilter = this.getSmsDateFilter(startDate, endDate);
    
    try {
      const [stats, error] = await tryCatchDb(
        this.prisma.$transaction([
          this.prisma.smsLog.count({ where: { ...dateFilter, status: 'SENT' } }),
          this.prisma.smsLog.count({ where: { ...dateFilter, status: 'DELIVERED' } }),
          this.prisma.smsLog.count({ where: { ...dateFilter, status: 'FAILED' } }),
          this.prisma.smsLog.count({ where: dateFilter }),
        ]),
        'Failed to fetch SMS statistics'
      );

      if (error) {
        this.logger.error(`Error fetching SMS statistics: ${error.message}`, error.stack);
        return { total: 0 };
      }

      const [sent, delivered, failed, total] = stats as number[];
      
      return {
        sent,
        delivered,
        failed,
        total,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Unexpected error fetching SMS statistics: ${err.message}`, err.stack);
      return { total: 0 };
    }
  }

  /**
   * Helper method to create date filter for email queries
   */
  private getDateFilter(startDate?: Date, endDate?: Date): Prisma.EmailLogWhereInput {
    if (!startDate && !endDate) return {};
    
    const filter: Prisma.EmailLogWhereInput = {};
    
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.gte = startDate;
      if (endDate) filter.createdAt.lte = endDate;
    }
    
    return filter;
  }

  /**
   * Helper method to create date filter for SMS queries
   */
  private getSmsDateFilter(startDate?: Date, endDate?: Date): Prisma.SmsLogWhereInput {
    if (!startDate && !endDate) return {};
    
    const filter: Prisma.SmsLogWhereInput = {};
    
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.gte = startDate;
      if (endDate) filter.createdAt.lte = endDate;
    }
    
    return filter;
  }
  
  /**
   * Mask sensitive data in email data for logging
   */
  private maskEmailData(data: EmailLogData): EmailLogData {
    return {
      ...data,
      body: maskSensitiveData(data.body),
      templateData: data.templateData && typeof data.templateData === 'object'
        ? maskSensitiveObject(data.templateData as Record<string, any>)
        : data.templateData,
    };
  }
  
  /**
   * Mask sensitive data in SMS data for logging
   */
  private maskSmsData(data: SmsLogData): SmsLogData {
    return {
      ...data,
      body: maskSensitiveData(data.body),
      templateData: data.templateData && typeof data.templateData === 'object'
        ? maskSensitiveObject(data.templateData as Record<string, any>)
        : data.templateData,
    };
  }
} 