import { Injectable, Logger } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Injectable()
export class EventTrackingService {
  private readonly logger = new Logger(EventTrackingService.name);

  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * Track user authentication events
   */
  async trackAuthEvent(eventType: string, userId?: string, metadata?: Record<string, any>, request?: any): Promise<void> {
    try {
      await this.analyticsService.trackEvent({
        eventType: `auth:${eventType}`,
        userId,
        sessionId: request?.sessionID,
        metadata,
        source: 'auth',
        ip: request?.ip,
        userAgent: request?.headers?.['user-agent'],
      });
    } catch (error) {
      this.logger.error(`Failed to track auth event: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Track API requests
   */
  async trackApiRequest(
    method: string,
    path: string,
    statusCode: number,
    responseTime: number,
    userId?: string,
    sessionId?: string,
    request?: any,
  ): Promise<void> {
    try {
      await this.analyticsService.trackEvent({
        eventType: 'api:request',
        userId,
        sessionId,
        metadata: {
          method,
          path,
          statusCode,
          responseTime,
          contentType: request?.headers?.['content-type'],
        },
        source: 'api',
        ip: request?.ip,
        userAgent: request?.headers?.['user-agent'],
      });
    } catch (error) {
      this.logger.error(`Failed to track API request: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Track feature usage
   */
  async trackFeatureUsage(
    featureName: string,
    userId?: string,
    sessionId?: string,
    metadata?: Record<string, any>,
    request?: any,
  ): Promise<void> {
    try {
      await this.analyticsService.trackEvent({
        eventType: `feature:${featureName}`,
        userId,
        sessionId,
        metadata,
        source: 'feature',
        ip: request?.ip,
        userAgent: request?.headers?.['user-agent'],
      });
    } catch (error) {
      this.logger.error(`Failed to track feature usage: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Track error occurrences
   */
  async trackError(
    errorType: string,
    errorMessage: string,
    userId?: string,
    sessionId?: string,
    metadata?: Record<string, any>,
    request?: any,
  ): Promise<void> {
    try {
      await this.analyticsService.trackEvent({
        eventType: `error:${errorType}`,
        userId,
        sessionId,
        metadata: {
          ...metadata,
          errorMessage,
          path: request?.path,
          method: request?.method,
        },
        source: 'error',
        ip: request?.ip,
        userAgent: request?.headers?.['user-agent'],
      });
    } catch (error) {
      this.logger.error(`Failed to track error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Track business events
   */
  async trackBusinessEvent(
    eventType: string,
    userId?: string,
    sessionId?: string,
    metadata?: Record<string, any>,
    request?: any,
  ): Promise<void> {
    try {
      await this.analyticsService.trackEvent({
        eventType: `business:${eventType}`,
        userId,
        sessionId,
        metadata,
        source: 'business',
        ip: request?.ip,
        userAgent: request?.headers?.['user-agent'],
      });
    } catch (error) {
      this.logger.error(`Failed to track business event: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
} 