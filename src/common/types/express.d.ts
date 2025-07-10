// Type definitions for Express
// Extend Express Request interface

declare namespace Express {
  export interface Request {
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

// No need to export interfaces here as they're already in Express namespace 