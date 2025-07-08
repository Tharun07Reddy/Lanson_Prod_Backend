import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { SessionService } from '../session.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class SessionMiddleware implements NestMiddleware {
  private readonly logger = new Logger(SessionMiddleware.name);

  constructor(
    private sessionService: SessionService,
    private jwtService: JwtService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      // Extract token from header
      const token = this.extractTokenFromHeader(req);
      
      if (token) {
        // Verify token
        try {
          const payload = this.jwtService.verify(token);
          
          if (payload && payload.sub) {
            // Find active session
            const session = await this.sessionService.findSessionByToken(token);
            
            if (session && session.isActive) {
              // Update session activity
              await this.sessionService.updateSessionActivity(session.id);
              
              // Attach session to request
              req['session'] = session;
            }
          }
        } catch (error) {
          // Token verification failed, but we don't want to block the request
          this.logger.debug(`Invalid token in session middleware: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      
      // Extract device information
      this.extractDeviceInfo(req);
      
      next();
    } catch (error) {
      this.logger.error(`Error in session middleware: ${error instanceof Error ? error.message : 'Unknown error'}`);
      next();
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }

  private extractDeviceInfo(req: Request) {
    const userAgent = req.headers['user-agent'] as string | undefined;
    const deviceType = this.detectDeviceType(userAgent || '');
    
    // Attach to request
    req['deviceInfo'] = {
      deviceType,
      userAgent,
      ipAddress: req.ip,
    };
  }

  private detectDeviceType(userAgent: string): string {
    if (!userAgent) {
      return 'unknown';
    }
    
    userAgent = userAgent.toLowerCase();
    
    if (/mobile|android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent)) {
      return 'mobile';
    } else if (/tablet|ipad/i.test(userAgent)) {
      return 'tablet';
    } else if (/electron/i.test(userAgent)) {
      return 'desktop-app';
    } else {
      return 'web';
    }
  }
} 