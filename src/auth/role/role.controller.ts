import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { RoleService } from './role.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
//import { Roles } from '../decorators/roles.decorator';
import { Permissions } from '../decorators/permissions.decorator';

@Controller('roles')
@UseGuards(JwtAuthGuard)
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  @Permissions({ resource: 'role', action: 'list' })
  async getAllRoles() {
    return this.roleService.getAllRoles();
  }

  @Get(':id')
  @Permissions({ resource: 'role', action: 'read' })
  async getRoleById(@Param('id') id: string) {
    return this.roleService.getRoleById(id);
  }

  @Post('assign')
  @Permissions({ resource: 'role', action: 'assign' })
  async assignRoleToUser(
    @Body() body: { userId: string; roleId: string },
  ) {
    const { userId, roleId } = body;
    return this.roleService.assignRoleToUser(userId, roleId);
  }

  @Get('user/:userId')
  @Permissions({ resource: 'role', action: 'read' })
  async getUserRoles(@Param('userId') userId: string) {
    return this.roleService.getUserRoles(userId);
  }

  @Get('user/:userId/permissions')
  @Permissions({ resource: 'permission', action: 'read' })
  async getUserPermissions(@Param('userId') userId: string) {
    return this.roleService.getUserPermissions(userId);
  }
} 