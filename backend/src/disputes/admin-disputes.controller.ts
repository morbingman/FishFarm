import { Body, Controller, Get, Header, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import type { AuthenticatedUser } from '../auth/types.js';
import { DisputeStatus } from '../generated/prisma/enums.js';
import { ResolveDisputeDto } from './dto/dispute.dto.js';
import { DisputesService } from './disputes.service.js';

const STATUSES = Object.values(DisputeStatus);

class DisputeQueryDto {
  @IsOptional()
  @IsIn(STATUSES)
  status?: DisputeStatus;
}

@ApiTags('admin')
@ApiBearerAuth('access-token')
@Controller('admin/disputes')
@RequirePermissions('dispute.manage')
export class AdminDisputesController {
  constructor(private readonly disputes: DisputesService) {}

  @Get()
  list(@Query() query: DisputeQueryDto) {
    return this.disputes.list(query.status);
  }

  @Get(':id')
  one(@Param('id') id: string) {
    return this.disputes.one(id);
  }

  @Post(':id/start-review')
  @HttpCode(HttpStatus.OK)
  startReview(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string) {
    return this.disputes.startReview(admin, id);
  }

  @Post(':id/resolve')
  @HttpCode(HttpStatus.OK)
  resolve(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ResolveDisputeDto,
  ) {
    return this.disputes.resolve(admin, id, dto.resolution);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  reject(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ResolveDisputeDto,
  ) {
    return this.disputes.reject(admin, id, dto.resolution);
  }

  @Get(':id/attachments/:attachmentId/content')
  @Header('X-Content-Type-Options', 'nosniff')
  content(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    return this.disputes.attachment(admin, id, attachmentId);
  }
}
