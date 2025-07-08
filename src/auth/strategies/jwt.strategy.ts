import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

// Define the JWT payload interface
interface JwtPayload {
  sub: string;
  email: string;
  username?: string;
  phone?: string;
  iat: number;
  exp: number;
  aud?: string;
  iss?: string;
  [key: string]: any;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);
  
  constructor(private configService: ConfigService) {
    const secretKey = configService.get<string>('JWT_SECRET');
    if (!secretKey) {
      throw new Error('JWT_SECRET is not defined in environment variables');
    }
    
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secretKey,
    });
    
    this.logger.log('JWT Strategy initialized');
  }

  validate(payload: JwtPayload): { id: string; email: string; username?: string; phone?: string } {
    this.logger.debug(`Validating JWT payload: ${JSON.stringify(payload)}`);
    
    // Map sub to id for consistency
    return {
      id: payload.sub,
      email: payload.email,
      username: payload.username,
      phone: payload.phone,
    };
  }
} 