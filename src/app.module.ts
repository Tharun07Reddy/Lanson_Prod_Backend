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
import { LoggingModule } from './logging/logging.module';
import { validateEnv } from './config/env.config';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import authConfig from './config/auth.config';

@Module({
  imports: [
    // Load environment variables
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
      envFilePath: ['.env', '.env.local'],
      load: [authConfig],
    }),
    // Common module with error handling and logging
    CommonModule,
    // Core modules
    DatabaseModule,
    CacheConfigModule,
    // Logging module for email and SMS logs
    LoggingModule,
    // Service modules that depend on logging
    MailModule,
    SmsModule,
    // Auth and User modules
    UserModule,
    AuthModule,
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