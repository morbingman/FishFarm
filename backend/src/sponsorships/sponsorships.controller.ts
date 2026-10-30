import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import type { AuthenticatedUser } from '../auth/types.js';
import { SponsorshipsService } from './sponsorships.service.js';
import {
  CreateSponsorshipDto,
  ListSponsorshipsDto,
  PaySponsorshipDto,
  SponsorshipCancelDto,
} from './dto/sponsorship.dto.js';

@ApiTags('sponsorships')
@ApiBearerAuth('access-token')
@Controller()
export class SponsorshipsController {
  constructor(private readonly sponsorships: SponsorshipsService) {}

  @Post('batches/:code/sponsorships')
  @RequirePermissions('batch.sponsor')
  @ApiOperation({ summary: 'Reserve shares of an open batch (pending_payment, no charge yet)' })
  reserve(@CurrentUser() user: AuthenticatedUser, @Param('code') code: string, @Body() dto: CreateSponsorshipDto) {
    return this.sponsorships.reserve(user, code, dto);
  }

  @Post('sponsorships/:id/pay')
  @RequirePermissions('batch.sponsor')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pay the full package amount once (idempotent); escrow tranches are created' })
  pay(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: PaySponsorshipDto) {
    return this.sponsorships.pay(user, id, dto);
  }

  @Get('me/sponsorships')
  @RequirePermissions('batch.sponsor')
  @ApiOperation({ summary: 'My sponsorships, newest first' })
  mine(@CurrentUser() user: AuthenticatedUser, @Query() query: ListSponsorshipsDto) {
    return this.sponsorships.mine(user.id, query);
  }

  @Get('sponsorships/:id')
  @RequirePermissions('batch.sponsor')
  @ApiOperation({ summary: 'One of my sponsorships by id' })
  one(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.sponsorships.one(user, id);
  }

  @Get('sponsorships/:id/escrow')
  @RequirePermissions('batch.sponsor')
  @ApiOperation({ summary: 'Sponsor-visible held/released escrow tranches for my sponsorship' })
  escrow(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.sponsorships.escrow(user, id);
  }

  @Post('sponsorships/:id/cancel')
  @RequirePermissions('batch.sponsor')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel before growing; funded reservations refund the unreleased escrow in full' })
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: SponsorshipCancelDto) {
    return this.sponsorships.cancel(user, id, dto);
  }

  @Post('sponsorships/:id/pay-delivery-fee')
  @RequirePermissions('batch.sponsor')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pay the optional delivery fee charged at harvest (§11.4); idempotent' })
  payDeliveryFee(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: PaySponsorshipDto) {
    return this.sponsorships.payDeliveryFee(user, id, dto);
  }

  @Post('sponsorships/:id/confirm-delivery')
  @RequirePermissions('batch.sponsor')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm delivery of a ready_for_delivery sponsorship; settles the batch when complete' })
  confirmDelivery(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.sponsorships.confirmDelivery(user, id);
  }
}
