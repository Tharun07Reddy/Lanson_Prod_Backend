import { MessageStatus, Prisma } from '@prisma/client';

/**
 * Interface for email log data
 */
export interface EmailLogData {
  messageId?: string;
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  templateId?: string;
  templateData?: Prisma.InputJsonValue;
  status: MessageStatus;
  statusDetails?: string;
  provider: string;
  metadata?: Prisma.InputJsonValue;
  tags?: string[];
  attachments?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
  retryCount?: number;
  errorMessage?: string;
  sentAt?: Date;
  deliveredAt?: Date;
  openedAt?: Date;
  clickedAt?: Date;
}

/**
 * Interface for email log update data
 */
export interface EmailLogUpdateData {
  messageId?: string;
  status?: MessageStatus;
  statusDetails?: string;
  retryCount?: number;
  errorMessage?: string;
  sentAt?: Date;
  deliveredAt?: Date;
  openedAt?: Date;
  clickedAt?: Date;
  metadata?: Prisma.InputJsonValue;
} 