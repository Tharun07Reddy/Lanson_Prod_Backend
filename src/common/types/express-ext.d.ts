// Type definitions for Express extensions
import 'express';

// Extend Express namespace by declaration merging
declare global {
  namespace Express {
    // Extend Request interface
    interface Request {
      id?: string;
      requestId?: string;
      analyticsId?: string;
      sessionId?: string;
      deviceInfo?: {
        deviceType?: string;
        userAgent?: string;
        ipAddress?: string;
      };
      // Extend user property (already exists in Express.Request but we're adding our own properties)
      user?: {
        id?: string;
        sub?: string;
        email?: string;
        username?: string;
        [key: string]: any;
      };
    }
  }
} 