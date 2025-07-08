import { Injectable, Logger, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { TokenService } from './token.service';
import { SessionService } from './session.service';
import { User, UserStatus, UserSession } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RegisterDto, LoginDto, LoginResponseDto, UserResponseDto } from './dto/auth.dto';
import { AuthAnalyticsService, AuthEventType } from './analytics/auth-analytics.service';
import { VerificationService, VerificationType } from './verification/verification.service';
import { RoleService } from './role/role.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private userService: UserService,
    private tokenService: TokenService,
    private sessionService: SessionService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private analyticsService: AuthAnalyticsService,
    private verificationService: VerificationService,
    private roleService: RoleService,
  ) {}

  async register(registerDto: RegisterDto): Promise<User> {
    const { email, phone, password, username, firstName, lastName } = registerDto;

    // Check if user already exists with this email
    const existingUserByEmail = await this.userService.findByEmail(email);
    if (existingUserByEmail) {
      throw new BadRequestException('User with this email already exists');
    }

    // Check if user already exists with this phone
    const existingUserByPhone = await this.userService.findByPhone(phone);
    if (existingUserByPhone) {
      throw new BadRequestException('User with this phone number already exists');
    }

    // Check username if provided
    if (username) {
      const existingUsername = await this.userService.findByUsername(username);
      if (existingUsername) {
        throw new BadRequestException('Username is already taken');
      }
    }

    // Create new user
    const user = await this.userService.create({
      email,
      phone,
      password,
      username,
      firstName,
      lastName,
      status: UserStatus.PENDING_VERIFICATION,
    });

    // Assign default role to user
    await this.roleService.assignDefaultRoleToUser(user.id);

    // Track registration event
    await this.analyticsService.trackRegistration(user, {});

    // Send verification OTP via SMS
    try {
      await this.verificationService.generateAndSendOtp(
        user.id,
        VerificationType.PHONE,
        phone,
      );
    } catch (error) {
      this.logger.error(`Failed to send verification SMS: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Don't fail registration if SMS fails
    }

    return user;
  }

  async login(loginDto: LoginDto): Promise<LoginResponseDto> {
    const { email, phone, password, deviceId, deviceType, deviceName, ipAddress, userAgent, location } = loginDto;

    if (!email && !phone) {
      throw new BadRequestException('Either email or phone number is required');
    }

    // Find user by email or phone
    let user: User | null = null;
    
    if (email) {
      user = await this.userService.findByEmail(email);
    } else if (phone) {
      user = await this.userService.findByPhone(phone);
    }
    
    if (!user) {
      // Track failed login attempt
      await this.analyticsService.trackLoginFailure(
        email,
        phone,
        'User not found',
        { ipAddress, deviceId, deviceType, userAgent, location },
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is active
    if (user.status !== UserStatus.ACTIVE && user.status !== UserStatus.PENDING_VERIFICATION) {
      // Track failed login attempt
      await this.analyticsService.trackLoginFailure(
        email,
        phone,
        `Account status: ${user.status}`,
        { userId: user.id, ipAddress, deviceId, deviceType, userAgent, location },
      );
      throw new UnauthorizedException('Account is not active');
    }

    // Validate password
    if (!user.password) {
      // Track failed login attempt
      await this.analyticsService.trackLoginFailure(
        email,
        phone,
        'No password set for user',
        { userId: user.id, ipAddress, deviceId, deviceType, userAgent, location },
      );
      throw new UnauthorizedException('Invalid credentials');
    }
    
    const isPasswordValid = await this.userService.validatePassword(password, user.password);
    if (!isPasswordValid) {
      // Track failed login attempt
      await this.analyticsService.trackLoginFailure(
        email,
        phone,
        'Invalid password',
        { userId: user.id, ipAddress, deviceId, deviceType, userAgent, location },
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check for suspicious activity
    if (deviceId && ipAddress) {
      const isSuspicious = await this.analyticsService.checkSuspiciousActivity(
        user.id,
        ipAddress,
        deviceId,
        deviceType || 'unknown',
      );

      if (isSuspicious) {
        this.logger.warn(`Suspicious login detected for user ${user.id} from IP ${ipAddress} and device ${deviceId}`);
        // We could implement additional security measures here like requiring 2FA
      }
    }

    // Generate tokens
    const tokens = await this.tokenService.generateTokens(user, deviceId, deviceType);

    // Create session
    const expiresAt = new Date();
    expiresAt.setSeconds(
      expiresAt.getSeconds() + 
      this.configService.get<number>('SESSION_DURATION_SECONDS', 86400 * 7) // Default to 7 days
    );

    const session = await this.sessionService.createSession({
      userId: user.id,
      deviceId,
      deviceType,
      deviceName,
      ipAddress,
      userAgent,
      location,
      expiresAt,
    });

    // Update last login timestamp
    await this.userService.updateLastLogin(user.id);

    // Track successful login
    await this.analyticsService.trackLoginSuccess(user, {
      deviceId,
      deviceType,
      deviceName,
      ipAddress,
      userAgent,
      location,
      metadata: { sessionId: session.id },
    });

    // Return response
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      user: this.mapUserToUserResponse(user),
      sessionId: session.id,
    };
  }

  async refreshToken(token: string): Promise<LoginResponseDto | null> {
    const result = await this.tokenService.refreshAccessToken(token);
    
    if (!result) {
      return null;
    }
    
    // Find the user associated with this token
    const refreshToken = await this.tokenService.findRefreshTokenByToken(token);
    if (!refreshToken) {
      return null;
    }
    
    const user = await this.userService.findById(refreshToken.userId);
    if (!user) {
      return null;
    }
    
    // Update session activity
    const session = await this.sessionService.findSessionByToken(token);
    if (session) {
      await this.sessionService.updateSessionActivity(session.id);
    }

    // Track token refresh
    await this.analyticsService.trackTokenRefresh(user.id, {
      deviceId: refreshToken.deviceId ?? undefined,
      deviceType: refreshToken.deviceType ?? undefined,
    });
    
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
      user: this.mapUserToUserResponse(user),
      sessionId: session?.id,
    };
  }

  async logout(token: string): Promise<boolean> {
    try {
      // Find session and user before revoking
      const session = await this.sessionService.findSessionByToken(token);
      const refreshToken = await this.tokenService.findRefreshTokenByToken(token);
      
      // Revoke refresh token
      await this.tokenService.revokeRefreshToken(token);
      
      // Deactivate session
      if (session) {
        await this.sessionService.deactivateSession(session.id);
        
        // Track logout
        if (refreshToken) {
          await this.analyticsService.trackLogout(refreshToken.userId, {
            deviceId: refreshToken.deviceId ?? undefined,
            deviceType: refreshToken.deviceType ?? undefined,
            metadata: { sessionId: session.id }
          });
        }
      }
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to logout: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  async logoutAll(userId: string, currentToken?: string): Promise<boolean> {
    try {
      // Find current session if token provided
      let currentSessionId: string | undefined;
      
      if (currentToken) {
        const session = await this.sessionService.findSessionByToken(currentToken);
        if (session) {
          currentSessionId = session.id;
        }
      }
      
      // Revoke all refresh tokens except current one
      await this.tokenService.revokeAllUserRefreshTokens(userId, currentToken);
      
      // Deactivate all sessions except current one
      await this.sessionService.deactivateAllUserSessions(userId, currentSessionId);

      // Track logout all
      await this.analyticsService.trackEvent(AuthEventType.LOGOUT, {
        userId,
        success: true,
        metadata: { allSessions: true },
      });
      
      return true;
    } catch (error) {
      this.logger.error(`Error during logoutAll: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  validateToken(token: string): Record<string, any> | null {
    try {
      // JwtService.verify returns the decoded JWT payload
      return this.jwtService.verify(token);
    } catch (error) {
      this.logger.debug(`Token validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  async getActiveSessions(userId: string): Promise<UserSession[]> {
    return this.sessionService.getActiveSessions(userId);
  }

  private mapUserToUserResponse(user: User): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone ?? undefined,
      username: user.username ?? undefined,
      firstName: user.firstName ?? undefined,
      lastName: user.lastName ?? undefined,
      status: user.status,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      authProvider: user.authProvider,
      profilePicture: user.profilePicture ?? undefined,
      createdAt: user.createdAt,
    };
  }

  /**
   * Verify phone number after registration
   */
  async verifyPhoneAfterRegistration(
    phone: string,
    otp: string,
  ): Promise<{ success: boolean; message: string; user?: UserResponseDto }> {
    try {
      // Find user by phone
      const user = await this.userService.findByPhone(phone);
      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      // Verify OTP
      const verificationResult = await this.verificationService.verifyOtp(
        user.id,
        VerificationType.PHONE,
        otp,
      );

      if (!verificationResult.success) {
        return verificationResult;
      }

      // Update user status if needed
      if (user.status === UserStatus.PENDING_VERIFICATION) {
        await this.userService.setStatus(user.id, UserStatus.ACTIVE);
      }

      // Return success with user data
      const updatedUser = await this.userService.findById(user.id);
      if (!updatedUser) {
        return {
          success: true,
          message: 'Phone verified successfully',
        };
      }

      return {
        success: true,
        message: 'Phone verified successfully',
        user: this.mapUserToUserResponse(updatedUser),
      };
    } catch (error) {
      this.logger.error(
        `Failed to verify phone: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      
      return {
        success: false,
        message: 'Verification failed',
      };
    }
  }
} 