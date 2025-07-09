import { Controller, Get, Query, UseGuards, Req, Post, Body, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AnalyticsService } from '../services/analytics.service';
import { UserAnalyticsService } from '../services/user-analytics.service';
import { PerformanceAnalyticsService } from '../services/performance-analytics.service';
import { Request } from 'express';

interface RequestWithUser extends Request {
  user: {
    id: string;
    email: string;
    [key: string]: any;
  };
}

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  private readonly logger = new Logger(AnalyticsController.name);

  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly userAnalyticsService: UserAnalyticsService,
    private readonly performanceAnalyticsService: PerformanceAnalyticsService,
  ) {}

  /**
   * Get analytics dashboard data (admin only)
   */
  @Get('dashboard')
  // @Roles('ADMIN')
  async getDashboardData(@Query('timeRange') timeRange: string = '7d'): Promise<any> {
    try {
      return await this.analyticsService.getDashboardData(timeRange);
    } catch (error) {
      this.logger.error(`Error getting dashboard data: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        error: 'Failed to retrieve dashboard data',
        timeRange,
      };
    }
  }

  /**
   * Get user analytics data
   */
  @Get('user')
  async getUserAnalytics(@Req() req: RequestWithUser): Promise<any> {
    try {
      const userId = req.user.id;
      return await this.userAnalyticsService.getUserActivitySummary(userId);
    } catch (error) {
      this.logger.error(`Error getting user analytics: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        error: 'Failed to retrieve user analytics',
      };
    }
  }

  /**
   * Get performance metrics (admin only)
   */
  @Get('performance')
  @Roles('ADMIN')
  async getPerformanceMetrics(
    @Query('metricType') metricType: string = 'response_time',
    @Query('timeRange') timeRange: string = '1h',
  ): Promise<any> {
    try {
      return await this.performanceAnalyticsService.getPerformanceMetrics(metricType, timeRange);
    } catch (error) {
      this.logger.error(`Error getting performance metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        error: 'Failed to retrieve performance metrics',
        metricType,
        timeRange,
      };
    }
  }

  /**
   * Store user preference
   */
  @Post('preferences')
  @HttpCode(HttpStatus.OK)
  async storeUserPreference(
    @Req() req: RequestWithUser,
    @Body() body: { key: string; value: any },
  ): Promise<any> {
    try {
      const userId = req.user.id;
      const { key, value } = body;
      
      await this.userAnalyticsService.trackUserPreference(userId, key, value);
      
      return {
        success: true,
        message: 'Preference stored successfully',
      };
    } catch (error) {
      this.logger.error(`Error storing user preference: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        success: false,
        error: 'Failed to store preference',
      };
    }
  }

  /**
   * Get user preferences
   */
  @Get('preferences')
  async getUserPreferences(@Req() req: RequestWithUser): Promise<any> {
    try {
      const userId = req.user.id;
      return await this.userAnalyticsService.getUserPreferences(userId);
    } catch (error) {
      this.logger.error(`Error getting user preferences: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        error: 'Failed to retrieve user preferences',
      };
    }
  }

  /**
   * Track feature interaction
   */
  @Post('track/feature')
  @HttpCode(HttpStatus.OK)
  async trackFeatureInteraction(
    @Req() req: RequestWithUser,
    @Body() body: { feature: string; action: string; metadata?: any },
  ): Promise<any> {
    try {
      const userId = req.user.id;
      const { feature, action, metadata } = body;
      
      await this.userAnalyticsService.trackFeatureInteraction(userId, feature, action, metadata);
      
      return {
        success: true,
        message: 'Feature interaction tracked successfully',
      };
    } catch (error) {
      this.logger.error(`Error tracking feature interaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        success: false,
        error: 'Failed to track feature interaction',
      };
    }
  }
} 