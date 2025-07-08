import { registerAs } from "@nestjs/config";
import { MailerOptions } from "@nestjs-modules/mailer";
import { HandlebarsAdapter } from "@nestjs-modules/mailer/dist/adapters/handlebars.adapter";
import { join } from "path";
import { Logger } from "@nestjs/common";

const logger = new Logger("MailConfig");

export default registerAs("mail", (): MailerOptions => {
  // Validate required email configuration
  const requiredEnvVars = [
    "EMAIL_HOST",
    "EMAIL_PORT",
    "EMAIL_USER",
    "EMAIL_PASSWORD",
    "EMAIL_FROM_ADDRESS",
  ];
  
  const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
  if (missingEnvVars.length > 0) {
    logger.warn(`Missing email configuration: ${missingEnvVars.join(", ")}. Email service will not work properly.`);
  }

  // Parse boolean values
  const secure = process.env.EMAIL_SECURE === "true";
  const requireTLS = process.env.EMAIL_REQUIRE_TLS === "true";
  
  return {
    transport: {
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || "587", 10),
      secure, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
      // TLS settings
      requireTLS,
      // Connection pool settings
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      // Retry settings
      tls: {
        // Do not fail on invalid certificates
        rejectUnauthorized: process.env.NODE_ENV === "production",
      },
      // Debug settings
      debug: process.env.NODE_ENV !== "production",
    },
    defaults: {
      from: `"${process.env.EMAIL_FROM_NAME || "Notification"}" <${process.env.EMAIL_FROM_ADDRESS}>`,
    },
    // Template settings
    template: {
      dir: join(process.cwd(), "src/mail/templates"),
      adapter: new HandlebarsAdapter(),
      options: {
        strict: true,
      },
    },
    // Preview settings (for development)
    preview: process.env.NODE_ENV !== "production",
  };
}); 