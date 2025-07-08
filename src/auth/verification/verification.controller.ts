import { Controller, Post, Body, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { VerificationService } from './verification.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { Public } from '../decorators/public.decorator';
import { Request } from 'express';
import { SendOtpDto, VerifyOtpDto, RequestPasswordResetDto, ResetPasswordDto } from '../dto/verification.dto';

interface RequestWithUser extends Request {
  user: {
    sub: string;
    email: string;
  };
}

@Controller('auth/verification')
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @UseGuards(JwtAuthGuard)
  @Post('send-otp')
  @HttpCode(HttpStatus.OK)
  async sendOtp(
    @Body() sendOtpDto: SendOtpDto,
    @Req() req: RequestWithUser,
  ) {
    const userId = req.user.sub;
    return this.verificationService.generateAndSendOtp(
      userId,
      sendOtpDto.type,
      sendOtpDto.destination,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(
    @Body() verifyOtpDto: VerifyOtpDto,
    @Req() req: RequestWithUser,
  ) {
    const userId = req.user.sub;
    return this.verificationService.verifyOtp(
      userId,
      verifyOtpDto.type,
      verifyOtpDto.otp,
    );
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body() requestPasswordResetDto: RequestPasswordResetDto,
  ) {
    return this.verificationService.requestPasswordReset(
      requestPasswordResetDto.email,
    );
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() resetPasswordDto: ResetPasswordDto,
  ) {
    return this.verificationService.resetPassword(
      resetPasswordDto.email,
      resetPasswordDto.otp,
      resetPasswordDto.newPassword,
    );
  }
} 