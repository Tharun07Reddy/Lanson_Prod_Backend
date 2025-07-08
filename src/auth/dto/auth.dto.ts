import { IsEmail, IsString, IsOptional, MinLength, IsPhoneNumber, ValidateIf } from 'class-validator';
import { UserStatus, AuthProvider } from '@prisma/client';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsPhoneNumber()
  phone: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;
}

export class LoginDto {
  @ValidateIf((o: LoginDto) => !o.phone)
  @IsEmail()
  email?: string;

  @ValidateIf((o: LoginDto) => !o.email)
  @IsPhoneNumber()
  phone?: string;

  @IsString()
  password: string;

  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsOptional()
  @IsString()
  deviceType?: string;

  @IsOptional()
  @IsString()
  deviceName?: string;

  @IsOptional()
  @IsString()
  ipAddress?: string;

  @IsOptional()
  @IsString()
  userAgent?: string;

  @IsOptional()
  @IsString()
  location?: string;
}

export class RefreshTokenDto {
  @IsString()
  refreshToken: string;
}

export class TokenResponseDto {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export class UserResponseDto {
  id: string;
  email: string;
  phone?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  status: UserStatus;
  emailVerified: boolean;
  phoneVerified: boolean;
  authProvider: AuthProvider;
  profilePicture?: string;
  createdAt: Date;
}

export class LoginResponseDto extends TokenResponseDto {
  user: UserResponseDto;
  sessionId?: string;
} 