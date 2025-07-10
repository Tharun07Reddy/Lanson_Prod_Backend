import { Request } from 'express';

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      id?: string;
      requestId?: string;
      user?: {
        id?: string;
        sub?: string;
        email?: string;
        username?: string;
        [key: string]: any;
      };
      analyticsId?: string;
      sessionId?: string;
      deviceInfo?: {
        deviceType?: string;
        userAgent?: string;
        ipAddress?: string;
      };
    }
  }
}

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