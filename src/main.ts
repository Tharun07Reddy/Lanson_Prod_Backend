import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { Logger, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import helmet from "helmet";
import * as compression from "compression";
import * as cookieParser from "cookie-parser";
import { PrismaService } from "./database/prisma.service";

async function bootstrap() {
  const logger = new Logger("Bootstrap");
  
  try {
    // Create the application
    const app = await NestFactory.create(AppModule, {
      logger: ["error", "warn", "log", "debug", "verbose"],
    });

    // Get config service
    const configService = app.get(ConfigService);

    // Get the PrismaService instance
    const prismaService = app.get(PrismaService);
    
    // Enable shutdown hooks for Prisma
    await prismaService.enableShutdownHooks(app);

    // Set global prefix if configured
    const apiPrefix = configService.get<string>("API_PREFIX");
    if (apiPrefix) {
      app.setGlobalPrefix(apiPrefix);
    }

    // Configure CORS
    app.enableCors({
      origin: configService.get<string>("CORS_ORIGIN", "*"),
      methods: configService.get<string>("CORS_METHODS", "GET,HEAD,PUT,PATCH,POST,DELETE"),
      credentials: configService.get<boolean>("CORS_CREDENTIALS", true),
      preflightContinue: false,
      optionsSuccessStatus: 204,
    });

    // Security and performance middleware
    app.use(helmet());
    app.use(compression());
    app.use(cookieParser());

    // Enable validation pipes
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    // Start the server
    const port = process.env.PORT || configService.get<number>("PORT", 3000);
    const host = configService.get<string>("HOST", "0.0.0.0");

    await app.listen(port, host);
    logger.log(`Application is running on: ${await app.getUrl()}`);
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.error(`Error starting application: ${error.message}`, error.stack);
    } else {
      logger.error("Unknown error starting application");
    }
    process.exit(1);
  }
}

bootstrap();
