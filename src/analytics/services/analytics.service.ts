import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../cache/redis.service';
import { ConfigService } from '@nestjs/config';
import { Prisma, AnalyticsEvent, PageView, FeatureUsage, PerformanceMetric, SystemHealth } from '@prisma/client';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  private readonly isProduction: boolean;
  private readonly analyticsEnabled: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    this.isProduction = configService.get<string>('NODE_ENV') === 'production';
    this.analyticsEnabled = configService.get<boolean>('ANALYTICS_ENABLED', true);
    
    this.logger.log(`Analytics service initialized. Production mode: ${this.isProduction}, Analytics enabled: ${this.analyticsEnabled}`);
  }

  /**
   * Track a generic event
   */
  async trackEvent(eventData: {
    eventType: string;
    userId?: string;
    sessionId?: string;
    metadata?: Record<string, any>;
    source?: string;
    ip?: string;
    userAgent?: string;
  }): Promise<void> {
    if (!this.analyticsEnabled) {
      return;
    }

    try {
      const { eventType, userId, sessionId, metadata, source, ip, userAgent } = eventData;

      await this.prisma.analyticsEvent.create({
        data: {
          eventType,
          userId,
          sessionId,
          metadata: metadata as Prisma.InputJsonValue,
          source: source || 'api',
          ipAddress: ip,
          userAgent,
          timestamp: new Date(),
        },
      });

      // If in production, also queue for batch processing
      if (this.isProduction) {
        await this.queueEventForBatchProcessing(eventData);
      }
    } catch (error) {
      // Don't let analytics errors affect the application
      this.logger.error(`Failed to track event: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Queue event for batch processing
   */
  private async queueEventForBatchProcessing(eventData: any): Promise<void> {
    try {
      const eventQueue = 'analytics:events:queue';
      await this.redisService.lpush(eventQueue, JSON.stringify(eventData));
    } catch (error) {
      this.logger.error(`Failed to queue event: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get analytics data for dashboard
   */
  async getDashboardData(timeRange: string = '7d'): Promise<any> {
    // Calculate date range
    const endDate = new Date();
    let startDate: Date;
    
    switch (timeRange) {
      case '24h':
        startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    try {
      // Get events from the database
      const events = await this.prisma.analyticsEvent.findMany({
        where: {
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
        },
      });

      // Get page views
      const pageViews = await this.prisma.pageView.findMany({
        where: {
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
        },
      });

      // Get feature usage
      const featureUsage = await this.prisma.featureUsage.findMany({
        where: {
          lastUsedAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      });

      // Get performance metrics
      const performanceMetrics = await this.prisma.performanceMetric.findMany({
        where: {
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
        },
      });

      // Get system health
      const systemHealth = await this.prisma.systemHealth.findMany({
        where: {
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: {
          timestamp: 'desc',
        },
        take: 100, // Limit to the most recent 100 records
      });

      // Process the data to generate dashboard data
      return this.processDashboardData({
        events,
        pageViews,
        featureUsage,
        performanceMetrics,
        systemHealth,
        timeRange,
      });
    } catch (error) {
      this.logger.error(`Failed to get dashboard data: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        timeRange,
        error: 'Failed to retrieve analytics data',
      };
    }
  }

  /**
   * Process data into dashboard data
   */
  private processDashboardData(data: {
    events: AnalyticsEvent[];
    pageViews: PageView[];
    featureUsage: FeatureUsage[];
    performanceMetrics: PerformanceMetric[];
    systemHealth: SystemHealth[];
    timeRange: string;
  }): any {
    const { events, pageViews, featureUsage, performanceMetrics, systemHealth, timeRange } = data;

    // Group events by type
    const eventsByType = events.reduce((acc, event) => {
      const { eventType } = event;
      if (!acc[eventType]) {
        acc[eventType] = [];
      }
      acc[eventType].push(event);
      return acc;
    }, {} as Record<string, AnalyticsEvent[]>);

    // Count unique users
    const uniqueUsers = new Set(events.filter(e => e.userId).map(e => e.userId)).size;
    
    // Count unique sessions
    const uniqueSessions = new Set(events.filter(e => e.sessionId).map(e => e.sessionId)).size;

    // Calculate event counts by type
    const eventCounts = Object.entries(eventsByType).map(([type, typeEvents]) => ({
      type,
      count: typeEvents.length,
    }));

    // Process page views
    const topPages = this.getTopPages(pageViews);

    // Process feature usage
    const topFeatures = this.getTopFeatures(featureUsage);

    // Process performance metrics
    const performanceSummary = this.summarizePerformanceMetrics(performanceMetrics);

    // Get latest system health status
    const latestSystemHealth = systemHealth[0] || null;

    return {
      timeRange,
      totalEvents: events.length,
      uniqueUsers,
      uniqueSessions,
      eventCounts,
      topPages,
      topFeatures,
      performanceSummary,
      latestSystemHealth,
    };
  }

  /**
   * Get top pages from page views
   */
  private getTopPages(pageViews: PageView[]): any[] {
    // Group by path
    const pagesByPath = pageViews.reduce((acc, view) => {
      const { path } = view;
      if (!acc[path]) {
        acc[path] = [];
      }
      acc[path].push(view);
      return acc;
    }, {} as Record<string, PageView[]>);

    // Calculate metrics for each page
    return Object.entries(pagesByPath)
      .map(([path, views]) => ({
        path,
        views: views.length,
        uniqueUsers: new Set(views.filter(v => v.userId).map(v => v.userId)).size,
        uniqueSessions: new Set(views.map(v => v.sessionId)).size,
        avgDuration: views.reduce((sum, v) => sum + (v.duration || 0), 0) / views.length,
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10); // Top 10 pages
  }

  /**
   * Get top features from feature usage
   */
  private getTopFeatures(featureUsage: FeatureUsage[]): any[] {
    // Group by feature name
    const featuresByName = featureUsage.reduce((acc, usage) => {
      const { featureName } = usage;
      if (!acc[featureName]) {
        acc[featureName] = [];
      }
      acc[featureName].push(usage);
      return acc;
    }, {} as Record<string, FeatureUsage[]>);

    // Calculate metrics for each feature
    return Object.entries(featuresByName)
      .map(([featureName, usages]) => ({
        featureName,
        totalUsage: usages.reduce((sum, u) => sum + u.count, 0),
        uniqueUsers: new Set(usages.map(u => u.userId)).size,
      }))
      .sort((a, b) => b.totalUsage - a.totalUsage)
      .slice(0, 10); // Top 10 features
  }

  /**
   * Summarize performance metrics
   */
  private summarizePerformanceMetrics(metrics: PerformanceMetric[]): any {
    // Group by metric type
    const metricsByType = metrics.reduce((acc, metric) => {
      const { metricType } = metric;
      if (!acc[metricType]) {
        acc[metricType] = [];
      }
      acc[metricType].push(metric);
      return acc;
    }, {} as Record<string, PerformanceMetric[]>);

    // Calculate summary for each metric type
    return Object.entries(metricsByType).map(([metricType, typeMetrics]) => {
      const values = typeMetrics.map(m => m.value);
      return {
        metricType,
        count: typeMetrics.length,
        min: Math.min(...values),
        max: Math.max(...values),
        avg: values.reduce((sum, v) => sum + v, 0) / values.length,
      };
    });
  }
} 