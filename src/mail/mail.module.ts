import { Module, Global } from "@nestjs/common";
import { MailerModule, MailerOptions } from "@nestjs-modules/mailer";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MailService } from "./mail.service";
import mailConfig from "../config/mail.config";

@Global()
@Module({
  imports: [
    ConfigModule.forFeature(mailConfig),
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService): MailerOptions => {
        const config = configService.get<MailerOptions>("mail");
        if (!config) {
          throw new Error("Mail configuration not found");
        }
        return config;
      },
    }),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {} 