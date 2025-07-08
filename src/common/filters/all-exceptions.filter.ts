import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";
import { ConfigService } from "@nestjs/config";
import { AppException } from "../exceptions";
import { v4 as uuidv4 } from "uuid";
import { sendErrorResponse, ErrorResponse } from "../utils/error-response.util";

/**
 * Global exception filter that handles all exceptions
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);
  private readonly isProduction: boolean;

  constructor(private readonly configService: ConfigService) {
    this.isProduction = configService.get<string>("NODE_ENV") === "production";
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    try {
      const ctx = host.switchToHttp();
      const response = ctx.getResponse<Response>();
      const request = ctx.getRequest<Request>();
      
      // Generate a unique request ID for tracking
      let requestId = '';
      
      // Safely get the request ID
      if (request && request.headers) {
        const headerValue = request.headers['x-request-id'];
        if (typeof headerValue === 'string') {
          requestId = headerValue;
        }
      }
      
      // If no request ID found, generate a new one
      if (!requestId) {
        requestId = uuidv4();
      }
      
      // Get status code and error details
      const errorResult = this.getErrorDetails(exception, requestId);
      
      // Log the error
      this.logError(exception, request, errorResult.status, requestId);
      
      // Send the response
      sendErrorResponse(response, errorResult.status, errorResult.error);
    } catch (error) {
      // If we encounter an error in our error handler, log it and return a basic error
      this.logger.error('Error in exception filter', error);
      
      try {
        const response = host.switchToHttp().getResponse<Response>();
        sendErrorResponse(response, 500, {
          statusCode: 500,
          message: 'Internal server error',
          errorCode: 'INTERNAL_ERROR',
          timestamp: new Date().toISOString(),
        });
      } catch (finalError) {
        // At this point, we can't do anything more
        this.logger.error('Fatal error in exception filter', finalError);
      }
    }
  }

  private getErrorDetails(exception: unknown, requestId: string): { status: number; error: ErrorResponse } {
    // Default values
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let error: ErrorResponse = {
      statusCode: status,
      message: "Internal server error",
      errorCode: "INTERNAL_ERROR",
      timestamp: new Date().toISOString(),
      requestId,
    };

    try {
      if (exception instanceof AppException) {
        // Our custom application exception
        status = exception.getStatus();
        const exceptionResponse = exception.getResponse();
        
        // Type guard for response object
        if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
          error = exceptionResponse as ErrorResponse;
          
          // Add technical details for non-production environments
          if (!this.isProduction && exception.details) {
            error.details = exception.details;
          }
        }
      } else if (exception instanceof HttpException) {
        // NestJS HTTP exception
        status = exception.getStatus();
        const exceptionResponse = exception.getResponse();
        
        error = {
          statusCode: status,
          message: typeof exceptionResponse === "string" 
            ? exceptionResponse 
            : typeof exceptionResponse === 'object' && exceptionResponse !== null && 'message' in exceptionResponse
              ? String(exceptionResponse.message)
              : "An error occurred",
          errorCode: `HTTP_${status}`,
          timestamp: new Date().toISOString(),
          requestId,
        };
        
        // Add validation errors if available
        if (typeof exceptionResponse === "object" && 
            exceptionResponse !== null && 
            'errors' in exceptionResponse && 
            exceptionResponse.errors) {
          error.validationErrors = exceptionResponse.errors as Record<string, unknown>;
        }
      } else if (exception instanceof Error) {
        // Standard JavaScript Error
        error.message = exception.message;
        
        // Add stack trace for non-production environments
        if (!this.isProduction) {
          error.stack = exception.stack;
        }
      }
      
      return { status, error };
    } catch (err) {
      this.logger.error("Error in exception filter", err);
      return { status, error };
    }
  }

  private logError(exception: unknown, request: Request, status: number, requestId: string): void {
    const message = exception instanceof Error ? exception.message : "Unknown error";
    const stack = exception instanceof Error ? exception.stack : undefined;
    
    const logData = {
      timestamp: new Date().toISOString(),
      requestId,
      path: request.url,
      method: request.method,
      statusCode: status,
      message,
    };
    
    // Log as error for 5xx, warn for 4xx
    if (status >= 500) {
      this.logger.error(
        `[${requestId}] ${request.method} ${request.url} ${status} - ${message}`,
        stack,
        logData,
      );
    } else if (status >= 400) {
      this.logger.warn(
        `[${requestId}] ${request.method} ${request.url} ${status} - ${message}`,
        logData,
      );
    } else {
      this.logger.log(
        `[${requestId}] ${request.method} ${request.url} ${status} - ${message}`,
        logData,
      );
    }
  }
} 