import { HttpException, HttpStatus } from "@nestjs/common";

/**
 * Base exception class for application-specific exceptions
 */
export class AppException extends HttpException {
  /**
   * Error code for categorizing errors
   */
  public readonly errorCode: string;
  
  /**
   * Technical details for debugging (not exposed in production)
   */
  public readonly details?: Record<string, any>;
  
  /**
   * Stack trace
   */
  public readonly stack: string;
  
  /**
   * Timestamp when the error occurred
   */
  public readonly timestamp: string;
  
  /**
   * Request ID for tracing
   */
  public readonly requestId?: string;

  constructor(
    message: string,
    status: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
    errorCode: string = "INTERNAL_ERROR",
    details?: Record<string, any>,
    requestId?: string,
  ) {
    // Create response object with standardized format
    const response = {
      statusCode: status,
      message,
      errorCode,
      timestamp: new Date().toISOString(),
      requestId,
    };
    
    super(response, status);
    
    this.errorCode = errorCode;
    this.details = details;
    this.timestamp = response.timestamp;
    this.requestId = requestId;
    
    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }
} 