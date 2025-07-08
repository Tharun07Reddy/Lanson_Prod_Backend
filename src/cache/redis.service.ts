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
} 