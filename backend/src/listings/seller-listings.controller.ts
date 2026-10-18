import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import type { AuthenticatedUser } from '../auth/types.js';
import { ListSellerListingsDto } from './dto/list-listings.dto.js';
import { SaveListingDto } from './dto/save-listing.dto.js';
import { ListingsService } from './listings.service.js';

@ApiTags('seller')
@ApiBearerAuth('access-token')
@Controller('seller/listings')
export class SellerListingsController {
  constructor(private readonly listings: ListingsService) {}

  @Get()
  @RequirePermissions('listing.update')
  @ApiOperation({ summary: 'List own listings, optionally filtered by status tab' })
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListSellerListingsDto) {
    return this.listings.listSeller(user, query.status);
  }

  @Post()
  @RequirePermissions('listing.create')
  @ApiOperation({ summary: 'Create a draft listing' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: SaveListingDto) {
    return this.listings.create(user, dto);
  }

  @Get(':id')
  @RequirePermissions('listing.update')
  @ApiOperation({ summary: 'Get one of own listings by code (FM-…) or id' })
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.listings.getSeller(user, id);
  }

  @Patch(':id')
  @RequirePermissions('listing.update')
  @ApiOperation({
    summary: 'Update draft content. Editing a live listing sends it back for review.',
  })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SaveListingDto,
  ) {
    return this.listings.update(user, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('listing.delete')
  @ApiOperation({ summary: 'Soft-delete a draft, changes or rejected listing' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.listings.remove(user, id);
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('listing.submit')
  @ApiOperation({ summary: 'Submit or resubmit a listing for review' })
  submit(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.listings.submit(user, id);
  }

  @Post(':id/withdraw')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('listing.submit')
  @ApiOperation({ summary: 'Withdraw a pending listing back to draft' })
  withdraw(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.listings.withdraw(user, id);
  }

  @Post(':id/pause')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('listing.pause')
  @ApiOperation({ summary: 'Hide an approved listing from the marketplace' })
  pause(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.listings.pause(user, id);
  }

  @Post(':id/resume')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('listing.pause')
  @ApiOperation({ summary: 'Make a paused listing live again' })
  resume(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.listings.resume(user, id);
  }
}
