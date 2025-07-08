import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import * as http from "http";
import * as https from "https";

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly serverUrl: string;
  private readonly isProduction: boolean;

  constructor(private readonly configService: ConfigService) {
    // Get the server URL from environment variables or use localhost
    const baseUrl = this.configService.get<string>("SERVER_URL") || 
      `http://localhost:${this.configService.get<string>("PORT") || "3000"}`;
    
    // Use the health endpoint for pinging
    this.serverUrl = `${baseUrl}/health`;
    this.isProduction = this.configService.get<string>("NODE_ENV") === "production";
    
    this.logger.log(`Health service initialized. Ping URL: ${this.serverUrl}`);
  }

  /**
   * Keep the server awake by making a request every 30 seconds
   */
  @Cron("*/30 * * * * *") // Run every 30 seconds
  async keepServerAwake() {
    try {
      const startTime = Date.now();
      await this.pingServer();
      const responseTime = Date.now() - startTime;
      
      if (this.isProduction) {
        // In production, only log if there's an issue
        if (responseTime > 1000) { // If response time is greater than 1 second
          this.logger.warn(`Server ping took ${responseTime}ms`);
        }
      } else {
        // In development, log every ping
        this.logger.debug(`Server ping successful. Response time: ${responseTime}ms`);
      }
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`Failed to ping server: ${err.message}`, err.stack);
    }
  }

  /**
   * Ping the server to keep it awake
   */
  private pingServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      const isHttps = this.serverUrl.startsWith("https");
      const client = isHttps ? https : http;
      
      const req = client.get(this.serverUrl, (res) => {
        // Check if response is successful (2xx)
        const isSuccess = res.statusCode && res.statusCode >= 200 && res.statusCode < 300;
        
        if (!isSuccess) {
          reject(new Error(`Server responded with status code ${res.statusCode}`));
          return;
        }
        
        // Consume response data to free up memory
        res.resume();
        
        res.on("end", () => {
          resolve();
        });
      });
      
      req.on("error", (err) => {
        reject(err);
      });
      
      // Set timeout to 5 seconds
      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error("Request timed out"));
      });
    });
  }
} 