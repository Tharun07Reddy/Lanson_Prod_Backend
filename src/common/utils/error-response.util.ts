import { Response } from "express";

/**
 * Interface for standardized error responses
 */
export interface ErrorResponse {
  statusCode: number;
  message: string;
  errorCode: string;
  timestamp: string;
  requestId: string;
  details?: Record<string, unknown>;
  validationErrors?: Record<string, unknown>;
  stack?: string;
  [key: string]: unknown;
}

/**
 * Safely sends an error response
 * This is a utility function to avoid TypeScript errors when sending error responses
 */
export function sendErrorResponse(
  response: Response, 
  statusCode: number, 
  errorObject: ErrorResponse | Record<string, unknown>
): void {
  response.status(statusCode).json(errorObject);
} 