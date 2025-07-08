import { Module, Global } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { SmsService } from "./sms.service";
import smsConfig from "../config/sms.config";

@Global()
@Module({
  imports: [ConfigModule.forFeature(smsConfig)],
  providers: [SmsService],
  exports: [SmsService],
})
export class SmsModule {} 