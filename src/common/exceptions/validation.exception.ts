import { HttpStatus } from "@nestjs/common";
import { AppException } from "./app.exception";

/**
 * Exception for validation errors
 * Use this for input validation failures
 */
export class ValidationException extends AppException {
  constructor(
    message: string = "Validation failed",
    validationErrors: Record<string, any>,
    requestId?: string,
  ) {
    super(
      message,
      HttpStatus.BAD_REQUEST,
      "VALIDATION_ERROR",
      { validationErrors },
      requestId,
    );
  }
} 