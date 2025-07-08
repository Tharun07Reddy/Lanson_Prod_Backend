import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete, 
  UseGuards, 
  Req, 
  Query, 
  HttpStatus, 
  HttpCode,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger
} from '@nestjs/common';
import { UserService, UserProfile } from './user.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { User, UserStatus, Prisma } from '@prisma/client';
import { Request } from 'express';

// Define the request with user interface
interface RequestWithUser extends Request {
  user: {
    id: string;
    email: string;
    username?: string;
    [key: string]: any;
  };
}

// Define DTOs
class CreateUserDto implements Partial<User> {
  email: string;
  phone?: string;
  password: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  status?: UserStatus;
}

class UpdateUserDto implements Partial<User> {
  email?: string;
  phone?: string;
  password?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  profilePicture?: string;
  status?: UserStatus;
}

class QueryUsersDto {
  skip?: number;
  take?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  status?: UserStatus;
  search?: string;
}

// Type for user data without password
type UserWithoutPassword = Omit<User, 'password'>;

@Controller('users')
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(private readonly userService: UserService) {}

  // Get current user profile
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Req() req: RequestWithUser): Promise<UserProfile> {
    this.logger.debug(`User payload: ${JSON.stringify(req.user)}`);
    
    if (!req.user || !req.user.id) {
      this.logger.error('User ID not found in request');
      throw new BadRequestException('User ID not found in token');
    }
    
    const userId = req.user.id;
    this.logger.debug(`Getting profile for user ID: ${userId}`);
    
    const profile = await this.userService.getUserProfile(userId);
    
    if (!profile) {
      throw new NotFoundException('User profile not found');
    }
    
    return profile;
  }

  // Update current user profile
  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  async updateProfile(
    @Req() req: RequestWithUser,
    @Body() updateUserDto: UpdateUserDto
  ): Promise<UserWithoutPassword> {
    if (!req.user || !req.user.id) {
      throw new BadRequestException('User ID not found in token');
    }
    
    const userId = req.user.id;
    
    // Prevent changing email, phone or status through this endpoint
    const { email, phone, status, ...allowedUpdates } = updateUserDto;
    
    if (email || phone || status) {
      throw new BadRequestException('Cannot update email, phone or status through this endpoint');
    }
    
    const updatedUser = await this.userService.update(userId, allowedUpdates);
    
    // Remove sensitive data
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...result } = updatedUser;
    return result;
  }

  // Create a new user (admin only)
  @UseGuards(JwtAuthGuard)
  @Roles('ADMIN')
  @Permissions({ resource: 'user', action: 'create' })
  @Post()
  async create(@Body() createUserDto: CreateUserDto): Promise<UserWithoutPassword> {
    const user = await this.userService.create(createUserDto);
    
    // Remove sensitive data
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...result } = user;
    return result;
  }

  // Get all users (admin only)
  @UseGuards(JwtAuthGuard)
  @Roles('ADMIN')
  @Permissions({ resource: 'user', action: 'list' })
  @Get()
  async findAll(@Query() query: QueryUsersDto) {
    const { 
      skip = 0, 
      take = 10, 
      orderBy = 'createdAt', 
      orderDirection = 'desc',
      status,
      search 
    } = query;
    
    // Build where clause
    const where: Prisma.UserWhereInput = {};
    
    if (status) {
      where.status = status;
    }
    
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }
    
    // Build order by
    const orderByClause: Prisma.UserOrderByWithRelationInput = {};
    orderByClause[orderBy as keyof Prisma.UserOrderByWithRelationInput] = orderDirection;
    
    return this.userService.findAll({
      skip: Number(skip),
      take: Number(take),
      orderBy: orderByClause,
      where,
    });
  }

  // Get user by ID (admin or self)
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: RequestWithUser): Promise<UserProfile> {
    if (!req.user || !req.user.id) {
      throw new BadRequestException('User ID not found in token');
    }
    
    // Check if user is requesting their own profile or is admin
    const isOwnProfile = req.user.id === id;
    const isAdmin = await this.checkIfUserIsAdmin(req.user.id);
    
    if (!isOwnProfile && !isAdmin) {
      throw new ForbiddenException('You can only access your own profile');
    }
    
    const profile = await this.userService.getUserProfile(id);
    
    if (!profile) {
      throw new NotFoundException('User not found');
    }
    
    return profile;
  }

  // Update user by ID (admin only)
  @UseGuards(JwtAuthGuard)
  @Roles('ADMIN')
  @Permissions({ resource: 'user', action: 'update' })
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto
  ): Promise<UserWithoutPassword> {
    const updatedUser = await this.userService.update(id, updateUserDto);
    
    // Remove sensitive data
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...result } = updatedUser;
    return result;
  }

  // Delete user by ID (admin only)
  @UseGuards(JwtAuthGuard)
  @Roles('ADMIN')
  @Permissions({ resource: 'user', action: 'delete' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.userService.delete(id);
  }

  // Helper method to check if user has admin role
  private async checkIfUserIsAdmin(userId: string): Promise<boolean> {
    const profile = await this.userService.getUserProfile(userId);
    if (!profile) return false;
    
    return profile.roles.some(role => role.name === 'ADMIN');
  }
} 