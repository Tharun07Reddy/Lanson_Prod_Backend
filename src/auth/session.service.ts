import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { UserSession, Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(private prisma: PrismaService) {}

  async createSession(data: {
    userId: string;
    deviceId?: string;
    deviceType?: string;
    deviceName?: string;
    ipAddress?: string;
    userAgent?: string;
    location?: string;
    expiresAt: Date;
  }): Promise<UserSession> {
    const token = this.generateSessionToken();
    
    try {
      return await this.prisma.userSession.create({
        data: {
          ...data,
          token,
          isActive: true,
          lastActiveAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(`Failed to create session: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findSessionById(id: string): Promise<UserSession | null> {
    try {
      return await this.prisma.userSession.findUnique({
        where: { id },
      });
    } catch (error) {
      this.logger.error(`Failed to find session by ID: ${error.message}`, error.stack);
      return null;
    }
  }

  async findSessionByToken(token: string): Promise<UserSession | null> {
    try {
      return await this.prisma.userSession.findUnique({
        where: { token },
      });
    } catch (error) {
      this.logger.error(`Failed to find session by token: ${error.message}`, error.stack);
      return null;
    }
  }

  async getActiveSessions(userId: string): Promise<UserSession[]> {
    try {
      return await this.prisma.userSession.findMany({
        where: {
          userId,
          isActive: true,
          expiresAt: { gt: new Date() },
        },
        orderBy: { lastActiveAt: 'desc' },
      });
    } catch (error) {
      this.logger.error(`Failed to get active sessions: ${error.message}`, error.stack);
      return [];
    }
  }

  async updateSessionActivity(id: string): Promise<UserSession | null> {
    try {
      return await this.prisma.userSession.update({
        where: { id },
        data: { lastActiveAt: new Date() },
      });
    } catch (error) {
      this.logger.error(`Failed to update session activity: ${error.message}`, error.stack);
      return null;
    }
  }

  async deactivateSession(id: string): Promise<UserSession | null> {
    try {
      return await this.prisma.userSession.update({
        where: { id },
        data: { isActive: false },
      });
    } catch (error) {
      this.logger.error(`Failed to deactivate session: ${error.message}`, error.stack);
      return null;
    }
  }

  async deactivateAllUserSessions(userId: string, exceptSessionId?: string): Promise<number> {
    try {
      const result = await this.prisma.userSession.updateMany({
        where: {
          userId,
          isActive: true,
          ...(exceptSessionId && { id: { not: exceptSessionId } }),
        },
        data: { isActive: false },
      });
      return result.count;
    } catch (error) {
      this.logger.error(`Failed to deactivate all user sessions: ${error.message}`, error.stack);
      return 0;
    }
  }

  async cleanupExpiredSessions(): Promise<number> {
    try {
      const result = await this.prisma.userSession.updateMany({
        where: {
          isActive: true,
          expiresAt: { lt: new Date() },
        },
        data: { isActive: false },
      });
      return result.count;
    } catch (error) {
      this.logger.error(`Failed to cleanup expired sessions: ${error.message}`, error.stack);
      return 0;
    }
  }

  private generateSessionToken(): string {
    return crypto.createHash('sha256').update(uuidv4()).digest('hex');
  }
} 