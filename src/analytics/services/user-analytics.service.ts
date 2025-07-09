import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../cache/redis.service';
import { ConfigService } from '@nestjs/config';
import { Prisma, AnalyticsEvent, PageView, FeatureUsage, UserPreference } from '@prisma/client';

@Injectable()
export class UserAnalyticsService {
  private readonly logger = new Logger(UserAnalyticsService.name);
  private readonly userAnalyticsPrefix = 'analytics:user:';
  private readonly cacheTtl = 3600; // 1 hour in seconds

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Track user session
   */
  async trackUserSession(userId: string, sessionId: string, deviceInfo?: any): Promise<void> {
    try {
      // Store in Redis for quick access
      const key = `${this.userAnalyticsPrefix}${userId}:sessions`;
      await this.redisService.sadd(key, sessionId);
      
      // Store device info if provided
      if (deviceInfo) {
        const deviceKey = `${this.userAnalyticsPrefix}${userId}:device:${sessionId}`;
        await this.redisService.set(deviceKey, JSON.stringify(deviceInfo), this.cacheTtl);
      }

      // Create analytics event for session start
      await this.prisma.analyticsEvent.create({
        data: {
          eventType: 'session:start',
          userId,
          sessionId,
          source: 'session',
          metadata: deviceInfo as Prisma.InputJsonValue,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(`Failed to track user session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get user activity summary
   */
  async getUserActivitySummary(userId: string): Promise<any> {
    try {
      // Get from cache if available
      const cacheKey = `${this.userAnalyticsPrefix}${userId}:activity:summary`;
      const cachedSummary = await this.redisService.get<any>(cacheKey);
      
      if (cachedSummary) {
        return cachedSummary;
      }

      try {
        // Get analytics events for the user
        const events = await this.prisma.analyticsEvent.findMany({
          where: {
            userId,
          },
          orderBy: {
            timestamp: 'desc',
          },
          take: 100, // Limit to most recent 100 events
        });

        // Get page views for the user
        const pageViews = await this.prisma.pageView.findMany({
          where: {
            userId,
          },
          orderBy: {
            timestamp: 'desc',
          },
          take: 50, // Limit to most recent 50 page views
        });

        // Get feature usage for the user
        const featureUsage = await this.prisma.featureUsage.findMany({
          where: {
            userId,
          },
          orderBy: {
            lastUsedAt: 'desc',
          },
        });

        // Calculate active days
        const activeDays = await this.calculateActiveDays(userId);

        // Build summary
        const summary = {
          userId,
          events: this.summarizeEvents(events),
          pageViews: this.summarizePageViews(pageViews),
          featureUsage: this.summarizeFeatureUsage(featureUsage),
          activeDays,
          lastUpdated: new Date(),
        };

        // Cache the result
        await this.redisService.set(cacheKey, summary, this.cacheTtl);

        return summary;
      } catch (error) {
        this.logger.error(`Failed to retrieve user activity data: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw error;
      }
    } catch (error) {
      this.logger.error(`Failed to get user activity summary: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        userId,
        events: [],
        pageViews: [],
        featureUsage: [],
        activeDays: 0,
        error: 'Failed to retrieve user activity',
      };
    }
  }

  /**
   * Track user preference
   */
  async trackUserPreference(userId: string, preferenceKey: string, preferenceValue: any): Promise<void> {
    try {
      // Store in Redis for quick access
      const key = `${this.userAnalyticsPrefix}${userId}:preferences`;
      await this.redisService.hset(key, preferenceKey, JSON.stringify(preferenceValue));
      
      // Store in database
      await this.prisma.userPreference.upsert({
        where: {
          userId_key: {
            userId,
            key: preferenceKey,
          },
        },
        update: {
          value: preferenceValue as Prisma.InputJsonValue,
          updatedAt: new Date(),
        },
        create: {
          userId,
          key: preferenceKey,
          value: preferenceValue as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to track user preference: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get user preferences
   */
  async getUserPreferences(userId: string): Promise<Record<string, any>> {
    try {
      // Try to get from Redis first
      const key = `${this.userAnalyticsPrefix}${userId}:preferences`;
      const redisPreferences = await this.redisService.hgetall(key);
      
      if (redisPreferences && Object.keys(redisPreferences).length > 0) {
        // Parse JSON values
        return Object.entries(redisPreferences).reduce((acc, [key, value]) => {
          try {
            acc[key] = JSON.parse(value as string);
          } catch {
            acc[key] = value;
          }
          return acc;
        }, {} as Record<string, any>);
      }
      
      // If not in Redis, get from database
      const dbPreferences = await this.prisma.userPreference.findMany({
        where: {
          userId,
        },
      });
      
      // Convert to key-value object
      const preferences = dbPreferences.reduce((acc, pref) => {
        acc[pref.key] = pref.value;
        return acc;
      }, {} as Record<string, any>);
      
      // Store in Redis for future use
      if (Object.keys(preferences).length > 0) {
        for (const [key, value] of Object.entries(preferences)) {
          await this.redisService.hset(`${this.userAnalyticsPrefix}${userId}:preferences`, key, JSON.stringify(value));
        }
      }
      
      return preferences;
    } catch (error) {
      this.logger.error(`Failed to get user preferences: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {};
    }
  }

  /**
   * Track user feature interaction
   */
  async trackFeatureInteraction(userId: string, featureName: string, interactionType: string, metadata?: any): Promise<void> {
    try {
      // Store in database
      await this.prisma.featureUsage.upsert({
        where: {
          userId_featureName_interactionType: {
            userId,
            featureName,
            interactionType,
          },
        },
        update: {
          count: {
            increment: 1,
          },
          lastUsedAt: new Date(),
          metadata: metadata as Prisma.InputJsonValue,
          updatedAt: new Date(),
        },
        create: {
          userId,
          featureName,
          interactionType,
          count: 1,
          metadata: metadata as Prisma.InputJsonValue,
          firstUsedAt: new Date(),
          lastUsedAt: new Date(),
        },
      });
      
      // Store in Redis for quick access
      const countKey = `${this.userAnalyticsPrefix}${userId}:feature:${featureName}:${interactionType}:count`;
      await this.redisService.incr(countKey);
      
      // Store last interaction time
      const timeKey = `${this.userAnalyticsPrefix}${userId}:feature:${featureName}:${interactionType}:last`;
      await this.redisService.set(timeKey, new Date().toISOString());
      
      // Store metadata if provided
      if (metadata) {
        const metadataKey = `${this.userAnalyticsPrefix}${userId}:feature:${featureName}:${interactionType}:metadata`;
        await this.redisService.set(metadataKey, JSON.stringify(metadata), this.cacheTtl);
      }
    } catch (error) {
      this.logger.error(`Failed to track feature interaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate active days for a user
   */
  private async calculateActiveDays(userId: string): Promise<number> {
    try {
      // Use Prisma's aggregate function instead of raw query
      const result = await this.prisma.analyticsEvent.groupBy({
        by: ['timestamp'],
        where: {
          userId,
        },
        _count: {
          _all: true,
        },
      });
      
      // Count unique dates
      const uniqueDates = new Set();
      result.forEach(item => {
        const date = new Date(item.timestamp);
        uniqueDates.add(`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`);
      });
      
      return uniqueDates.size;
    } catch (error) {
      this.logger.error(`Failed to calculate active days: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return 0;
    }
  }

  /**
   * Summarize events
   */
  private summarizeEvents(events: AnalyticsEvent[]): any[] {
    // Group events by type
    const eventsByType = events.reduce((acc, event) => {
      const { eventType } = event;
      if (!acc[eventType]) {
        acc[eventType] = [];
      }
      acc[eventType].push(event);
      return acc;
    }, {} as Record<string, AnalyticsEvent[]>);

    // Create summary for each event type
    return Object.entries(eventsByType).map(([eventType, events]) => ({
      eventType,
      count: events.length,
      lastOccurred: events[0].timestamp,
    }));
  }

  /**
   * Summarize page views
   */
  private summarizePageViews(pageViews: PageView[]): any[] {
    // Group page views by path
    const viewsByPath = pageViews.reduce((acc, view) => {
      const { path } = view;
      if (!acc[path]) {
        acc[path] = [];
      }
      acc[path].push(view);
      return acc;
    }, {} as Record<string, PageView[]>);

    // Create summary for each path
    return Object.entries(viewsByPath).map(([path, views]) => ({
      path,
      count: views.length,
      lastVisited: views[0].timestamp,
      avgDuration: views.reduce((sum, view) => sum + (view.duration || 0), 0) / views.length,
    }));
  }

  /**
   * Summarize feature usage
   */
  private summarizeFeatureUsage(featureUsage: FeatureUsage[]): any[] {
    return featureUsage.map(usage => ({
      featureName: usage.featureName,
      interactionType: usage.interactionType,
      count: usage.count,
      firstUsed: usage.firstUsedAt,
      lastUsed: usage.lastUsedAt,
    }));
  }
} 