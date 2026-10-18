import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import type { AuthenticatedUser } from '../auth/types.js';
import { UpdatePrefsDto } from './dto/update-prefs.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('me')
@ApiBearerAuth('access-token')
@Controller('me')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Current user profile' })
  async me(@CurrentUser() user: AuthenticatedUser) {
    const record = await this.users.findById(user.id);
    if (!record) {
      // The guard already loaded the user; this only covers a delete racing the request.
      throw new Error('Authenticated user no longer exists');
    }
    return this.users.toPublicUser(record);
  }

  @Patch()
  @RequirePermissions('profile.update')
  @ApiOperation({ summary: 'Update own profile' })
  update(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user.id, dto);
  }

  @Get('prefs')
  @RequirePermissions('profile.update')
  @ApiOperation({ summary: 'Notification preferences' })
  prefs(@CurrentUser() user: AuthenticatedUser) {
    return this.users.getPrefs(user.id);
  }

  @Patch('prefs')
  @RequirePermissions('profile.update')
  @ApiOperation({ summary: 'Update notification preferences' })
  updatePrefs(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdatePrefsDto) {
    return this.users.updatePrefs(user.id, dto);
  }
}
