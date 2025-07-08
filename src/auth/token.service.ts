import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { RefreshToken, User } from '@prisma/client';
import * as crypto from 'crypto';

interface TokenPayload {
  sub: string;
  email: string;
  username?: string;
  phone?: string;
}

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  async generateTokens(user: User, deviceId?: string, deviceType?: string): Promise<TokenResponse> {
    // Generate access token
    const payload: TokenPayload = {
      sub: user.id,
      email: user.email,
      username: user.username ?? undefined,
      phone: user.phone ?? undefined,
    };

    const accessToken = this.jwtService.sign(payload);
    
    // Generate refresh token
    const refreshToken = await this.createRefreshToken(user.id, deviceId, deviceType);
    
    // Get expiration time from config or use default
    const expiresIn = this.getAccessTokenExpirationSeconds();

    return {
      accessToken,
      refreshToken: refreshToken.token,
      expiresIn,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<TokenResponse | null> {
    try {
      // Find the refresh token in the database
      const token = await this.findRefreshTokenByToken(refreshToken);
      
      if (!token || token.isRevoked || new Date() > token.expiresAt) {
        return null;
      }
      
      // Get the user
      const user = await this.prisma.user.findUnique({
        where: { id: token.userId },
      });
      
      if (!user) {
        return null;
      }
      
      // Generate new access token
      const payload: TokenPayload = {
        sub: user.id,
        email: user.email,
        username: user.username ?? undefined,
        phone: user.phone ?? undefined,
      };
      
      const accessToken = this.jwtService.sign(payload);
      
      // Rotate refresh token if configured to do so
      if (this.configService.get<boolean>('JWT_REFRESH_ROTATION', true)) {
        await this.rotateRefreshToken(token.id);
      }
      
      // Get expiration time from config or use default
      const expiresIn = this.getAccessTokenExpirationSeconds();
      
      return {
        accessToken,
        refreshToken: token.token,
        expiresIn,
      };
    } catch (error) {
      this.logger.error(`Error refreshing access token: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  async createRefreshToken(
    userId: string,
    deviceId?: string,
    deviceType?: string,
  ): Promise<RefreshToken> {
    const token = this.generateRefreshToken();
    const expiresAt = new Date();
    expiresAt.setSeconds(
      expiresAt.getSeconds() + this.getRefreshTokenExpirationSeconds(),
    );

    try {
      return await this.prisma.refreshToken.create({
        data: {
          userId,
          token,
          deviceId,
          deviceType,
          expiresAt,
          isRevoked: false,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to create refresh token: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  async findRefreshTokenByToken(token: string): Promise<RefreshToken | null> {
    try {
      return await this.prisma.refreshToken.findUnique({
        where: { token },
      });
    } catch (error) {
      this.logger.error(`Failed to find refresh token: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  async revokeRefreshToken(token: string): Promise<boolean> {
    try {
      await this.prisma.refreshToken.update({
        where: { token },
        data: { isRevoked: true },
      });
      return true;
    } catch (error) {
      this.logger.error(`Failed to revoke refresh token: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  async revokeAllUserRefreshTokens(userId: string, exceptTokenId?: string): Promise<number> {
    try {
      const result = await this.prisma.refreshToken.updateMany({
        where: {
          userId,
          isRevoked: false,
          ...(exceptTokenId && { id: { not: exceptTokenId } }),
        },
        data: { isRevoked: true },
      });
      return result.count;
    } catch (error) {
      this.logger.error(`Failed to revoke all user refresh tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return 0;
    }
  }

  async rotateRefreshToken(id: string): Promise<RefreshToken | null> {
    try {
      const oldToken = await this.prisma.refreshToken.findUnique({
        where: { id },
      });
      
      if (!oldToken || oldToken.isRevoked) {
        return null;
      }
      
      const newToken = this.generateRefreshToken();
      
      // Create new refresh token
      const expiresAt = new Date();
      expiresAt.setSeconds(
        expiresAt.getSeconds() + this.getRefreshTokenExpirationSeconds(),
      );
      
      const refreshToken = await this.prisma.refreshToken.create({
        data: {
          userId: oldToken.userId,
          token: newToken,
          deviceId: oldToken.deviceId,
          deviceType: oldToken.deviceType,
          expiresAt,
          isRevoked: false,
        },
      });
      
      // Revoke old token
      await this.prisma.refreshToken.update({
        where: { id },
        data: {
          isRevoked: true,
          replacedByToken: refreshToken.id,
        },
      });
      
      return refreshToken;
    } catch (error) {
      this.logger.error(`Failed to rotate refresh token: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  async cleanupExpiredRefreshTokens(): Promise<number> {
    try {
      const result = await this.prisma.refreshToken.updateMany({
        where: {
          isRevoked: false,
          expiresAt: { lt: new Date() },
        },
        data: { isRevoked: true },
      });
      return result.count;
    } catch (error) {
      this.logger.error(`Failed to cleanup expired refresh tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return 0;
    }
  }

  private generateRefreshToken(): string {
    return crypto.randomBytes(40).toString('hex');
  }

  private getAccessTokenExpirationSeconds(): number {
    const expiration = this.configService.get<string>('JWT_EXPIRATION', '15m');
    return this.parseTimeToSeconds(expiration);
  }

  private getRefreshTokenExpirationSeconds(): number {
    const expiration = this.configService.get<string>('JWT_REFRESH_EXPIRATION', '7d');
    return this.parseTimeToSeconds(expiration);
  }

  private parseTimeToSeconds(time: string): number {
    const regex = /^(\d+)([smhd])$/;
    const match = time.match(regex);
    
    if (!match) {
      return 900; // Default to 15 minutes
    }
    
    const value = parseInt(match[1], 10);
    const unit = match[2];
    
    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 60 * 60;
      case 'd':
        return value * 24 * 60 * 60;
      default:
        return 900; // Default to 15 minutes
    }
  }
} 