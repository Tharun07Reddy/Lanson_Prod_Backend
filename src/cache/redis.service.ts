import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Redis } from "ioredis";
import { createRedisClient } from "../config/cache.config";

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private isConnected = false;
  private connectionAttempts = 0;
  private readonly maxConnectionAttempts = 5;
  private readonly connectionRetryDelay = 5000; // 5 seconds

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    await this.connectWithRetry();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  private async connectWithRetry(): Promise<void> {
    if (this.isConnected) return;

    try {
      this.logger.log("Connecting to Redis...");
      this.client = createRedisClient();
      
      if (!this.client) {
        this.logger.warn("Redis client could not be created. Using fallback.");
        return;
      }

      // Test connection
      await this.client.ping();
      this.isConnected = true;
      this.logger.log("Redis connection established successfully");
    } catch (error) {
      this.connectionAttempts++;
      
      if (this.connectionAttempts >= this.maxConnectionAttempts) {
        this.logger.error(`Failed to connect to Redis after ${this.maxConnectionAttempts} attempts`);
        this.logger.error(error);
        return; // Continue without Redis
      }
      
      this.logger.warn(`Redis connection attempt ${this.connectionAttempts} failed. Retrying in ${this.connectionRetryDelay / 1000}s...`);
      this.logger.debug(error);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, this.connectionRetryDelay));
      await this.connectWithRetry();
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      this.logger.log("Disconnecting from Redis...");
      await this.client.quit();
      this.isConnected = false;
      this.client = null;
    }
  }

  getClient(): Redis | null {
    return this.client;
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.client || !this.isConnected) {
      return null;
    }

    try {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) as T : null;
    } catch (error) {
      this.logger.error(`Error getting key ${key} from Redis`, error);
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      return false;
    }

    try {
      const serialized = JSON.stringify(value);
      
      if (ttlSeconds) {
        await this.client.set(key, serialized, "EX", ttlSeconds);
      } else {
        await this.client.set(key, serialized);
      }
      
      return true;
    } catch (error) {
      this.logger.error(`Error setting key ${key} in Redis`, error);
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      return false;
    }

    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      this.logger.error(`Error deleting key ${key} from Redis`, error);
      return false;
    }
  }

  async keys(pattern: string): Promise<string[]> {
    if (!this.client || !this.isConnected) {
      return [];
    }

    try {
      return await this.client.keys(pattern);
    } catch (error) {
      this.logger.error(`Error getting keys with pattern ${pattern} from Redis`, error);
      return [];
    }
  }

  async flushAll(): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      return false;
    }

    try {
      await this.client.flushall();
      return true;
    } catch (error) {
      this.logger.error("Error flushing Redis", error);
      return false;
    }
  }

  // Additional Redis methods for analytics

  async incr(key: string): Promise<number> {
    if (!this.client || !this.isConnected) {
      return 0;
    }

    try {
      return await this.client.incr(key);
    } catch (error) {
      this.logger.error(`Error incrementing key ${key} in Redis`, error);
      return 0;
    }
  }

  async hset(key: string, field: string, value: any): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      return false;
    }

    try {
      const serialized = JSON.stringify(value);
      await this.client.hset(key, field, serialized);
      return true;
    } catch (error) {
      this.logger.error(`Error setting hash field ${field} for key ${key} in Redis`, error);
      return false;
    }
  }

  async hget(key: string, field: string): Promise<any> {
    if (!this.client || !this.isConnected) {
      return null;
    }

    try {
      const data = await this.client.hget(key, field);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      this.logger.error(`Error getting hash field ${field} for key ${key} from Redis`, error);
      return null;
    }
  }

  async hgetall(key: string): Promise<Record<string, any> | null> {
    if (!this.client || !this.isConnected) {
      return null;
    }

    try {
      return await this.client.hgetall(key);
    } catch (error) {
      this.logger.error(`Error getting all hash fields for key ${key} from Redis`, error);
      return null;
    }
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      return false;
    }

    try {
      await this.client.expire(key, seconds);
      return true;
    } catch (error) {
      this.logger.error(`Error setting expiration for key ${key} in Redis`, error);
      return false;
    }
  }

  async lpush(key: string, value: any): Promise<number> {
    if (!this.client || !this.isConnected) {
      return 0;
    }

    try {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      return await this.client.lpush(key, serialized);
    } catch (error) {
      this.logger.error(`Error pushing to list ${key} in Redis`, error);
      return 0;
    }
  }

  async rpush(key: string, value: any): Promise<number> {
    if (!this.client || !this.isConnected) {
      return 0;
    }

    try {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      return await this.client.rpush(key, serialized);
    } catch (error) {
      this.logger.error(`Error pushing to list ${key} in Redis`, error);
      return 0;
    }
  }

  async sadd(key: string, member: any): Promise<number> {
    if (!this.client || !this.isConnected) {
      return 0;
    }

    try {
      const serialized = typeof member === 'string' ? member : JSON.stringify(member);
      return await this.client.sadd(key, serialized);
    } catch (error) {
      this.logger.error(`Error adding to set ${key} in Redis`, error);
      return 0;
    }
  }

  async smembers(key: string): Promise<string[]> {
    if (!this.client || !this.isConnected) {
      return [];
    }

    try {
      return await this.client.smembers(key);
    } catch (error) {
      this.logger.error(`Error getting members from set ${key} in Redis`, error);
      return [];
    }
  }

  async zadd(key: string, score: number, member: any): Promise<number> {
    if (!this.client || !this.isConnected) {
      return 0;
    }

    try {
      const serialized = typeof member === 'string' ? member : JSON.stringify(member);
      return await this.client.zadd(key, score, serialized);
    } catch (error) {
      this.logger.error(`Error adding to sorted set ${key} in Redis`, error);
      return 0;
    }
  }

  async zrange(key: string, start: number, stop: number): Promise<string[]> {
    if (!this.client || !this.isConnected) {
      return [];
    }

    try {
      return await this.client.zrange(key, start, stop);
    } catch (error) {
      this.logger.error(`Error getting range from sorted set ${key} in Redis`, error);
      return [];
    }
  }

  async zrangebyscore(key: string, min: number, max: number): Promise<string[]> {
    if (!this.client || !this.isConnected) {
      return [];
    }

    try {
      return await this.client.zrangebyscore(key, min, max);
    } catch (error) {
      this.logger.error(`Error getting range by score from sorted set ${key} in Redis`, error);
      return [];
    }
  }

  async zremrangebyscore(key: string, min: number, max: number): Promise<number> {
    if (!this.client || !this.isConnected) {
      return 0;
    }

    try {
      return await this.client.zremrangebyscore(key, min, max);
    } catch (error) {
      this.logger.error(`Error removing range by score from sorted set ${key} in Redis`, error);
      return 0;
    }
  }
} 