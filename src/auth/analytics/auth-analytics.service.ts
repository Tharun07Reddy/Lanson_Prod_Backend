import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { User } from '@prisma/client';

// Define event types
export enum AuthEventType {
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILURE = 'LOGIN_FAILURE',
  REGISTRATION = 'REGISTRATION',
  PASSWORD_RESET_REQUEST = 'PASSWORD_RESET_REQUEST',
  PASSWORD_RESET_COMPLETE = 'PASSWORD_RESET_COMPLETE',
  EMAIL_VERIFICATION = 'EMAIL_VERIFICATION',
  PHONE_VERIFICATION = 'PHONE_VERIFICATION',
  LOGOUT = 'LOGOUT',
  TOKEN_REFRESH = 'TOKEN_REFRESH',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
}

// Define event data interface
export interface AuthEventData {
  userId?: string;
  email?: string;
  phone?: string;
  deviceId?: string;
  deviceType?: string;
  ipAddress?: string;
  userAgent?: string;
  location?: string;
  deviceName?: string;
  success?: boolean;
  failureReason?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class AuthAnalyticsService {
  private readonly logger = new Logger(AuthAnalyticsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Track an authentication event
   */
  async trackEvent(
    eventType: AuthEventType,
    eventData: AuthEventData,
  ): Promise<void> {
    try {
      // Create event record in database
      await this.prisma.authEvent.create({
        data: {
          eventType,
          userId: eventData.userId,
          email: eventData.email,
          phone: eventData.phone,
          deviceId: eventData.deviceId,
          deviceType: eventData.deviceType,
          ipAddress: eventData.ipAddress,
          userAgent: eventData.userAgent,
          location: eventData.location,
          success: eventData.success,
          failureReason: eventData.failureReason,
          metadata: eventData.metadata,
        },
      });
    } catch (error) {
      // Log error but don't fail the operation
      this.logger.error(
        `Failed to track auth event ${eventType}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Track login success
   */
  async trackLoginSuccess(user: User, eventData: AuthEventData): Promise<void> {
    await this.trackEvent(AuthEventType.LOGIN_SUCCESS, {
      userId: user.id,
      email: user.email,
      phone: user.phone ?? undefined,
      success: true,
      ...eventData,
    });
  }

  /**
   * Track login failure
   */
  async trackLoginFailure(
    email: string | undefined,
    phone: string | undefined,
    failureReason: string,
    eventData: AuthEventData,
  ): Promise<void> {
    await this.trackEvent(AuthEventType.LOGIN_FAILURE, {
      email,
      phone,
      success: false,
      failureReason,
      ...eventData,
    });
  }

  /**
   * Track registration
   */
  async trackRegistration(user: User, eventData: AuthEventData): Promise<void> {
    await this.trackEvent(AuthEventType.REGISTRATION, {
      userId: user.id,
      email: user.email,
      phone: user.phone ?? undefined,
      success: true,
      ...eventData,
    });
  }

  /**
   * Track logout
   */
  async trackLogout(userId: string, eventData: AuthEventData): Promise<void> {
    await this.trackEvent(AuthEventType.LOGOUT, {
      userId,
      success: true,
      ...eventData,
    });
  }

  /**
   * Track token refresh
   */
  async trackTokenRefresh(userId: string, eventData: AuthEventData): Promise<void> {
    await this.trackEvent(AuthEventType.TOKEN_REFRESH, {
      userId,
      success: true,
      ...eventData,
    });
  }

  /**
   * Track suspicious activity
   */
  async trackSuspiciousActivity(
    userId: string | undefined,
    email: string | undefined,
    phone: string | undefined,
    reason: string,
    eventData: AuthEventData,
  ): Promise<void> {
    await this.trackEvent(AuthEventType.SUSPICIOUS_ACTIVITY, {
      userId,
      email,
      phone,
      success: false,
      failureReason: reason,
      ...eventData,
    });
  }

  /**
   * Get login attempts for a user within a time window
   */
  async getLoginAttempts(
    identifier: { email?: string; phone?: string; userId?: string },
    windowMinutes: number = 5,
  ): Promise<number> {
    const windowDate = new Date();
    windowDate.setMinutes(windowDate.getMinutes() - windowMinutes);

    const count = await this.prisma.authEvent.count({
      where: {
        eventType: AuthEventType.LOGIN_FAILURE,
        createdAt: { gte: windowDate },
        OR: [
          { email: identifier.email },
          { phone: identifier.phone },
          { userId: identifier.userId },
        ],
      },
    });

    return count;
  }

  /**
   * Check for suspicious login patterns
   */
  async checkSuspiciousActivity(
    userId: string,
    ipAddress: string,
    deviceId: string,
    deviceType: string,
  ): Promise<boolean> {
    // Get user's recent successful logins
    const recentLogins = await this.prisma.authEvent.findMany({
      where: {
        userId,
        eventType: AuthEventType.LOGIN_SUCCESS,
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
    });

    // Check if this is a new device/location
    const hasUsedDeviceBefore = recentLogins.some(
      (login) => login.deviceId === deviceId || login.ipAddress === ipAddress,
    );

    // If new device and user has logged in before from other devices, flag as suspicious
    if (!hasUsedDeviceBefore && recentLogins.length > 0) {
      await this.trackSuspiciousActivity(
        userId,
        undefined,
        undefined,
        'Login from new device/location',
        {
          userId,
          ipAddress,
          deviceId,
          deviceType,
          metadata: {
            knownDevices: recentLogins.map((l) => ({
              deviceId: l.deviceId,
              ipAddress: l.ipAddress,
              deviceType: l.deviceType,
            })),
          },
        },
      );
      return true;
    }

    return false;
  }
} 