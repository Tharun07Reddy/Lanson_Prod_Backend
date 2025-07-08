import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";

/**
 * Middleware that adds a unique request ID to each request
 * This is an alternative to the RequestIdInterceptor
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    // Use existing request ID if present, otherwise generate a new one
    const requestId = (req.headers["x-request-id"] as string) || uuidv4();
    
    // Set request ID in request object for use in controllers
    req.requestId = requestId;
    
    // Set request ID in response headers
    res.setHeader("x-request-id", requestId);
    
    next();
  }
} 