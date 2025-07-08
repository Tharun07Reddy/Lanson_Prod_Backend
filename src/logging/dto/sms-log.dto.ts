/* eslint-disable @typescript-eslint/no-unsafe-call */
import { IsEnum, IsNotEmpty, IsOptional, IsArray, IsString, IsObject, IsDateString, IsNumber } from 'class-validator';
import { MessageStatus } from '@prisma/client';

export class CreateSmsLogDto {
  @IsOptional()
  @IsString()
  messageId?: string;

  @IsNotEmpty()
  @IsString()
  from: string;

  @IsNotEmpty()
  @IsString()
  to: string;

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
  @IsString()
  countryCode?: string;

  @IsOptional()
  @IsNumber()
  segmentCount?: number;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsDateString()
  sentAt?: string;
}

export class UpdateSmsLogDto {
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
  @IsNumber()
  retryCount?: number;

  @IsOptional()
  @IsString()
  errorMessage?: string;

  @IsOptional()
  @IsNumber()
  segmentCount?: number;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsDateString()
  sentAt?: string;

  @IsOptional()
  @IsDateString()
  deliveredAt?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
} 