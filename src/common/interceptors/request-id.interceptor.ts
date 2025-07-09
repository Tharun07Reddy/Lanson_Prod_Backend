import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { Request } from 'express';

// Instead of augmenting express, define a custom interface
export interface RequestWithId extends Request {
  id: string;
  requestId: string;
}

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() === 'http') {
      const request = context.switchToHttp().getRequest<RequestWithId>();
      const id = uuidv4();
      
      // Set request ID
      request.id = id;
      request.requestId = id;
      
      // Add request ID to response headers
      const response = context.switchToHttp().getResponse();
      response.setHeader('X-Request-ID', id);
    }
    
    return next.handle();
  }
} 