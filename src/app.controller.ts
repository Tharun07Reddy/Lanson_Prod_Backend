/* eslint-disable prettier/prettier */
import { Controller, Get, UseGuards, Req, Logger, Res } from '@nestjs/common';
import { AppService } from './app.service';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { Public } from './auth/decorators/public.decorator';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);
  
  constructor(
    private readonly appService: AppService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Get()
  async getHello(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<string> {
    // Generate analytics ID if not present
    if (!req.cookies?.analytics_id) {
      const analyticsId = this.generateAnalyticsId();
      const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
      
      // Set analytics cookie
      res.cookie('analytics_id', analyticsId, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'strict' : 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        domain: this.configService.get<string>('COOKIE_DOMAIN'),
      });
      
      this.logger.debug(`Set analytics_id cookie: ${analyticsId}`);
    }
    
    return this.appService.getHello();
  }
  
  @UseGuards(JwtAuthGuard)
  @Get('test-auth')
  testAuth(@Req() req: Request): any {
    this.logger.debug(`Auth test endpoint called with user: ${JSON.stringify(req.user)}`);
    return {
      message: 'Authentication successful',
      user: req.user
    };
  }
  
  /**
   * Generate a unique analytics ID
   */
  private generateAnalyticsId(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15) + 
           Date.now().toString(36);
  }
}
