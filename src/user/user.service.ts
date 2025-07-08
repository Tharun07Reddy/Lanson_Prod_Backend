import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { User, UserStatus, Prisma, Role, Permission } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { RedisService } from '../cache/redis.service';

// Define the user cache key prefix
const USER_CACHE_PREFIX = 'user:';
const USER_CACHE_TTL = 3600; // 1 hour in seconds

// Define the extended user profile interface with roles and permissions
export interface UserProfile extends Omit<User, 'password'> {
  roles: Role[];
  permissions: Permission[];
  password?: string | null;
}

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
  ) {}

  /**
   * Find user by ID with roles and permissions
   */
  async findById(id: string): Promise<User | null> {
    // Try to get from cache first
    const cacheKey = `${USER_CACHE_PREFIX}${id}`;
    const cachedUser = await this.redisService.get<User>(cacheKey);
    
    if (cachedUser) {
      this.logger.debug(`User ${id} retrieved from cache`);
      return cachedUser;
    }
    
    // If not in cache, get from database
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    
    if (user) {
      // Store in cache for future requests
      await this.redisService.set(cacheKey, user, USER_CACHE_TTL);
    }
    
    return user;
  }

  /**
   * Get user profile with roles and permissions
   */
  async getUserProfile(id: string): Promise<UserProfile | null> {
    // Try to get from cache first
    const cacheKey = `${USER_CACHE_PREFIX}${id}:profile`;
    const cachedProfile = await this.redisService.get<UserProfile>(cacheKey);
    
    if (cachedProfile) {
      this.logger.debug(`User profile ${id} retrieved from cache`);
      return cachedProfile;
    }
    
    // If not in cache, get from database
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        roles: {
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
        },
      },
    });
    
    if (!user) {
      return null;
    }
    
    // Extract roles and permissions
    const roles = user.roles.map(ur => ur.role);
    
    // Extract unique permissions from all roles
    const permissionsMap = new Map<string, Permission>();
    user.roles.forEach(userRole => {
      userRole.role.permissions.forEach(rolePermission => {
        permissionsMap.set(rolePermission.permission.id, rolePermission.permission);
      });
    });
    
    const permissions = Array.from(permissionsMap.values());
    
    // Create the profile object with password omitted
    const { password, ...userWithoutPassword } = user;
    const profile: UserProfile = {
      ...userWithoutPassword,
      roles,
      permissions,
    };
    
    // Store in cache for future requests
    await this.redisService.set(cacheKey, profile, USER_CACHE_TTL);
    
    return profile;
  }

  async findByEmail(email: string): Promise<User | null> {
    // Try to get from cache first
    const cacheKey = `${USER_CACHE_PREFIX}email:${email}`;
    const cachedUserId = await this.redisService.get<string>(cacheKey);
    
    if (cachedUserId) {
      return this.findById(cachedUserId);
    }
    
    // If not in cache, get from database
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    
    if (user) {
      // Store user ID by email in cache for future requests
      await this.redisService.set(cacheKey, user.id, USER_CACHE_TTL);
      // Also cache the full user object
      await this.redisService.set(`${USER_CACHE_PREFIX}${user.id}`, user, USER_CACHE_TTL);
    }
    
    return user;
  }

  async findByPhone(phone: string): Promise<User | null> {
    // Try to get from cache first
    const cacheKey = `${USER_CACHE_PREFIX}phone:${phone}`;
    const cachedUserId = await this.redisService.get<string>(cacheKey);
    
    if (cachedUserId) {
      return this.findById(cachedUserId);
    }
    
    // If not in cache, get from database
    const user = await this.prisma.user.findFirst({
      where: { phone },
    });
    
    if (user) {
      // Store user ID by phone in cache for future requests
      await this.redisService.set(cacheKey, user.id, USER_CACHE_TTL);
      // Also cache the full user object
      await this.redisService.set(`${USER_CACHE_PREFIX}${user.id}`, user, USER_CACHE_TTL);
    }
    
    return user;
  }

  async findByUsername(username: string): Promise<User | null> {
    // Try to get from cache first
    const cacheKey = `${USER_CACHE_PREFIX}username:${username}`;
    const cachedUserId = await this.redisService.get<string>(cacheKey);
    
    if (cachedUserId) {
      return this.findById(cachedUserId);
    }
    
    // If not in cache, get from database
    const user = await this.prisma.user.findFirst({
      where: { username },
    });
    
    if (user) {
      // Store user ID by username in cache for future requests
      await this.redisService.set(cacheKey, user.id, USER_CACHE_TTL);
      // Also cache the full user object
      await this.redisService.set(`${USER_CACHE_PREFIX}${user.id}`, user, USER_CACHE_TTL);
    }
    
    return user;
  }

  async create(data: Prisma.UserCreateInput): Promise<User> {
    if (data.password) {
      data.password = await this.hashPassword(data.password);
    }
    
    const user = await this.prisma.user.create({
      data,
    });
    
    // Invalidate any potential cached data
    await this.invalidateUserCache(user);
    
    return user;
  }

  async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    try {
      if (data.password) {
        data.password = await this.hashPassword(data.password as string);
      }
      
      const user = await this.prisma.user.update({
        where: { id },
        data,
      });
      
      // Invalidate cached data
      await this.invalidateUserCache(user);
      
      return user;
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`User with ID ${id} not found`);
      }
      throw error;
    }
  }

  async updateLastLogin(id: string): Promise<User> {
    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: {
          lastLoginAt: new Date(),
        },
      });
      
      // Invalidate cached data
      await this.invalidateUserCache(user);
      
      return user;
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`User with ID ${id} not found`);
      }
      throw error;
    }
  }

  async setStatus(id: string, status: UserStatus): Promise<User> {
    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: { status },
      });
      
      // Invalidate cached data
      await this.invalidateUserCache(user);
      
      return user;
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`User with ID ${id} not found`);
      }
      throw error;
    }
  }

  async verifyEmail(id: string): Promise<User> {
    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: { 
          emailVerified: true,
          status: UserStatus.ACTIVE,
        },
      });
      
      // Invalidate cached data
      await this.invalidateUserCache(user);
      
      return user;
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`User with ID ${id} not found`);
      }
      throw error;
    }
  }

  async verifyPhone(id: string): Promise<User> {
    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: { phoneVerified: true },
      });
      
      // Invalidate cached data
      await this.invalidateUserCache(user);
      
      return user;
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`User with ID ${id} not found`);
      }
      throw error;
    }
  }

  async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  async validatePassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  /**
   * Find all users with pagination
   */
  async findAll(params: {
    skip?: number;
    take?: number;
    orderBy?: Prisma.UserOrderByWithRelationInput;
    where?: Prisma.UserWhereInput;
  }): Promise<{ users: Partial<User>[]; total: number }> {
    const { skip = 0, take = 10, orderBy = { createdAt: 'desc' }, where = {} } = params;
    
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take,
        orderBy,
        where,
        select: {
          id: true,
          email: true,
          phone: true,
          username: true,
          firstName: true,
          lastName: true,
          status: true,
          emailVerified: true,
          phoneVerified: true,
          authProvider: true,
          profilePicture: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
          // Exclude password and other sensitive fields
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    
    return { users, total };
  }

  /**
   * Delete a user
   */
  async delete(id: string): Promise<User> {
    try {
      // Get user first to invalidate cache later
      const user = await this.prisma.user.findUnique({
        where: { id },
      });
      
      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }
      
      // Delete user
      const deletedUser = await this.prisma.user.delete({
        where: { id },
      });
      
      // Invalidate cached data
      await this.invalidateUserCache(user);
      
      return deletedUser;
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`User with ID ${id} not found`);
      }
      throw error;
    }
  }

  /**
   * Invalidate user cache
   */
  private async invalidateUserCache(user: User): Promise<void> {
    try {
      const cacheKeys = [
        `${USER_CACHE_PREFIX}${user.id}`,
        `${USER_CACHE_PREFIX}${user.id}:profile`,
      ];
      
      if (user.email) {
        cacheKeys.push(`${USER_CACHE_PREFIX}email:${user.email}`);
      }
      
      if (user.phone) {
        cacheKeys.push(`${USER_CACHE_PREFIX}phone:${user.phone}`);
      }
      
      if (user.username) {
        cacheKeys.push(`${USER_CACHE_PREFIX}username:${user.username}`);
      }
      
      // Delete all cache keys
      for (const key of cacheKeys) {
        await this.redisService.del(key);
      }
      
      this.logger.debug(`Invalidated cache for user ${user.id}`);
    } catch (error) {
      this.logger.error(`Error invalidating cache for user ${user.id}`, error);
      // Don't throw error, just log it
    }
  }
} 