import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { Request, Response } from "express";

// interface RequestData {
//   method: string
//   url: string;
//   body?: unknown;
//   params?: unknown;
//   query?: unknown;
// }

/**
 * Interceptor that logs request and response details
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    
    // Extract request data with type safety
    const method = request.method;
    const url = request.url;
    const body = request.body as unknown;
    const params = request.params;
    const query = request.query;
    
    const requestId = request.requestId || "unknown";
    const userAgent = request.headers["user-agent"] || "unknown";
    const contentLength = request.headers["content-length"] || 0;
    
    const startTime = Date.now();
    
    // Log request
    this.logger.log({
      message: `Incoming request: ${method} ${url}`,
      requestId,
      method,
      url,
      userAgent,
      contentLength,
      body: this.sanitizeData(body),
      params: this.sanitizeData(params),
      query: this.sanitizeData(query),
    });
    
    return next.handle().pipe(
      tap({
        next: (data: unknown) => {
          const responseTime = Date.now() - startTime;
          const statusCode = response.statusCode;
          
          // Log successful response
          this.logger.log({
            message: `Response: ${statusCode} ${method} ${url} - ${responseTime}ms`,
            requestId,
            method,
            url,
            statusCode,
            responseTime,
            responseSize: JSON.stringify(data).length,
          });
        },
        error: (error: Error) => {
          const responseTime = Date.now() - startTime;
          const statusCode = response.statusCode || 500;
          
          // Log error response
          this.logger.error({
            message: `Error response: ${statusCode} ${method} ${url} - ${responseTime}ms`,
            requestId,
            method,
            url,
            statusCode,
            responseTime,
            error: error.message,
            stack: error.stack,
          });
        },
      }),
    );
  }
  
  /**
   * Sanitize sensitive data from logs
   */
  private sanitizeData(data: unknown): unknown {
    if (!data) return data;
    
    try {
      // Create a deep copy to avoid modifying the original
      const sanitized = JSON.parse(JSON.stringify(data)) as Record<string, unknown>;
      
      // List of sensitive fields to sanitize
      const sensitiveFields = [
        'password',
        'passwordConfirmation',
        'currentPassword',
        'newPassword',
        'token',
        'accessToken',
        'refreshToken',
        'secret',
        'apiKey',
        'authorization',
        'credit_card',
        'cardNumber',
        'cvv',
        'ssn',
      ];
      
      // Recursively sanitize objects
      const sanitizeObject = (obj: Record<string, unknown>): void => {
        for (const key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            // Check if the key is sensitive
            if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
              obj[key] = '[REDACTED]';
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
              // Recursively sanitize nested objects
              sanitizeObject(obj[key] as Record<string, unknown>);
            }
          }
        }
      };
      
      if (typeof sanitized === 'object' && sanitized !== null) {
        sanitizeObject(sanitized);
      }
      
      return sanitized;
    } catch (error: unknown) {
      this.logger.error('Error sanitizing data:', error);
      // If we can't stringify/parse the data, return it as is
      return data;
    }
  }
} 