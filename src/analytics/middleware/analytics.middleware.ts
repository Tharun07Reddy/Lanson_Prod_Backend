import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { UserAnalyticsService } from '../services/user-analytics.service';
import { ConfigService } from '@nestjs/config';
import { UAParser } from 'ua-parser-js';
import * as cookieParser from 'cookie-parser';

// Define the request with user interface
interface RequestWithUser extends Request {
  user?: {
    id?: string;
    sub?: string;
    email?: string;
    [key: string]: any;
  };
  analyticsId?: string;
}

@Injectable()
export class AnalyticsMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AnalyticsMiddleware.name);
  private readonly cookieOptions: any;
  private readonly analyticsEnabled: boolean;

  constructor(
    private readonly userAnalyticsService: UserAnalyticsService,
    private readonly configService: ConfigService,
  ) {
    const isProduction = configService.get<string>('NODE_ENV') === 'production';
    this.analyticsEnabled = configService.get<boolean>('ANALYTICS_ENABLED', true);
    
    // Configure cookie options
    this.cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      domain: configService.get<string>('COOKIE_DOMAIN'),
    };
  }

  use(req: RequestWithUser, res: Response, next: NextFunction): void {
    if (!this.analyticsEnabled) {
      return next();
    }

    try {
      // Parse cookies if not already done
      if (!req.cookies) {
        cookieParser()(req, res, () => {});
      }

      // Generate or retrieve analytics ID
      const analyticsId = this.getOrCreateAnalyticsId(req, res);
      
      // Add analytics ID to request for use in controllers
      req.analyticsId = analyticsId;
      
      // Track user session if authenticated
      const userId = req.user?.id || req.user?.sub;
      if (userId) {
        const deviceInfo = this.getDeviceInfo(req);
        
        this.userAnalyticsService.trackUserSession(userId, analyticsId, deviceInfo)
          .catch(error => {
            this.logger.error(`Failed to track user session: ${error instanceof Error ? error.message : 'Unknown error'}`);
          });
      }
      
      // Track page view for GET requests that accept HTML
      if (req.method === 'GET' && this.isHtmlRequest(req)) {
        this.trackPageView(req, analyticsId);
      }
    } catch (error) {
      // Don't block the request if analytics fails
      this.logger.error(`Analytics middleware error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    next();
  }

  /**
   * Get or create analytics ID from cookies
   */
  private getOrCreateAnalyticsId(req: Request, res: Response): string {
    const cookieName = 'analytics_id';
    let analyticsId = req.cookies?.[cookieName];
    
    if (!analyticsId) {
      analyticsId = this.generateAnalyticsId();
      res.cookie(cookieName, analyticsId, this.cookieOptions);
    }
    
    return analyticsId;
  }

  /**
   * Generate a unique analytics ID
   */
  private generateAnalyticsId(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15) + 
           Date.now().toString(36);
  }

  /**
   * Get device information from user agent
   */
  private getDeviceInfo(req: Request): any {
    try {
      const userAgent = req.headers['user-agent'];
      if (!userAgent) {
        return { unknown: true };
      }
      
      const parser = new UAParser(userAgent);
      const result = parser.getResult();
      
      return {
        browser: {
          name: result.browser.name,
          version: result.browser.version,
        },
        os: {
          name: result.os.name,
          version: result.os.version,
        },
        device: {
          type: result.device.type || 'desktop',
          vendor: result.device.vendor,
          model: result.device.model,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to parse user agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { error: 'Failed to parse user agent' };
    }
  }

  /**
   * Check if request accepts HTML
   */
  private isHtmlRequest(req: Request): boolean {
    const accept = req.headers.accept;
    return Boolean(accept?.includes('text/html') || accept?.includes('application/xhtml+xml'));
  }

  /**
   * Track page view
   */
  private trackPageView(req: Request, analyticsId: string): void {
    // Implementation would depend on your analytics tracking system
    // This is just a placeholder
    this.logger.debug(`Page view: ${req.path} (${analyticsId})`);
  }
} 