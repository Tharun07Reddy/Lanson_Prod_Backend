import { HttpStatus } from "@nestjs/common";
import { AppException } from "./app.exception";

/**
 * Exception for resource not found errors
 */
export class NotFoundException extends AppException {
  constructor(
    resource: string,
    identifier?: string | number,
    requestId?: string,
  ) {
    const message = identifier 
      ? `${resource} with identifier ${identifier} not found`
      : `${resource} not found`;
      
    super(
      message,
      HttpStatus.NOT_FOUND,
      "RESOURCE_NOT_FOUND",
      { resource, identifier },
      requestId,
    );
  }
} 