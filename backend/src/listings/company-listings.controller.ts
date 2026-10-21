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
import { ListCompanyListingsDto } from './dto/list-listings.dto.js';
import { SaveListingDto } from './dto/save-listing.dto.js';
import { ListingsService } from './listings.service.js';

/**
 * The company catalog. Every Admin operates the same company inventory, so
 * these routes are not scoped to the calling Admin's account.
 */
@ApiTags('company')
@ApiBearerAuth('access-token')
@Controller('company/listings')
export class CompanyListingsController {
  constructor(private readonly listings: ListingsService) {}

  @Get()
  @RequirePermissions('listing.update')
  @ApiOperation({ summary: 'List company listings, optionally filtered by status tab' })
  list(@Query() query: ListCompanyListingsDto) {
    return this.listings.list(query.status);
  }

  @Post()
  @RequirePermissions('listing.create')
  @ApiOperation({ summary: 'Create a draft listing for the company' })
  create(@CurrentUser() admin: AuthenticatedUser, @Body() dto: SaveListingDto) {
    return this.listings.create(admin, dto);
  }

  @Get(':id')
  @RequirePermissions('listing.update')
  @ApiOperation({ summary: 'Get one company listing by code (FM-…) or id' })
  get(@Param('id') id: string) {
    return this.listings.get(id);
  }

  @Patch(':id')
  @RequirePermissions('listing.update')
  @ApiOperation({ summary: 'Update draft content; editing a live listing keeps it live' })
  update(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SaveListingDto,
  ) {
    return this.listings.update(admin, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('listing.delete')
  @ApiOperation({ summary: 'Soft-delete a draft, changes or rejected listing' })
  remove(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string) {
    return this.listings.remove(admin, id);
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('listing.publish')
  @ApiOperation({ summary: 'Validate a draft and publish it directly to the catalog' })
  publish(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string) {
    return this.listings.publish(admin, id);
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('listing.submit')
  @ApiOperation({ summary: 'Send a listing to the optional internal review queue' })
  submit(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string) {
    return this.listings.submit(admin, id);
  }

  @Post(':id/withdraw')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('listing.submit')
  @ApiOperation({ summary: 'Withdraw a pending listing back to draft' })
  withdraw(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string) {
    return this.listings.withdraw(admin, id);
  }

  @Post(':id/pause')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('listing.pause')
  @ApiOperation({ summary: 'Hide an approved listing from the catalog' })
  pause(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string) {
    return this.listings.pause(admin, id);
  }

  @Post(':id/resume')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('listing.pause')
  @ApiOperation({ summary: 'Make a paused listing live again' })
  resume(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string) {
    return this.listings.resume(admin, id);
  }
}
