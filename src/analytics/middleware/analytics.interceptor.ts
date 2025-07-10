/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, finalize } from 'rxjs/operators';
import { EventTrackingService } from '../services/event-tracking.service';
import { PerformanceAnalyticsService } from '../services/performance-analytics.service';
import { Request, Response } from 'express';

// Define the request with user interface
interface RequestWithUser extends Request {
  user?: {
    id?: string;
    sub?: string;
    email?: string;
    [key: string]: any;
    requestId?: string;
    sessionId?: string;
    ip?: string;
    userAgent?: string;
    referer?: string;
    origin?: string;
    host?: string;
    connection?: string;
    'content-type'?: string;
  };
}

@Injectable()
export class AnalyticsInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AnalyticsInterceptor.name);

  constructor(
    private readonly eventTrackingService: EventTrackingService,
    private readonly performanceAnalyticsService: PerformanceAnalyticsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // Skip analytics for OPTIONS requests
    if (context.getType() === 'http') {
      const request = context.switchToHttp().getRequest<RequestWithUser>();
      if (request.method === 'OPTIONS') {
        return next.handle();
      }
    }

    const now = Date.now();
    const requestId = this.generateRequestId();
    
    if (context.getType() === 'http') {
      const request = context.switchToHttp().getRequest<RequestWithUser>();
      const { method, path, url, headers } = request;
      
      // Add request ID to request object for tracking
      request['requestId'] = requestId;
      
      // Extract user info if available
      const userId = request.user?.id || request.user?.sub;
        const sessionId = request.cookies?.sessionId || headers['session-id'];
      
      // Log request start
      this.logger.debug(`[${requestId}] ${method} ${url} - Started`);
      
      return next.handle().pipe(
        tap((data) => {
          // Log successful response
          const response = context.switchToHttp().getResponse<Response>();
          const statusCode = response.statusCode;
          const responseTime = Date.now() - now;
          
          this.logger.debug(`[${requestId}] ${method} ${url} - ${statusCode} - ${responseTime}ms`);
          
          // Track API request
          this.trackRequest(method, path, statusCode, responseTime, userId, sessionId, request);
          
          // Track performance metrics
          this.trackPerformance(path, method, responseTime, statusCode);
          
          // Track specific events based on path and method
          this.trackSpecificEvents(path, method, statusCode, userId, data);
        }),
        finalize(() => {
          const responseTime = Date.now() - now;
          this.logger.debug(`[${requestId}] Request completed in ${responseTime}ms`);
        })
      );
    }
    
    // For non-HTTP contexts, just pass through
    return next.handle();
  }

  /**
   * Track API request
   */
  private trackRequest(
    method: string,
    path: string,
    statusCode: number,
    responseTime: number,
    userId?: string,
    sessionId?: string,
    request?: any,
  ): void {
    try {
      this.eventTrackingService.trackApiRequest(
        method,
        path,
        statusCode,
        responseTime,
        userId,
        sessionId,
        request,
      ).catch(error => {
        this.logger.error(`Failed to track API request: ${error instanceof Error ? error.message : 'Unknown error'}`);
      });
    } catch (error) {
      this.logger.error(`Error in trackRequest: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Track performance metrics
   */
  private trackPerformance(
    path: string,
    method: string,
    responseTime: number,
    statusCode: number,
  ): void {
    try {
      this.performanceAnalyticsService.trackResponseTime(
        path,
        method,
        responseTime,
        statusCode,
      ).catch(error => {
        this.logger.error(`Failed to track performance: ${error instanceof Error ? error.message : 'Unknown error'}`);
      });
    } catch (error) {
      this.logger.error(`Error in trackPerformance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Track specific events based on path and method
   */
  private trackSpecificEvents(
    path: string,
    method: string,
    statusCode: number,
    userId?: string,
    data?: any,
  ): void {
    try {
      // Skip if not successful
      if (statusCode >= 400) {
        return;
      }

      // Track authentication events
      if (path.includes('/auth/login') && method === 'POST') {
        this.eventTrackingService.trackAuthEvent('login', userId, { success: true }).catch(error => {
          this.logger.error(`Failed to track auth event: ${error instanceof Error ? error.message : 'Unknown error'}`);
        });
      } else if (path.includes('/auth/register') && method === 'POST') {
        this.eventTrackingService.trackAuthEvent('register', userId, { success: true }).catch(error => {
          this.logger.error(`Failed to track auth event: ${error instanceof Error ? error.message : 'Unknown error'}`);
        });
      } else if (path.includes('/auth/logout') && method === 'POST') {
        this.eventTrackingService.trackAuthEvent('logout', userId, { success: true }).catch(error => {
          this.logger.error(`Failed to track auth event: ${error instanceof Error ? error.message : 'Unknown error'}`);
        });
      }

      // Track feature usage events
      // Add more specific feature tracking here
    } catch (error) {
      this.logger.error(`Error in trackSpecificEvents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a unique request ID
   */
  private generateRequestId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
} 