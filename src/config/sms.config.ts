import { registerAs } from "@nestjs/config";
import { Logger } from "@nestjs/common";

const logger = new Logger("SmsConfig");

export interface SmsConfig {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
  enabled: boolean;
  retryAttempts: number;
  retryDelay: number;
  loggingEnabled: boolean;
  messageValidityPeriod: number;
}

export default registerAs("sms", (): SmsConfig => {
  // Validate required SMS configuration
  const requiredEnvVars = [
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_PHONE_NUMBER",
  ];
  
  const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
  if (missingEnvVars.length > 0) {
    logger.warn(`Missing SMS configuration: ${missingEnvVars.join(", ")}. SMS service will not work properly.`);
  }

  // Check if all required variables are present
  const enabled = requiredEnvVars.every(envVar => !!process.env[envVar]);
  if (!enabled) {
    logger.warn("SMS service is disabled due to missing configuration.");
  } else {
    logger.log("SMS service is enabled.");
  }

  return {
    accountSid: process.env.TWILIO_ACCOUNT_SID || "",
    authToken: process.env.TWILIO_AUTH_TOKEN || "",
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || "",
    enabled,
    retryAttempts: parseInt(process.env.SMS_RETRY_ATTEMPTS || "3", 10),
    retryDelay: parseInt(process.env.SMS_RETRY_DELAY || "1000", 10), // 1 second
    loggingEnabled: process.env.NODE_ENV !== "production",
    messageValidityPeriod: parseInt(process.env.SMS_VALIDITY_PERIOD || "14400", 10), // 4 hours in seconds
  };
}); 