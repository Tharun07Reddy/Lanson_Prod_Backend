import { Injectable, Logger } from "@nestjs/common";
import { RedisService } from "./cache/redis.service";

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(private readonly redisService: RedisService) {}

  async getHello(): Promise<string> {
    // Example of using Redis cache
    const cacheKey = "hello:world";
    
    // Try to get from cache first
    const cachedValue = await this.redisService.get<string>(cacheKey);
    if (cachedValue) {
      this.logger.log("Retrieved value from cache");
      return cachedValue;
    }
    
    // If not in cache, generate value and store it
    const value = "Hello World!";
    await this.redisService.set(cacheKey, value, 60); // Cache for 60 seconds
    this.logger.log("Stored value in cache");
    
    return value;
  }
}
