import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { HealthService } from "./health.service";
import { HealthController } from "./health.controller";

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {} 