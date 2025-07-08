import { Logger } from "@nestjs/common";
import { DatabaseException } from "../exceptions";

/**
 * Type for the result of an async operation
 */
export type AsyncResult<T> = Promise<[T | null, Error | null]>;

/**
 * Wraps an async function with try-catch and returns a tuple of [result, error]
 * This is a utility function to avoid try-catch blocks in every async function
 * 
 * @param promise The promise to wrap
 * @param errorMessage Optional error message to include in the log
 * @returns A tuple of [result, error]
 */
export async function tryCatch<T>(
  promise: Promise<T>,
  errorMessage?: string,
): AsyncResult<T> {
  try {
    const result = await promise;
    return [result, null];
  } catch (error) {
    // Log the error
    const logger = new Logger("TryCatch");
    logger.error(errorMessage || "An error occurred", error);
    
    return [null, error instanceof Error ? error : new Error(String(error))];
  }
}

/**
 * Wraps a database operation with try-catch and returns a tuple of [result, error]
 * This is specifically for database operations and will convert errors to DatabaseException
 * 
 * @param promise The database promise to wrap
 * @param errorMessage Optional error message to include in the log
 * @returns A tuple of [result, error]
 */
export async function tryCatchDb<T>(
  promise: Promise<T>,
  errorMessage?: string,
): AsyncResult<T> {
  try {
    const result = await promise;
    return [result, null];
  } catch (error) {
    // Log the error
    const logger = new Logger("TryCatchDb");
    logger.error(errorMessage || "Database error occurred", error);
    
    // Convert to DatabaseException
    const dbError = new DatabaseException(
      errorMessage || "Database operation failed",
      { originalError: error instanceof Error ? error.message : String(error) },
    );
    
    return [null, dbError];
  }
} 