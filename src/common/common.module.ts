import { Module, Global } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { AllExceptionsFilter } from "./filters";
import { RequestIdInterceptor, LoggingInterceptor } from "./interceptors";

/**
 * Global module for common functionality
 * This includes error handling, logging, and request tracking
 */
@Global()
@Module({
  imports: [
    ConfigModule,
  ],
  providers: [
    // Register global exception filter
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    // Register global request ID interceptor
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestIdInterceptor,
    },
    // Register global logging interceptor
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
  exports: [],
})
export class CommonModule {} 