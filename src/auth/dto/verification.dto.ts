import { IsEmail, IsString, IsEnum, IsNotEmpty, MinLength, Matches } from 'class-validator';
import { VerificationType } from '../verification/verification.service';

export class SendOtpDto {
  @IsNotEmpty()
  @IsString()
  destination: string;

  @IsNotEmpty()
  @IsEnum(VerificationType)
  type: VerificationType;
}

export class VerifyOtpDto {
  @IsNotEmpty()
  @IsString()
  @Matches(/^[0-9]+$/, { message: 'OTP must contain only numbers' })
  otp: string;

  @IsNotEmpty()
  @IsEnum(VerificationType)
  type: VerificationType;
}

export class RequestPasswordResetDto {
  @IsNotEmpty()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;
}

export class ResetPasswordDto {
  @IsNotEmpty()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @IsNotEmpty()
  @IsString()
  @Matches(/^[0-9]+$/, { message: 'OTP must contain only numbers' })
  otp: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    {
      message:
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    },
  )
  newPassword: string;
} 