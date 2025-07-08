import { SetMetadata } from '@nestjs/common';

export interface RequiredPermission {
  resource: string;
  action: string;
}

export const Permissions = (...permissions: RequiredPermission[]) => 
  SetMetadata('permissions', permissions); 