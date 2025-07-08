import { Injectable, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';

// Define the JWT payload interface
interface JwtPayload {
  sub: string;
  email: string;
  phone?: string;
  iat: number;
  exp: number;
  aud: string;
  iss: string;
  [key: string]: any; // For any additional fields
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check for public route decorator
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // First try the standard passport approach
    try {
      const result = await super.canActivate(context);
      if (result) {
        return true;
      }
    } catch (error) {
      this.logger.debug(`Passport authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Continue with manual verification as fallback
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);
    
    this.logger.debug(`Authorization header: ${request.headers.authorization}`);
    
    if (!token) {
      this.logger.error('Missing authentication token');
      throw new UnauthorizedException('Missing authentication token');
    }

    try {
      this.logger.debug(`Verifying token manually: ${token.substring(0, 10)}...`);
      const secret = this.configService.get<string>('JWT_SECRET');
      this.logger.debug(`Using secret: ${secret ? 'Secret exists' : 'Secret is missing or empty'}`);
      
      if (!this.jwtService) {
        this.logger.error('JwtService is not properly injected');
        throw new Error('JwtService is not available');
      }
      
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: secret,
      });
      
      this.logger.debug(`Token verified successfully. Payload: ${JSON.stringify(payload)}`);
      
      // Attach user info to request
      request.user = payload;
      
      return true;
    } catch (error) {
      this.logger.error(`Token verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
} 