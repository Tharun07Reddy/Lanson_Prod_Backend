import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SessionService } from './session.service';
import { TokenService } from './token.service';

@Injectable()
export class SessionCleanupService {
  private readonly logger = new Logger(SessionCleanupService.name);

  constructor(
    private sessionService: SessionService,
    private tokenService: TokenService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredSessions() {
    try {
      this.logger.log('Starting cleanup of expired sessions');
      
      const sessionsCount = await this.sessionService.cleanupExpiredSessions();
      const tokensCount = await this.tokenService.cleanupExpiredRefreshTokens();
      
      this.logger.log(`Cleaned up ${sessionsCount} expired sessions and ${tokensCount} expired tokens`);
    } catch (error) {
      this.logger.error(`Error cleaning up expired sessions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
} 