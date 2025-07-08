import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Role, Permission, UserRole } from '@prisma/client';

@Injectable()
export class RoleService {
  private readonly logger = new Logger(RoleService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get all roles
   */
  async getAllRoles(): Promise<Role[]> {
    try {
      return await this.prisma.role.findMany({
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      });
    } catch (error) {
      this.logger.error(`Failed to get all roles: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return [];
    }
  }

  /**
   * Get role by ID
   */
  async getRoleById(id: string): Promise<Role | null> {
    try {
      return await this.prisma.role.findUnique({
        where: { id },
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      });
    } catch (error) {
      this.logger.error(`Failed to get role by ID: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  /**
   * Get role by name
   */
  async getRoleByName(name: string): Promise<Role | null> {
    try {
      return await this.prisma.role.findUnique({
        where: { name },
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      });
    } catch (error) {
      this.logger.error(`Failed to get role by name: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  /**
   * Get default role
   */
  async getDefaultRole(): Promise<Role | null> {
    try {
      return await this.prisma.role.findFirst({
        where: { isDefault: true },
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      });
    } catch (error) {
      this.logger.error(`Failed to get default role: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  /**
   * Assign role to user
   */
  async assignRoleToUser(userId: string, roleId: string): Promise<UserRole | null> {
    try {
      // Check if user already has this role
      const existingUserRole = await this.prisma.userRole.findUnique({
        where: {
          userId_roleId: {
            userId,
            roleId,
          },
        },
      });

      if (existingUserRole) {
        return existingUserRole;
      }

      // Assign role to user
      return await this.prisma.userRole.create({
        data: {
          userId,
          roleId,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to assign role to user: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  /**
   * Assign default role to user
   */
  async assignDefaultRoleToUser(userId: string): Promise<UserRole | null> {
    try {
      const defaultRole = await this.getDefaultRole();
      
      if (!defaultRole) {
        this.logger.warn('No default role found');
        return null;
      }
      
      return await this.assignRoleToUser(userId, defaultRole.id);
    } catch (error) {
      this.logger.error(`Failed to assign default role to user: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  /**
   * Get user roles
   */
  async getUserRoles(userId: string): Promise<Role[]> {
    try {
      const userRoles = await this.prisma.userRole.findMany({
        where: { userId },
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
      
      return userRoles.map(ur => ur.role);
    } catch (error) {
      this.logger.error(`Failed to get user roles: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return [];
    }
  }

  /**
   * Check if user has role
   */
  async userHasRole(userId: string, roleName: string): Promise<boolean> {
    try {
      const count = await this.prisma.userRole.count({
        where: {
          userId,
          role: {
            name: roleName,
          },
        },
      });
      
      return count > 0;
    } catch (error) {
      this.logger.error(`Failed to check if user has role: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  /**
   * Get user permissions
   */
  async getUserPermissions(userId: string): Promise<Permission[]> {
    try {
      const userRoles = await this.prisma.userRole.findMany({
        where: { userId },
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
      
      // Extract unique permissions from all roles
      const permissionsMap = new Map<string, Permission>();
      
      userRoles.forEach(userRole => {
        userRole.role.permissions.forEach(rolePermission => {
          permissionsMap.set(rolePermission.permission.id, rolePermission.permission);
        });
      });
      
      return Array.from(permissionsMap.values());
    } catch (error) {
      this.logger.error(`Failed to get user permissions: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return [];
    }
  }

  /**
   * Check if user has permission
   */
  async userHasPermission(userId: string, permissionName: string): Promise<boolean> {
    try {
      const userRoles = await this.prisma.userRole.findMany({
        where: { userId },
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
      
      // Check if any role has the permission
      return userRoles.some(userRole => 
        userRole.role.permissions.some(rolePermission => 
          rolePermission.permission.name === permissionName
        )
      );
    } catch (error) {
      this.logger.error(`Failed to check if user has permission: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }
} 