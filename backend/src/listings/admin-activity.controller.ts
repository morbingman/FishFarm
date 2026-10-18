import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { ListingsService } from './listings.service.js';

@ApiTags('admin')
@ApiBearerAuth('access-token')
@Controller('admin/activity')
export class AdminActivityController {
  constructor(private readonly listings: ListingsService) {}

  @Get()
  @RequirePermissions('activity.view')
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 100 })
  @ApiOperation({ summary: 'Recent platform activity (newest first)' })
  list(@Query('limit') limit?: string) {
    const parsed = Number(limit);
    return this.listings.activity(Number.isFinite(parsed) ? parsed : 100);
  }
}
