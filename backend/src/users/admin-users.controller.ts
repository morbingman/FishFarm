import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import type { AuthenticatedUser } from '../auth/types.js';
import { AdminUsersService } from './admin-users.service.js';
import { AdminUsersQueryDto, UpdateUserStatusDto } from './dto/admin-users.dto.js';

@ApiTags('admin-users')
@ApiBearerAuth('access-token')
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  @RequirePermissions('user.view')
  @ApiOperation({ summary: 'Search and page shared account directory' })
  list(@Query() query: AdminUsersQueryDto) {
    return this.users.list(query);
  }

  @Patch(':email/status')
  @RequirePermissions('user.manage')
  @ApiOperation({ summary: 'Suspend or reactivate a User account; Admin accounts protected' })
  updateStatus(@CurrentUser() actor: AuthenticatedUser, @Param('email') email: string, @Body() dto: UpdateUserStatusDto) {
    return this.users.updateStatus(actor, email, dto);
  }
}
