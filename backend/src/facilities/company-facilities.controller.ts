import { Body, Controller, Get, Header, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import type { AuthenticatedUser } from '../auth/types.js';
import { CreateFacilityDto, SaveVerificationDto } from './dto/facility.dto.js';
import { FacilitiesService } from './facilities.service.js';

@ApiTags('company')
@ApiBearerAuth('access-token')
@Controller('company/facilities')
@RequirePermissions('batch.update')
export class CompanyFacilitiesController {
  constructor(private readonly facilities: FacilitiesService) {}

  @Get()
  list() { return this.facilities.list(); }

  @Post()
  create(@CurrentUser() admin: AuthenticatedUser, @Body() dto: CreateFacilityDto) { return this.facilities.create(admin, dto); }

  @Get(':id')
  one(@Param('id') id: string) { return this.facilities.one(id); }

  @Get(':id/verification')
  verification(@Param('id') id: string) { return this.facilities.verification(id); }

  @Post(':id/verification')
  saveVerification(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string, @Body() dto: SaveVerificationDto) { return this.facilities.saveVerification(admin, id, dto); }

  @Get(':id/verification/documents/:documentId/content')
  @Header('X-Content-Type-Options', 'nosniff')
  content(@Param('id') id: string, @Param('documentId') documentId: string) { return this.facilities.document(id, documentId); }
}
