// Import Express types
import { Request } from 'express';

// For backward compatibility
export interface RequestWithId extends Request {
  id: string;
  requestId: string;
}

export interface RequestWithUser extends Request {
  user: {
    sub: string;
    email: string;
    username?: string;
    [key: string]: any;
  };
  deviceInfo?: {
    deviceType?: string;
    userAgent?: string;
    ipAddress?: string;
  };
}

// User type for JWT authentication
export interface JwtUser {
  sub: string;
  email: string;
  username?: string;
  [key: string]: any;
} 