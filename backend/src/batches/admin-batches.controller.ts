import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import type { AuthenticatedUser } from '../auth/types.js';
import { BatchesService } from './batches.service.js';
import { BatchReviewDto } from './dto/batch.dto.js';

@ApiTags('admin')
@ApiBearerAuth('access-token')
@Controller('admin/batches')
@RequirePermissions('batch.review')
export class AdminBatchesController {
  constructor(private readonly batches: BatchesService) {}

  @Get()
  queue() { return this.batches.queue(); }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  approve(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string) { return this.batches.approve(admin, id); }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  reject(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string, @Body() dto: BatchReviewDto) { return this.batches.reject(admin, id, dto); }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string, @Body() dto: BatchReviewDto) { return this.batches.cancel(admin, id, dto); }
}
