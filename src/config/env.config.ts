import { Logger } from '@nestjs/common';

export function validateEnv(config: Record<string, any>): Record<string, any> {
  const logger = new Logger('Environment Validation');
  const requiredEnvVars = ['DATABASE_URL'];
  const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

  if (missingEnvVars.length > 0) {
    logger.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
    throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
  }

  // Validate DATABASE_URL format for MongoDB
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl?.startsWith('mongodb')) {
    logger.error('DATABASE_URL must be a valid MongoDB connection string');
    throw new Error('DATABASE_URL must be a valid MongoDB connection string');
  }

  // Validate Redis URL format if provided
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    // Check for Upstash Redis URL format (https://) or standard Redis format
    if (!redisUrl.startsWith('https://') && !redisUrl.startsWith('redis://') && !redisUrl.startsWith('rediss://')) {
      logger.warn('REDIS_URL should start with https:// (for Upstash) or redis:// (for standard Redis)');
    }
    
    // Validate Redis token for Upstash
    if (redisUrl.startsWith('https://') && !process.env.REDIS_TOKEN) {
      logger.warn('REDIS_TOKEN is required when using Upstash Redis');
    }
  }

  // Validate email configuration if provided
  const emailHost = process.env.EMAIL_HOST;
  if (emailHost) {
    const emailRequiredVars = [
      'EMAIL_PORT',
      'EMAIL_USER',
      'EMAIL_PASSWORD',
      'EMAIL_FROM_ADDRESS',
    ];
    
    const missingEmailVars = emailRequiredVars.filter(envVar => !process.env[envVar]);
    if (missingEmailVars.length > 0) {
      logger.warn(`Missing email configuration: ${missingEmailVars.join(', ')}. Email service might not work properly.`);
    }
    
    // Validate EMAIL_PORT is a number
    const emailPort = parseInt(process.env.EMAIL_PORT || '', 10);
    if (isNaN(emailPort)) {
      logger.warn('EMAIL_PORT must be a valid number');
    }
    
    // Validate EMAIL_FROM_ADDRESS format
    const emailFromAddress = process.env.EMAIL_FROM_ADDRESS;
    if (emailFromAddress && !emailFromAddress.includes('@')) {
      logger.warn('EMAIL_FROM_ADDRESS must be a valid email address');
    }
  }

  // Validate Twilio configuration if provided
  const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
  if (twilioAccountSid) {
    const twilioRequiredVars = [
      'TWILIO_AUTH_TOKEN',
      'TWILIO_PHONE_NUMBER',
    ];
    
    const missingTwilioVars = twilioRequiredVars.filter(envVar => !process.env[envVar]);
    if (missingTwilioVars.length > 0) {
      logger.warn(`Missing Twilio configuration: ${missingTwilioVars.join(', ')}. SMS service might not work properly.`);
    }
    
    // Validate TWILIO_ACCOUNT_SID format (starts with "AC")
    if (!twilioAccountSid.startsWith('AC')) {
      logger.warn('TWILIO_ACCOUNT_SID should start with \'AC\'');
    }
    
    // Validate TWILIO_PHONE_NUMBER format
    const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
    if (twilioPhoneNumber && !twilioPhoneNumber.startsWith('+')) {
      logger.warn('TWILIO_PHONE_NUMBER should be in E.164 format and start with \'+\'');
    }
  }

  return config;
}
