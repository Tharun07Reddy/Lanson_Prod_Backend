import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { Logger } from "@nestjs/common";
import { PrismaService } from "./database/prisma.service";
import { RedisService } from "./cache/redis.service";

async function bootstrap() {
  const logger = new Logger("Bootstrap");
  try {
    // Create the application
    const app = await NestFactory.create(AppModule);

    // Get the PrismaService instance
    const prismaService = app.get(PrismaService);

    // Test database connection before starting the server
    try {
      // This will throw an error if the connection fails
      await prismaService.$connect();
      logger.log("Database connection established successfully");
    } catch (dbError) {
      logger.error(
        "Failed to connect to the database. Application will not start.",
      );
      logger.error(dbError);
      await app.close();
      process.exit(1);
    }

    // Check Redis connection if REDIS_URL is provided
    if (process.env.REDIS_URL) {
      const redisService = app.get(RedisService);
      const redisClient = redisService.getClient();
      
      if (!redisClient) {
        logger.warn("Redis client not available. Continuing without Redis cache.");
      } else {
        logger.log("Redis connection established successfully");
      }
    }

    // Enable shutdown hooks for graceful shutdown
    process.on("beforeExit", () => {
      logger.log("Application shutting down...");
      void app.close();
    });

    // Start the server only if database connection is successful
    const port = process.env.PORT ?? 3000;
    await app.listen(port);
    logger.log(`Application is running on: http://localhost:${port}`);
  } catch (error) {
    logger.error("Error starting application:", error);
    process.exit(1);
  }
}

void bootstrap();
