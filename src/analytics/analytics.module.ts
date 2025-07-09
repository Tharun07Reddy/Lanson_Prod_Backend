import { Module, MiddlewareConsumer, RequestMethod, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { CacheConfigModule } from '../cache/cache.module';
import { AnalyticsService } from './services/analytics.service';
import { EventTrackingService } from './services/event-tracking.service';
import { UserAnalyticsService } from './services/user-analytics.service';
import { PerformanceAnalyticsService } from './services/performance-analytics.service';
import { AnalyticsController } from './controllers/analytics.controller';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AnalyticsInterceptor } from './middleware/analytics.interceptor';
import { AnalyticsMiddleware } from './middleware/analytics.middleware';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    CacheConfigModule,
  ],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    EventTrackingService,
    UserAnalyticsService,
    PerformanceAnalyticsService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AnalyticsInterceptor,
    },
  ],
  exports: [
    AnalyticsService,
    EventTrackingService,
    UserAnalyticsService,
    PerformanceAnalyticsService,
  ],
})
export class AnalyticsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AnalyticsMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
} 