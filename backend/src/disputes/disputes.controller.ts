import { Body, Controller, Get, Header, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import type { AuthenticatedUser } from '../auth/types.js';
import { CreateDisputeDto } from './dto/dispute.dto.js';
import { DisputesService } from './disputes.service.js';

@ApiTags('disputes')
@ApiBearerAuth('access-token')
@Controller()
export class DisputesController {
  constructor(private readonly disputes: DisputesService) {}

  @Post('me/orders/:orderId/dispute')
  @RequirePermissions('dispute.create')
  @ApiOperation({ summary: 'Open one dispute for an eligible owned order' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId') orderId: string,
    @Body() dto: CreateDisputeDto,
  ) {
    return this.disputes.create(user, orderId, dto);
  }

  @Post('sponsorships/:sponsorshipId/dispute')
  @RequirePermissions('dispute.create')
  @ApiOperation({ summary: 'Open one dispute for an eligible owned sponsorship (§11)' })
  createSponsorship(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sponsorshipId') sponsorshipId: string,
    @Body() dto: CreateDisputeDto,
  ) {
    return this.disputes.createSponsorshipDispute(user, sponsorshipId, dto);
  }

  @Get('me/disputes')
  @RequirePermissions('dispute.create')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.disputes.mine(user.id);
  }

  @Get('me/disputes/:id')
  @RequirePermissions('dispute.create')
  one(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.disputes.mineOne(user.id, id);
  }

  @Get('me/disputes/:id/attachments/:attachmentId/content')
  @Header('X-Content-Type-Options', 'nosniff')
  @RequirePermissions('dispute.create')
  content(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    return this.disputes.attachment(user, id, attachmentId);
  }
}
