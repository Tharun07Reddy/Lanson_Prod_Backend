import { Module, NestModule, MiddlewareConsumer, RequestMethod, Logger } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { SessionService } from './session.service';
import { TokenService } from './token.service';
import { UserModule } from '../user/user.module';
import { DatabaseModule } from '../database/database.module';
import { SessionMiddleware } from './middleware/session.middleware';
import { SessionCleanupService } from './session-cleanup.service';
import { ScheduleModule } from '@nestjs/schedule';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './strategies/jwt.strategy';
import { SessionController } from './session.controller';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { AuthAnalyticsService } from './analytics/auth-analytics.service';
import { VerificationService } from './verification/verification.service';
import { VerificationController } from './verification/verification.controller';
import { MailModule } from '../mail/mail.module';
import { SmsModule } from '../sms/sms.module';
import { CacheConfigModule } from '../cache/cache.module';
import { RoleModule } from './role/role.module';

@Module({
  imports: [
    DatabaseModule,
    UserModule,
    RoleModule,
    ScheduleModule.forRoot(),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    MailModule,
    SmsModule,
    CacheConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        const logger = new Logger('JwtModule');
        logger.log(`JWT_SECRET exists: ${!!secret}`);
        logger.log(`JWT_EXPIRATION: ${configService.get<string>('JWT_EXPIRATION', '15m')}`);
        
        return {
          secret,
          signOptions: {
            expiresIn: configService.get<string>('JWT_EXPIRATION', '15m'),
            issuer: configService.get<string>('JWT_ISSUER', 'landson-api'),
            audience: configService.get<string>('JWT_AUDIENCE', 'landson-client'),
          },
        };
      },
    }),
  ],
  controllers: [AuthController, SessionController, VerificationController],
  providers: [
    AuthService,
    SessionService,
    TokenService,
    SessionCleanupService,
    JwtStrategy,
    AuthAnalyticsService,
    VerificationService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
  exports: [AuthService, SessionService, TokenService, AuthAnalyticsService, VerificationService],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(SessionMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
} 