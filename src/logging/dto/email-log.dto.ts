import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsArray, IsString, IsObject, IsDateString } from 'class-validator';
import { MessageStatus } from '@prisma/client';

export class CreateEmailLogDto {
  @IsOptional()
  @IsString()
  messageId?: string;

  @IsNotEmpty()
  @IsEmail()
  from: string;

  @IsArray()
  @IsEmail({}, { each: true })
  to: string[];

  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  cc?: string[];

  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  bcc?: string[];

  @IsNotEmpty()
  @IsString()
  subject: string;

  @IsNotEmpty()
  @IsString()
  body: string;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsObject()
  templateData?: Record<string, unknown>;

  @IsEnum(MessageStatus)
  status: MessageStatus;

  @IsOptional()
  @IsString()
  statusDetails?: string;

  @IsNotEmpty()
  @IsString()
  provider: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsObject()
  attachments?: Record<string, unknown>[];

  @IsOptional()
  @IsString()
  ipAddress?: string;

  @IsOptional()
  @IsString()
  userAgent?: string;

  @IsOptional()
  @IsDateString()
  sentAt?: string;
}

export class UpdateEmailLogDto {
  @IsOptional()
  @IsString()
  messageId?: string;

  @IsOptional()
  @IsEnum(MessageStatus)
  status?: MessageStatus;

  @IsOptional()
  @IsString()
  statusDetails?: string;

  @IsOptional()
  retryCount?: number;

  @IsOptional()
  @IsString()
  errorMessage?: string;

  @IsOptional()
  @IsDateString()
  sentAt?: string;

  @IsOptional()
  @IsDateString()
  deliveredAt?: string;

  @IsOptional()
  @IsDateString()
  openedAt?: string;

  @IsOptional()
  @IsDateString()
  clickedAt?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
} 