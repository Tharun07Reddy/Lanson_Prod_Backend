import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Req, Get, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Request, Response } from 'express';
import { Public } from './decorators/public.decorator';
import { RegisterDto, LoginDto, RefreshTokenDto, LoginResponseDto, UserResponseDto } from './dto/auth.dto';
import { UserSession } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

// Define the user type for type assertions
interface JwtUser {
  sub: string;
  email: string;
  username?: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('register')
  async register(@Body() registerDto: RegisterDto): Promise<UserResponseDto> {
    // Register user
    const user = await this.authService.register(registerDto);
    
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

  @Public()
  @Post('verify-phone')
  @HttpCode(HttpStatus.OK)
  async verifyPhone(
    @Body() body: { phone: string; otp: string },
  ) {
    return this.authService.verifyPhoneAfterRegistration(body.phone, body.otp);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto, 
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ): Promise<LoginResponseDto> {
    // Extract IP and user agent from request
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];
    
    // Extract device info from middleware
    const deviceInfo = req.deviceInfo || {};
    
    // Combine DTO with request info
    const loginData: LoginDto = {
      ...loginDto,
      ipAddress,
      userAgent,
      deviceType: loginDto.deviceType || deviceInfo.deviceType,
    };
    
    const result = await this.authService.login(loginData);
    
    // Set session cookie
    if (result.sessionId) {
      const secure = this.configService.get<string>('NODE_ENV') === 'production';
      const domain = this.configService.get<string>('COOKIE_DOMAIN');
      
      res.cookie('session_id', result.sessionId, {
        httpOnly: true,
        secure,
        sameSite: 'lax',
        domain,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/',
      });
    }
    
    return result;
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() refreshTokenDto: RefreshTokenDto): Promise<LoginResponseDto | { success: boolean; message: string }> {
    const result = await this.authService.refreshToken(refreshTokenDto.refreshToken);
    
    if (!result) {
      return { success: false, message: 'Invalid or expired refresh token' };
    }
    
    return result;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async logout(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Res({ passthrough: true }) res: Response
  ): Promise<{ success: boolean }> {
    const success = await this.authService.logout(refreshTokenDto.refreshToken);
    
    // Clear session cookie
    res.clearCookie('session_id', {
      path: '/',
      domain: this.configService.get<string>('COOKIE_DOMAIN'),
    });
    
    return { success };
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async logoutAll(
    @Req() req: Request, 
    @Res({ passthrough: true }) res: Response,
    @Body() refreshTokenDto?: RefreshTokenDto
  ): Promise<{ success: boolean }> {
    // Type assertion for user
    const user = req.user as JwtUser;
    const userId = user.sub;
    const refreshToken = refreshTokenDto?.refreshToken;
    
    const success = await this.authService.logoutAll(userId, refreshToken);
    
    // Clear session cookie
    res.clearCookie('session_id', {
      path: '/',
      domain: this.configService.get<string>('COOKIE_DOMAIN'),
    });
    
    return { success };
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  async getSessions(@Req() req: Request): Promise<UserSession[]> {
    // Type assertion for user
    const user = req.user as JwtUser;
    const userId = user.sub;
    return this.authService.getActiveSessions(userId);
  }
} 