import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../cache/redis.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '@prisma/client';
import * as os from 'os';

interface PerformanceMetric {
  timestamp: Date;
  value: number;
  metadata?: Record<string, any>;
}

@Injectable()
export class PerformanceAnalyticsService {
  private readonly logger = new Logger(PerformanceAnalyticsService.name);
  private readonly metricsPrefix = 'analytics:performance:';
  private readonly isProduction: boolean;
  private readonly performanceMonitoringEnabled: boolean;
  private readonly metricsRetentionDays: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    this.isProduction = configService.get<string>('NODE_ENV') === 'production';
    this.performanceMonitoringEnabled = configService.get<boolean>('PERFORMANCE_MONITORING_ENABLED', true);
    this.metricsRetentionDays = configService.get<number>('METRICS_RETENTION_DAYS', 30);
    
    if (this.performanceMonitoringEnabled) {
      this.startPeriodicMetricsCollection();
    }
  }

  /**
   * Track API response time
   */
  async trackResponseTime(path: string, method: string, responseTime: number, statusCode: number): Promise<void> {
    if (!this.performanceMonitoringEnabled) {
      return;
    }

    try {
      const now = new Date();
      const metric: PerformanceMetric = {
        timestamp: now,
        value: responseTime,
        metadata: { path, method, statusCode },
      };

      // Store in database
      await this.prisma.performanceMetric.create({
        data: {
          metricType: 'response_time',
          value: responseTime,
          path,
          method,
          statusCode,
          metadata: metric.metadata as Prisma.InputJsonValue,
          timestamp: now,
        },
      });

      // Store in time series
      const key = `${this.metricsPrefix}response_time:${path}:${method}`;
      await this.storeTimeSeriesMetric(key, metric);

      // Store in aggregated metrics
      await this.updateAggregatedMetrics('response_time', responseTime, { path, method });
    } catch (error) {
      this.logger.error(`Failed to track response time: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Track database query performance
   */
  async trackDatabasePerformance(operation: string, table: string, duration: number): Promise<void> {
    if (!this.performanceMonitoringEnabled) {
      return;
    }

    try {
      const now = new Date();
      const metric: PerformanceMetric = {
        timestamp: now,
        value: duration,
        metadata: { operation, table },
      };

      // Store in database
      await this.prisma.performanceMetric.create({
        data: {
          metricType: 'database',
          value: duration,
          path: table,
          method: operation,
          metadata: metric.metadata as Prisma.InputJsonValue,
          timestamp: now,
        },
      });

      // Store in time series
      const key = `${this.metricsPrefix}db:${operation}:${table}`;
      await this.storeTimeSeriesMetric(key, metric);

      // Store in aggregated metrics
      await this.updateAggregatedMetrics('db_operation', duration, { operation, table });
    } catch (error) {
      this.logger.error(`Failed to track database performance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Track memory usage
   */
  async trackMemoryUsage(): Promise<void> {
    if (!this.performanceMonitoringEnabled) {
      return;
    }

    try {
      const memoryUsage = process.memoryUsage();
      const now = new Date();
      
      // Track heap used
      const heapUsedMetric: PerformanceMetric = {
        timestamp: now,
        value: memoryUsage.heapUsed / 1024 / 1024, // Convert to MB
        metadata: { type: 'heapUsed' },
      };
      
      // Track RSS (Resident Set Size)
      const rssMetric: PerformanceMetric = {
        timestamp: now,
        value: memoryUsage.rss / 1024 / 1024, // Convert to MB
        metadata: { type: 'rss' },
      };

      // Store in database
      await this.prisma.performanceMetric.create({
        data: {
          metricType: 'memory_heap_used',
          value: heapUsedMetric.value,
          metadata: heapUsedMetric.metadata as Prisma.InputJsonValue,
          timestamp: now,
        },
      });

      await this.prisma.performanceMetric.create({
        data: {
          metricType: 'memory_rss',
          value: rssMetric.value,
          metadata: rssMetric.metadata as Prisma.InputJsonValue,
          timestamp: now,
        },
      });

      // Store metrics in Redis
      await this.storeTimeSeriesMetric(`${this.metricsPrefix}memory:heap_used`, heapUsedMetric);
      await this.storeTimeSeriesMetric(`${this.metricsPrefix}memory:rss`, rssMetric);
      
      // Update aggregated metrics
      await this.updateAggregatedMetrics('memory_heap_used', heapUsedMetric.value);
      await this.updateAggregatedMetrics('memory_rss', rssMetric.value);

      // Store in system health
      await this.updateSystemHealth('memory', 'healthy', {
        heapUsed: heapUsedMetric.value,
        rss: rssMetric.value,
      });
    } catch (error) {
      this.logger.error(`Failed to track memory usage: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Track CPU usage
   */
  async trackCpuUsage(): Promise<void> {
    if (!this.performanceMonitoringEnabled) {
      return;
    }

    try {
      const cpus = os.cpus();
      const now = new Date();
      
      // Calculate average CPU usage across all cores
      let totalIdle = 0;
      let totalTick = 0;
      
      for (const cpu of cpus) {
        for (const type in cpu.times) {
          totalTick += cpu.times[type as keyof typeof cpu.times];
        }
        totalIdle += cpu.times.idle;
      }
      
      const idlePercent = totalIdle / totalTick;
      const usagePercent = 100 - (idlePercent * 100);
      
      const cpuMetric: PerformanceMetric = {
        timestamp: now,
        value: usagePercent,
        metadata: { cores: cpus.length },
      };

      // Store in database
      await this.prisma.performanceMetric.create({
        data: {
          metricType: 'cpu_usage',
          value: usagePercent,
          metadata: cpuMetric.metadata as Prisma.InputJsonValue,
          timestamp: now,
        },
      });

      // Store metric in Redis
      await this.storeTimeSeriesMetric(`${this.metricsPrefix}cpu:usage`, cpuMetric);
      
      // Update aggregated metrics
      await this.updateAggregatedMetrics('cpu_usage', usagePercent);

      // Store in system health
      await this.updateSystemHealth('cpu', usagePercent < 80 ? 'healthy' : 'high', {
        usage: usagePercent,
        cores: cpus.length,
      });
    } catch (error) {
      this.logger.error(`Failed to track CPU usage: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update system health
   */
  private async updateSystemHealth(
    serviceName: string,
    status: string,
    metrics: Record<string, any>,
  ): Promise<void> {
    try {
      await this.prisma.systemHealth.create({
        data: {
          serviceName,
          status,
          memoryUsage: metrics.heapUsed || metrics.rss,
          cpuUsage: metrics.usage,
          metadata: metrics as Prisma.InputJsonValue,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(`Failed to update system health: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(metricType: string, timeRange: string = '1h'): Promise<any> {
    try {
      const now = new Date();
      let startTime: Date;
      
      // Calculate time range
      switch (timeRange) {
        case '1h':
          startTime = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case '6h':
          startTime = new Date(now.getTime() - 6 * 60 * 60 * 1000);
          break;
        case '24h':
          startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        default:
          startTime = new Date(now.getTime() - 60 * 60 * 1000); // Default to 1 hour
      }
      
      // Get metrics from database
      const metrics = await this.prisma.performanceMetric.findMany({
        where: {
          metricType,
          timestamp: {
            gte: startTime,
            lte: now,
          },
        },
        orderBy: {
          timestamp: 'asc',
        },
      });
      
      // Get aggregated metrics from Redis
      const aggregatedKey = `${this.metricsPrefix}${metricType}:aggregated`;
      const aggregated = await this.redisService.get<any>(aggregatedKey);
      
      // Calculate summary statistics
      const summary = this.calculateMetricSummary(metrics);
      
      return {
        metricType,
        timeRange,
        metrics,
        aggregated: aggregated || summary,
        summary,
      };
    } catch (error) {
      this.logger.error(`Failed to get performance metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        metricType,
        timeRange,
        error: 'Failed to retrieve metrics',
      };
    }
  }

  /**
   * Calculate summary statistics for metrics
   */
  private calculateMetricSummary(metrics: any[]): any {
    if (!metrics || metrics.length === 0) {
      return {
        count: 0,
        min: 0,
        max: 0,
        avg: 0,
        p95: 0,
        p99: 0,
      };
    }

    const values = metrics.map(m => m.value).sort((a, b) => a - b);
    const sum = values.reduce((acc, val) => acc + val, 0);
    const count = values.length;
    const min = values[0];
    const max = values[count - 1];
    const avg = sum / count;
    
    // Calculate percentiles
    const p95Index = Math.floor(count * 0.95);
    const p99Index = Math.floor(count * 0.99);
    const p95 = values[p95Index];
    const p99 = values[p99Index];

    return {
      count,
      min,
      max,
      avg,
      p95,
      p99,
      lastUpdated: new Date(),
    };
  }

  /**
   * Store time series metric
   */
  private async storeTimeSeriesMetric(key: string, metric: PerformanceMetric): Promise<void> {
    try {
      const timeSeriesKey = `${key}:timeseries`;
      const score = metric.timestamp.getTime();
      const value = JSON.stringify(metric);
      
      await this.redisService.zadd(timeSeriesKey, score, value);
      
      // Set expiration for time series data
      const expirationSeconds = this.metricsRetentionDays * 24 * 60 * 60;
      await this.redisService.expire(timeSeriesKey, expirationSeconds);
      
      // Clean up old data (keep only data within retention period)
      const cutoffTime = new Date();
      cutoffTime.setDate(cutoffTime.getDate() - this.metricsRetentionDays);
      await this.redisService.zremrangebyscore(timeSeriesKey, 0, cutoffTime.getTime());
    } catch (error) {
      this.logger.error(`Failed to store time series metric: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update aggregated metrics
   */
  private async updateAggregatedMetrics(metricType: string, value: number, metadata?: Record<string, any>): Promise<void> {
    try {
      const aggregatedKey = `${this.metricsPrefix}${metricType}:aggregated`;
      
      // Get existing aggregated data
      let aggregated = await this.redisService.get<any>(aggregatedKey) || {
        count: 0,
        sum: 0,
        min: value,
        max: value,
        avg: value,
        lastUpdated: new Date(),
      };
      
      // Update aggregated values
      aggregated.count += 1;
      aggregated.sum += value;
      aggregated.min = Math.min(aggregated.min, value);
      aggregated.max = Math.max(aggregated.max, value);
      aggregated.avg = aggregated.sum / aggregated.count;
      aggregated.lastUpdated = new Date();
      
      if (metadata) {
        aggregated.metadata = { ...aggregated.metadata, ...metadata };
      }
      
      // Store updated aggregated data
      await this.redisService.set(aggregatedKey, aggregated);
      
      // Set expiration for aggregated data
      const expirationSeconds = this.metricsRetentionDays * 24 * 60 * 60;
      await this.redisService.expire(aggregatedKey, expirationSeconds);
    } catch (error) {
      this.logger.error(`Failed to update aggregated metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Start periodic metrics collection
   */
  private startPeriodicMetricsCollection(): void {
    // Collect memory and CPU metrics every minute
    setInterval(() => {
      this.trackMemoryUsage().catch(err => {
        this.logger.error(`Error tracking memory usage: ${err instanceof Error ? err.message : 'Unknown error'}`);
      });
      
      this.trackCpuUsage().catch(err => {
        this.logger.error(`Error tracking CPU usage: ${err instanceof Error ? err.message : 'Unknown error'}`);
      });
    }, 60000); // 1 minute
    
    this.logger.log('Started periodic performance metrics collection');
  }
} 