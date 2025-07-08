import { Module, Global } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { CacheModule, CacheModuleOptions } from "@nestjs/cache-manager";
import { RedisService } from "./redis.service";
import cacheConfig from "../config/cache.config";

@Global()
@Module({
  imports: [
    ConfigModule.forFeature(cacheConfig),
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService): CacheModuleOptions => {
        return configService.get<CacheModuleOptions>("cache") || {};
      },
    }),
  ],
  providers: [RedisService],
  exports: [CacheModule, RedisService],
})
export class CacheConfigModule {} 