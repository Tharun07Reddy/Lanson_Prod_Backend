import { HttpStatus } from "@nestjs/common";
import { AppException } from "./app.exception";

/**
 * Exception for authentication errors
 */
export class UnauthorizedException extends AppException {
  constructor(
    message: string = "Unauthorized access",
    errorCode: string = "UNAUTHORIZED",
    details?: Record<string, any>,
    requestId?: string,
  ) {
    super(
      message,
      HttpStatus.UNAUTHORIZED,
      errorCode,
      details,
      requestId,
    );
  }
} 