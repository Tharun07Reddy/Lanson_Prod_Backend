import { MessageStatus, Prisma } from '@prisma/client';

/**
 * Interface for SMS log data
 */
export interface SmsLogData {
  messageId?: string;
  from: string;
  to: string;
  body: string;
  templateId?: string;
  templateData?: Prisma.InputJsonValue;
  status: MessageStatus;
  statusDetails?: string;
  provider: string;
  metadata?: Prisma.InputJsonValue;
  tags?: string[];
  countryCode?: string;
  retryCount?: number;
  errorMessage?: string;
  segmentCount?: number;
  price?: number;
  sentAt?: Date;
  deliveredAt?: Date;
}

/**
 * Interface for SMS log update data
 */
export interface SmsLogUpdateData {
  messageId?: string;
  status?: MessageStatus;
  statusDetails?: string;
  retryCount?: number;
  errorMessage?: string;
  sentAt?: Date;
  deliveredAt?: Date;
  segmentCount?: number;
  price?: number;
  metadata?: Prisma.InputJsonValue;
} 