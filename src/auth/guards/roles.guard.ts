import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no roles are required, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    // If no user is attached to the request, deny access
    if (!user || !user.sub) {
      throw new ForbiddenException('User not authenticated');
    }

    // Get user roles from database
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId: user.sub },
      include: { role: true },
    });

    // Check if user has any of the required roles
    const hasRequiredRole = userRoles.some(userRole => 
      requiredRoles.includes(userRole.role.name)
    );

    return hasRequiredRole;
  }
} 