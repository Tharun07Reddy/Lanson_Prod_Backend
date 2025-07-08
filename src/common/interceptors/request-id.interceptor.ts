import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { v4 as uuidv4 } from "uuid";
import { Request, Response } from "express";

/**
 * Extend Express Request interface to include requestId
 */
declare module "express" {
  interface Request {
    requestId?: string;
  }
}

/**
 * Interceptor that adds a unique request ID to each request
 * This helps with tracing requests across the system
 */
@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    
    // Use existing request ID if present, otherwise generate a new one
    const requestId = (request.headers["x-request-id"] as string) || uuidv4();
    
    // Set request ID in request object for use in controllers
    request.requestId = requestId;
    
    // Set request ID in response headers
    response.setHeader("x-request-id", requestId);
    
    return next.handle();
  }
} 