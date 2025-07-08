import { HttpStatus } from "@nestjs/common";
import { AppException } from "./app.exception";

/**
 * Exception for business logic errors
 * Use this for expected errors that are part of the business logic
 */
export class BusinessException extends AppException {
  constructor(
    message: string,
    errorCode: string = "BUSINESS_ERROR",
    details?: Record<string, any>,
    requestId?: string,
  ) {
    super(
      message,
      HttpStatus.BAD_REQUEST,
      errorCode,
      details,
      requestId,
    );
  }
} 