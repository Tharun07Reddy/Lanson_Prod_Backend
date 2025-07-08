import { registerAs } from "@nestjs/config";
import { CacheModuleOptions } from "@nestjs/cache-manager";
import * as redisStore from "cache-manager-redis-store";
import { Redis } from "ioredis";
import { Logger } from "@nestjs/common";

const logger = new Logger("RedisCache");

// Redis connection options with production-grade settings for Upstash
export const createRedisClient = () => {
  const redisUrl = process.env.REDIS_URL;
  const redisToken = process.env.REDIS_TOKEN;
  
  if (!redisUrl) {
    logger.warn("REDIS_URL not provided. Redis cache will not be available.");
    return null;
  }
  
  try {
    logger.log("Creating Redis client...");
    
    // Direct connection for Upstash Redis
    if (redisUrl.startsWith("https://")) {
      // For Upstash, we need to use their specific format
      const client = new Redis({
        host: redisUrl.replace("https://", ""),
        port: 6379,
        password: redisToken,
        tls: {},
        connectTimeout: 10000,
        maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES || "3", 10),
        retryStrategy: (times) => {
          if (times > parseInt(process.env.REDIS_MAX_RETRIES || "3", 10)) {
            logger.error("Max Redis connection retries reached. Giving up.");
            return null; // Stop retrying
          }
          const delay = Math.min(times * 1000, 30000);
          logger.log(`Redis connection retry in ${delay}ms...`);
          return delay;
        }
      });
      
      // Set up event handlers
      client.on("connect", () => logger.log("Connecting to Upstash Redis..."));
      client.on("ready", () => logger.log("Upstash Redis connection established successfully"));
      client.on("error", (err) => logger.error(`Redis error: ${err.message}`, err.stack));
      client.on("close", () => logger.warn("Redis connection closed"));
      
      return client;
    } else {
      // Standard Redis connection
      const client = new Redis(redisUrl, {
        maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES || "3", 10),
        connectTimeout: 10000,
        retryStrategy: (times) => {
          if (times > parseInt(process.env.REDIS_MAX_RETRIES || "3", 10)) {
            return null; // Stop retrying
          }
          return Math.min(times * 1000, 30000);
        }
      });
      
      // Set up event handlers
      client.on("connect", () => logger.log("Connecting to Redis..."));
      client.on("ready", () => logger.log("Redis connection established successfully"));
      client.on("error", (err) => logger.error(`Redis error: ${err.message}`, err.stack));
      client.on("close", () => logger.warn("Redis connection closed"));
      
      return client;
    }
  } catch (error) {
    logger.error("Failed to create Redis client:", error);
    return null;
  }
};

export default registerAs("cache", (): CacheModuleOptions => {
  const ttl = parseInt(process.env.REDIS_DEFAULT_TTL || "3600", 10) * 1000; // Default 1 hour
  const max = parseInt(process.env.CACHE_MAX_ITEMS || "1000", 10); // Default 1000 items
  const prefix = process.env.REDIS_PREFIX || "ecommerce:";
  
  return {
    isGlobal: true,
    // Use Redis in production, memory store in development if Redis is not available
    store: process.env.REDIS_URL 
      ? redisStore 
      : "memory",
    ttl,
    max,
    // Redis specific options
    ...(process.env.REDIS_URL ? {
      redisInstance: createRedisClient(),
      // Key prefix for all cache entries
      prefix,
    } : {}),
  };
});
