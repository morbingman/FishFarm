import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import type { AuthenticatedUser } from '../auth/types.js';
import { AdminQueueDto } from './dto/list-listings.dto.js';
import { ModerateListingDto, TakedownListingDto } from './dto/save-listing.dto.js';
import { ListingsService } from './listings.service.js';

@ApiTags('admin')
@ApiBearerAuth('access-token')
@Controller('admin/listings')
export class AdminListingsController {
  constructor(private readonly listings: ListingsService) {}

  @Get()
  @RequirePermissions('queue.view')
  @ApiOperation({ summary: 'Moderation queue: pending, live approved, or sent-back listings' })
  queue(@Query() query: AdminQueueDto) {
    return this.listings.queue(query.tab);
  }

  @Get(':id')
  @RequirePermissions('queue.view')
  @ApiOperation({ summary: 'Review detail with completeness checks' })
  get(@Param('id') id: string) {
    return this.listings.getAdmin(id);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('listing.approve')
  @ApiOperation({ summary: 'Approve a pending listing' })
  approve(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string) {
    return this.listings.approve(admin, id);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('listing.reject')
  @ApiOperation({ summary: 'Reject a pending listing with a reason and feedback' })
  reject(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ModerateListingDto,
  ) {
    return this.listings.reject(admin, id, dto);
  }

  @Post(':id/request-changes')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('listing.reject')
  @ApiOperation({ summary: 'Send a pending listing back to the seller for changes' })
  requestChanges(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ModerateListingDto,
  ) {
    return this.listings.requestChanges(admin, id, dto);
  }

  @Post(':id/takedown')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('listing.takedown')
  @ApiOperation({ summary: 'Take down a live listing for a policy violation' })
  takedown(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: TakedownListingDto,
  ) {
    return this.listings.takedown(admin, id, dto);
  }
}
