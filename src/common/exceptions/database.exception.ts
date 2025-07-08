import { HttpStatus } from "@nestjs/common";
import { AppException } from "./app.exception";

/**
 * Exception for database errors
 */
export class DatabaseException extends AppException {
  constructor(
    message: string = "Database operation failed",
    details?: Record<string, any>,
    requestId?: string,
  ) {
    super(
      message,
      HttpStatus.INTERNAL_SERVER_ERROR,
      "DATABASE_ERROR",
      details,
      requestId,
    );
  }
  
  /**
   * Create an exception for a unique constraint violation
   */
  static uniqueConstraint(
    field: string,
    value?: string | number,
    requestId?: string,
  ): DatabaseException {
    const message = value 
      ? `A record with ${field} = ${value} already exists`
      : `A record with this ${field} already exists`;
      
    return new DatabaseException(
      message,
      { field, value, constraint: "unique" },
      requestId,
    );
  }
  
  /**
   * Create an exception for a foreign key constraint violation
   */
  static foreignKey(
    field: string,
    value?: string | number,
    requestId?: string,
  ): DatabaseException {
    const message = value 
      ? `Referenced record with ${field} = ${value} does not exist`
      : `Referenced record does not exist`;
      
    return new DatabaseException(
      message,
      { field, value, constraint: "foreign_key" },
      requestId,
    );
  }
} 