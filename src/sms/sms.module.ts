import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { SmsService } from "./sms.service";
import { LoggingModule } from "../logging/logging.module";
import smsConfig from "../config/sms.config";

@Module({
  imports: [
    ConfigModule.forFeature(smsConfig),
    LoggingModule,
  ],
  providers: [SmsService],
  exports: [SmsService],
})
export class SmsModule {} 