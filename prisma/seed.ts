import { PrismaClient, Permission, Role } from '@prisma/client';

const prisma = new PrismaClient();

interface PermissionDefinition {
  resource: string;
  action: string;
  description: string;
}

interface RoleDefinition {
  name: string;
  description: string;
  isDefault: boolean;
  permissions: string[];
}

// Define permissions by resource and action
const permissionDefinitions: PermissionDefinition[] = [
  // User management permissions
  { resource: 'user', action: 'create', description: 'Create users' },
  { resource: 'user', action: 'read', description: 'View users' },
  { resource: 'user', action: 'update', description: 'Update users' },
  { resource: 'user', action: 'delete', description: 'Delete users' },
  { resource: 'user', action: 'list', description: 'List all users' },
  
  // Role management permissions
  { resource: 'role', action: 'create', description: 'Create roles' },
  { resource: 'role', action: 'read', description: 'View roles' },
  { resource: 'role', action: 'update', description: 'Update roles' },
  { resource: 'role', action: 'delete', description: 'Delete roles' },
  { resource: 'role', action: 'list', description: 'List all roles' },
  { resource: 'role', action: 'assign', description: 'Assign roles to users' },
  
  // Permission management
  { resource: 'permission', action: 'create', description: 'Create permissions' },
  { resource: 'permission', action: 'read', description: 'View permissions' },
  { resource: 'permission', action: 'update', description: 'Update permissions' },
  { resource: 'permission', action: 'delete', description: 'Delete permissions' },
  { resource: 'permission', action: 'list', description: 'List all permissions' },
  { resource: 'permission', action: 'assign', description: 'Assign permissions to roles' },
  
  // Profile permissions (for self-management)
  { resource: 'profile', action: 'read', description: 'View own profile' },
  { resource: 'profile', action: 'update', description: 'Update own profile' },
  
  // Session permissions
  { resource: 'session', action: 'read', description: 'View own sessions' },
  { resource: 'session', action: 'delete', description: 'Delete own sessions' },
  
  // System settings
  { resource: 'settings', action: 'read', description: 'View system settings' },
  { resource: 'settings', action: 'update', description: 'Update system settings' },
  
  // Analytics
  { resource: 'analytics', action: 'read', description: 'View analytics data' },
  
  // Audit logs
  { resource: 'audit', action: 'read', description: 'View audit logs' },
];

// Define roles with their permissions
const roleDefinitions: RoleDefinition[] = [
  {
    name: 'ADMIN',
    description: 'Administrator with full system access',
    isDefault: false,
    permissions: permissionDefinitions.map(p => `${p.resource}:${p.action}`), // All permissions
  },
  {
    name: 'USER',
    description: 'Regular user with limited access',
    isDefault: true, // Default role for new users
    permissions: [
      'profile:read',
      'profile:update',
      'session:read',
      'session:delete',
    ],
  },
];

async function createPermissions(): Promise<Permission[]> {
  console.log('Creating permissions...');
  
  const permissions: Permission[] = [];
  
  for (const def of permissionDefinitions) {
    const name = `${def.resource}:${def.action}`;
    
    // Check if permission already exists
    const existingPermission = await prisma.permission.findUnique({
      where: { name },
    });
    
    if (!existingPermission) {
      // Create new permission
      const permission = await prisma.permission.create({
        data: {
          name,
          description: def.description,
          resource: def.resource,
          action: def.action,
        },
      });
      
      permissions.push(permission);
      console.log(`Created permission: ${permission.name}`);
    } else {
      permissions.push(existingPermission);
      console.log(`Permission already exists: ${existingPermission.name}`);
    }
  }
  
  return permissions;
}

async function createRoles(permissions: Permission[]): Promise<void> {
  console.log('Creating roles...');
  
  for (const roleDef of roleDefinitions) {
    // Check if role already exists
    const existingRole = await prisma.role.findUnique({
      where: { name: roleDef.name },
    });
    
    let role: Role;
    
    if (!existingRole) {
      // Create new role
      role = await prisma.role.create({
        data: {
          name: roleDef.name,
          description: roleDef.description,
          isDefault: roleDef.isDefault,
        },
      });
      
      console.log(`Created role: ${role.name}`);
    } else {
      role = existingRole;
      console.log(`Role already exists: ${existingRole.name}`);
    }
    
    // Assign permissions to role
    for (const permName of roleDef.permissions) {
      const permission = permissions.find(p => p.name === permName);
      
      if (permission) {
        // Check if role-permission relationship already exists
        const existingRolePermission = await prisma.rolePermission.findFirst({
          where: {
            roleId: role.id,
            permissionId: permission.id,
          },
        });
        
        if (!existingRolePermission) {
          await prisma.rolePermission.create({
            data: {
              roleId: role.id,
              permissionId: permission.id,
            },
          });
          
          console.log(`Assigned permission ${permission.name} to role ${role.name}`);
        } else {
          console.log(`Permission ${permission.name} already assigned to role ${role.name}`);
        }
      }
    }
  }
}

async function main() {
  console.log('Starting seed...');
  
  try {
    // Create permissions first
    const permissions = await createPermissions();
    
    // Then create roles and assign permissions
    await createRoles(permissions);
    
    console.log('Seed completed successfully!');
  } catch (error) {
    console.error('Error during seed:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 