import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import type { AuthenticatedUser } from '../auth/types.js';
import { SponsorshipsService } from './sponsorships.service.js';
import { HarvestBatchDto, ListSponsorshipsDto } from './dto/sponsorship.dto.js';

@ApiTags('company')
@ApiBearerAuth('access-token')
@Controller()
export class CompanySponsorshipsController {
  constructor(private readonly sponsorships: SponsorshipsService) {}

  @Get('company/sponsorships')
  @RequirePermissions('batch.settle')
  @ApiOperation({ summary: 'All company sponsorships (Admin, read-only)' })
  list(@Query() query: ListSponsorshipsDto) {
    return this.sponsorships.companyList(query);
  }

  @Get('company/batches/:code/sponsors')
  @RequirePermissions('batch.settle')
  @ApiOperation({ summary: 'Sponsors of one company batch (Admin, read-only)' })
  sponsors(@Param('code') code: string) {
    return this.sponsorships.companySponsors(code);
  }

  @Post('company/batches/:code/grow')
  @RequirePermissions('batch.update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start growing: funded sponsorships enter growing and stocking escrow is released' })
  grow(@CurrentUser() admin: AuthenticatedUser, @Param('code') code: string) {
    return this.sponsorships.grow(admin, code);
  }

  @Post('company/batches/:code/harvest')
  @RequirePermissions('batch.settle')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish actual yield; releases mid-growth escrow, refunds shortfall pro-rata' })
  harvest(@CurrentUser() admin: AuthenticatedUser, @Param('code') code: string, @Body() dto: HarvestBatchDto) {
    return this.sponsorships.harvest(admin, code, dto);
  }
}
