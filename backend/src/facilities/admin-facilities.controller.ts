import { Body, Controller, Get, Header, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import type { AuthenticatedUser } from '../auth/types.js';
import { InspectFacilityDto } from './dto/facility.dto.js';
import { FacilitiesService } from './facilities.service.js';

@ApiTags('admin')
@ApiBearerAuth('access-token')
@Controller('admin/facilities')
@RequirePermissions('batch.review')
export class AdminFacilitiesController {
  constructor(private readonly facilities: FacilitiesService) {}

  @Get(':id/verification')
  verification(@Param('id') id: string) { return this.facilities.verification(id); }

  @Post(':id/inspect')
  @HttpCode(HttpStatus.OK)
  inspect(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string, @Body() dto: InspectFacilityDto) { return this.facilities.inspect(admin, id, dto); }

  @Get(':id/verification/documents/:documentId/content')
  @Header('X-Content-Type-Options', 'nosniff')
  content(@Param('id') id: string, @Param('documentId') documentId: string) { return this.facilities.document(id, documentId); }
}
