import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../cache/redis.service';
import { UserService } from '../../user/user.service';
import { AuthAnalyticsService, AuthEventType } from '../analytics/auth-analytics.service';
import { SmsService } from '../../sms/sms.service';
import { MailService } from '../../mail/mail.service';
import { User } from '@prisma/client';

// OTP verification types
export enum VerificationType {
  EMAIL = 'EMAIL',
  PHONE = 'PHONE',
  PASSWORD_RESET = 'PASSWORD_RESET',
}

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly userService: UserService,
    private readonly smsService: SmsService,
    private readonly mailService: MailService,
    private readonly analyticsService: AuthAnalyticsService,
  ) {}

  /**
   * Generate and send OTP for verification
   */
  async generateAndSendOtp(
    userId: string,
    verificationType: VerificationType,
    destination: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Find user
      const user = await this.userService.findById(userId);
      if (!user) {
        throw new BadRequestException('User not found');
      }

      // Check if OTP already exists in cache
      const cacheKey = this.getCacheKey(userId, verificationType);
      const existingOtp = await this.redisService.get<{ otp: string; attempts: number }>(cacheKey);

      // If OTP exists and was generated less than 1 minute ago, don't allow resend yet
      if (existingOtp) {
        const lastSentKey = `${cacheKey}:lastSent`;
        const lastSent = await this.redisService.get<number>(lastSentKey);
        
        if (lastSent && Date.now() - lastSent < 60000) { // 1 minute cooldown
          return {
            success: false,
            message: 'Please wait before requesting another code',
          };
        }
      }

      // Generate new OTP
      const otp = this.generateOtp();
      
      // Store OTP in cache with TTL
      const ttlSeconds = this.configService.get<number>(
        verificationType === VerificationType.PHONE 
          ? 'PHONE_VERIFICATION_EXPIRATION' 
          : 'EMAIL_VERIFICATION_EXPIRATION',
        300, // Default 5 minutes
      );
      
      await this.redisService.set(
        cacheKey,
        { otp, attempts: 0 },
        ttlSeconds,
      );
      
      // Store last sent timestamp
      await this.redisService.set(
        `${cacheKey}:lastSent`,
        Date.now(),
        ttlSeconds,
      );

      // Send OTP based on verification type
      await this.sendOtp(user, verificationType, destination, otp);

      // Track event
      await this.trackVerificationEvent(user, verificationType, true);

      return {
        success: true,
        message: `Verification code sent to ${this.maskDestination(destination, verificationType)}`,
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate OTP for ${verificationType}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      
      return {
        success: false,
        message: 'Failed to send verification code',
      };
    }
  }

  /**
   * Verify OTP
   */
  async verifyOtp(
    userId: string,
    verificationType: VerificationType,
    otp: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Find user
      const user = await this.userService.findById(userId);
      if (!user) {
        throw new BadRequestException('User not found');
      }

      // Get OTP from cache
      const cacheKey = this.getCacheKey(userId, verificationType);
      const cachedData = await this.redisService.get<{ otp: string; attempts: number }>(cacheKey);

      if (!cachedData) {
        return {
          success: false,
          message: 'Verification code expired or not found',
        };
      }

      // Check max attempts
      const maxAttempts = this.configService.get<number>('VERIFICATION_MAX_ATTEMPTS', 3);
      if (cachedData.attempts >= maxAttempts) {
        // Delete the OTP to force regeneration
        await this.redisService.del(cacheKey);
        
        return {
          success: false,
          message: 'Too many failed attempts. Please request a new code',
        };
      }

      // Increment attempts
      await this.redisService.set(
        cacheKey,
        { ...cachedData, attempts: cachedData.attempts + 1 },
        this.configService.get<number>(
          verificationType === VerificationType.PHONE 
            ? 'PHONE_VERIFICATION_EXPIRATION' 
            : 'EMAIL_VERIFICATION_EXPIRATION',
          300,
        ),
      );

      // Verify OTP
      if (cachedData.otp !== otp) {
        return {
          success: false,
          message: 'Invalid verification code',
        };
      }

      // OTP is valid, update user verification status
      await this.updateVerificationStatus(user, verificationType);

      // Delete OTP from cache
      await this.redisService.del(cacheKey);

      // Track event
      await this.trackVerificationEvent(user, verificationType, true);

      return {
        success: true,
        message: 'Verification successful',
      };
    } catch (error) {
      this.logger.error(
        `Failed to verify OTP for ${verificationType}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      
      return {
        success: false,
        message: 'Verification failed',
      };
    }
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(
    email: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Find user by email
      const user = await this.userService.findByEmail(email);
      if (!user) {
        // Don't reveal that the email doesn't exist
        return {
          success: true,
          message: 'If your email is registered, you will receive a password reset code',
        };
      }

      // Generate and send OTP
      return this.generateAndSendOtp(
        user.id,
        VerificationType.PASSWORD_RESET,
        email,
      );
    } catch (error) {
      this.logger.error(
        `Failed to request password reset: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      
      return {
        success: false,
        message: 'Failed to process password reset request',
      };
    }
  }

  /**
   * Reset password with OTP
   */
  async resetPassword(
    email: string,
    otp: string,
    newPassword: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Find user by email
      const user = await this.userService.findByEmail(email);
      if (!user) {
        return {
          success: false,
          message: 'Invalid email address',
        };
      }

      // Verify OTP
      const verificationResult = await this.verifyOtp(
        user.id,
        VerificationType.PASSWORD_RESET,
        otp,
      );

      if (!verificationResult.success) {
        return verificationResult;
      }

      // Update password
      await this.userService.update(user.id, {
        password: newPassword,
        passwordChangedAt: new Date(),
      });

      // Track event
      await this.analyticsService.trackEvent(
        AuthEventType.PASSWORD_RESET_COMPLETE,
        {
          userId: user.id,
          email: user.email,
          success: true,
        },
      );

      return {
        success: true,
        message: 'Password has been reset successfully',
      };
    } catch (error) {
      this.logger.error(
        `Failed to reset password: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      
      return {
        success: false,
        message: 'Failed to reset password',
      };
    }
  }

  /**
   * Generate a random OTP code
   */
  private generateOtp(): string {
    const otpLength = this.configService.get<number>('PHONE_VERIFICATION_CODE_LENGTH', 6);
    let otp = '';
    
    for (let i = 0; i < otpLength; i++) {
      otp += Math.floor(Math.random() * 10).toString();
    }
    
    return otp;
  }

  /**
   * Send OTP via appropriate channel
   */
  private async sendOtp(
    user: User,
    verificationType: VerificationType,
    destination: string,
    otp: string,
  ): Promise<void> {
    const appName = this.configService.get<string>('APP_NAME', 'Landson');
    
    switch (verificationType) {
      case VerificationType.EMAIL:
        await this.mailService.sendMail(
          destination,
          `${appName} - Email Verification Code`,
          'email-verification', // Template name
          {
            appName,
            otp,
            userName: user.firstName || user.username || 'User',
            expiryMinutes: 5,
          }
        );
        break;
        
      case VerificationType.PHONE:
        await this.smsService.sendSms({
          to: destination,
          body: `${appName}: Your verification code is ${otp}. Valid for 5 minutes.`,
        });
        break;
        
      case VerificationType.PASSWORD_RESET:
        await this.mailService.sendMail(
          destination,
          `${appName} - Password Reset Code`,
          'password-reset', // Template name
          {
            appName,
            otp,
            userName: user.firstName || user.username || 'User',
            expiryMinutes: 5,
          }
        );
        break;
    }
  }

  /**
   * Update user verification status
   */
  private async updateVerificationStatus(
    user: User,
    verificationType: VerificationType,
  ): Promise<void> {
    switch (verificationType) {
      case VerificationType.EMAIL:
        await this.userService.verifyEmail(user.id);
        break;
        
      case VerificationType.PHONE:
        await this.userService.verifyPhone(user.id);
        break;
        
      // Password reset verification is handled separately
      case VerificationType.PASSWORD_RESET:
        break;
    }
  }

  /**
   * Track verification event
   */
  private async trackVerificationEvent(
    user: User,
    verificationType: VerificationType,
    success: boolean,
  ): Promise<void> {
    let eventType: AuthEventType;
    
    switch (verificationType) {
      case VerificationType.EMAIL:
        eventType = AuthEventType.EMAIL_VERIFICATION;
        break;
        
      case VerificationType.PHONE:
        eventType = AuthEventType.PHONE_VERIFICATION;
        break;
        
      case VerificationType.PASSWORD_RESET:
        eventType = AuthEventType.PASSWORD_RESET_REQUEST;
        break;
    }
    
    await this.analyticsService.trackEvent(eventType, {
      userId: user.id,
      email: user.email,
      phone: user.phone ?? undefined,
      success,
    });
  }

  /**
   * Get cache key for OTP
   */
  private getCacheKey(userId: string, verificationType: VerificationType): string {
    return `otp:${verificationType.toLowerCase()}:${userId}`;
  }

  /**
   * Mask sensitive information
   */
  private maskDestination(destination: string, type: VerificationType): string {
    if (type === VerificationType.EMAIL) {
      const [username, domain] = destination.split('@');
      const maskedUsername = username.substring(0, 2) + '***' + username.substring(username.length - 2);
      return `${maskedUsername}@${domain}`;
    } else {
      // Phone number
      return destination.substring(0, 4) + '******' + destination.substring(destination.length - 2);
    }
  }
} 