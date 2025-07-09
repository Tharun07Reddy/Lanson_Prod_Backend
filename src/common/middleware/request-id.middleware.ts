import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { RequestWithId } from '../interceptors/request-id.interceptor';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: RequestWithId, res: Response, next: NextFunction) {
    // Use existing request ID if present, otherwise generate a new one
    const id = (req.headers['x-request-id'] as string) || uuidv4();
    
    // Set request ID in request object
    req.id = id;
    req.requestId = id;
    
    // Set request ID in response headers
    res.setHeader('X-Request-ID', id);
    
    next();
  }
} 