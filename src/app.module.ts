import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommonModule } from './common';
import { RequestIdMiddleware } from './common/middleware';
import { DatabaseModule } from './database/database.module';
import { CacheConfigModule } from './cache/cache.module';
import { MailModule } from './mail/mail.module';
import { SmsModule } from './sms/sms.module';
import { HealthModule } from './health/health.module';
import { validateEnv } from './config/env.config';

@Module({
  imports: [
    // Load environment variables
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
      envFilePath: ['.env', '.env.local'],
    }),
    // Common module with error handling and logging
    CommonModule,
    // Core modules
    DatabaseModule,
    CacheConfigModule,
    MailModule,
    SmsModule,
    // Health check module
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
  // Configure middleware
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequestIdMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}