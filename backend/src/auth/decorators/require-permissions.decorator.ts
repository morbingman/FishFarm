import { SetMetadata } from '@nestjs/common';
import type { Permission } from '../permissions.js';

export const PERMISSIONS_KEY = 'auth:permissions';

/** Requires every listed permission (AND semantics) for the route. */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
