// eslint-disable-next-line prettier/prettier
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// Define the query event type
interface QueryEvent {
  query: string;
  params: string;
  duration: number;
  target: string;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private connectionAttempts = 0;
  private readonly maxConnectionAttempts = 5;
  private readonly connectionRetryDelay = 5000; // 5 seconds

  constructor() {
    super({
      log: [
        { level: 'query', emit: 'event' },
        { level: 'error', emit: 'stdout' },
        { level: 'info', emit: 'stdout' },
        { level: 'warn', emit: 'stdout' },
      ],
      errorFormat: process.env.NODE_ENV === 'production' ? 'minimal' : 'colorless',
    });

    // Advanced query logging for development
    if (process.env.NODE_ENV !== 'production') {
      // Type assertion to access the $on method with proper typing
      (this as any).$on('query', (e: QueryEvent) => {
        this.logger.debug(`Query: ${e.query}`);
        this.logger.debug(`Duration: ${e.duration}ms`);
      });
    }
  }

  async onModuleInit() {
    await this.connectWithRetry();

    // Add middleware for performance monitoring in production
    this.$use(async (params, next) => {
      const startTime = Date.now();
      const result = await next(params);
      const endTime = Date.now();
      
      if (endTime - startTime > 1000) { // Log slow queries (>1s)
        this.logger.warn(`Slow query detected: ${params.model}.${params.action} - ${endTime - startTime}ms`);
      }
      
      return result;
    });
  }

  async onModuleDestroy() {
    this.logger.log('Shutting down Prisma connection...');
    await this.$disconnect();
  }

  private async connectWithRetry(): Promise<void> {
    try {
      this.logger.log('Connecting to database...');
      await this.$connect();
      this.logger.log('Successfully connected to database');
    } catch (error) {
      this.connectionAttempts++;
      
      if (this.connectionAttempts >= this.maxConnectionAttempts) {
        this.logger.error(`Failed to connect to database after ${this.maxConnectionAttempts} attempts`);
        this.logger.error(error);
        process.exit(1); // Exit the application if database connection fails
      }
      
      this.logger.warn(`Database connection attempt ${this.connectionAttempts} failed. Retrying in ${this.connectionRetryDelay / 1000}s...`);
      this.logger.debug(error);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, this.connectionRetryDelay));
      await this.connectWithRetry();
    }
  }
}
