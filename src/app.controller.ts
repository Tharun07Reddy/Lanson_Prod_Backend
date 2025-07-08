/* eslint-disable prettier/prettier */
import { Controller, Get, UseGuards, Req, Logger } from '@nestjs/common';
import { AppService } from './app.service';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { Public } from './auth/decorators/public.decorator';
import { Request } from 'express';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);
  
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  getHello(): Promise<string> {
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
}
