import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../database/prisma.service';

interface RequiredPermission {
  resource: string;
  action: string;
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<RequiredPermission[]>(
      'permissions',
      [context.getHandler(), context.getClass()],
    );

    // If no permissions are required, allow access
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // If no user is attached to the request, deny access
    if (!user || !user.sub) {
      throw new ForbiddenException('User not authenticated');
    }

    // Get user roles
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId: user.sub },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    // Flatten permissions from all roles
    const userPermissions = userRoles.flatMap(userRole => 
      userRole.role.permissions.map(rp => rp.permission)
    );

    // Check if user has all required permissions
    const hasAllPermissions = requiredPermissions.every(required => 
      userPermissions.some(
        permission => 
          permission.resource === required.resource && 
          permission.action === required.action
      )
    );

    return hasAllPermissions;
  }
} 