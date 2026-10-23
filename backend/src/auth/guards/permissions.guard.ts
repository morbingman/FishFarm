import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppException } from '../../common/exceptions/app.exception.js';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator.js';
import { hasPermission, type Permission } from '../permissions.js';
import type { AuthenticatedRequest } from '../types.js';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[] | undefined>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user)
      throw new AppException('auth.missingToken', HttpStatus.UNAUTHORIZED);

    const missing = required.find(
      (permission) => !hasPermission(user.role, permission),
    );
    if (missing) {
      throw new AppException('auth.forbidden', HttpStatus.FORBIDDEN, {
        permission: missing,
      });
    }

    return true;
  }
}
