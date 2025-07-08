import { HttpStatus } from "@nestjs/common";
import { AppException } from "./app.exception";

/**
 * Exception for authorization errors
 */
export class ForbiddenException extends AppException {
  constructor(
    message: string = "Access forbidden",
    errorCode: string = "FORBIDDEN",
    details?: Record<string, any>,
    requestId?: string,
  ) {
    super(
      message,
      HttpStatus.FORBIDDEN,
      errorCode,
      details,
      requestId,
    );
  }
} 