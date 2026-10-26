import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import type { AuthenticatedUser } from '../auth/types.js';
import { BatchesService } from './batches.service.js';
import { BatchUpdateDto, SaveBatchDto, UpdateBatchDto } from './dto/batch.dto.js';
import { CompanyBatchQueryDto } from './dto/batch-query.dto.js';

@ApiTags('company')
@ApiBearerAuth('access-token')
@Controller('company/batches')
export class CompanyBatchesController {
  constructor(private readonly batches: BatchesService) {}

  @Get()
  @RequirePermissions('batch.update')
  list(@Query() query: CompanyBatchQueryDto) { return this.batches.companyList(query); }

  @Post()
  @RequirePermissions('batch.create')
  create(@CurrentUser() admin: AuthenticatedUser, @Body() dto: SaveBatchDto) { return this.batches.create(admin, dto); }

  @Get(':id')
  @RequirePermissions('batch.update')
  one(@Param('id') id: string) { return this.batches.companyOne(id); }

  @Patch(':id')
  @RequirePermissions('batch.update')
  update(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateBatchDto) { return this.batches.update(admin, id, dto); }

  @Delete(':id')
  @RequirePermissions('batch.update')
  remove(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string) { return this.batches.remove(admin, id); }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('batch.create')
  publish(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string) { return this.batches.publish(admin, id); }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('batch.create')
  submit(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string) { return this.batches.submit(admin, id); }

  @Post(':id/updates')
  @RequirePermissions('batch.update')
  addUpdate(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string, @Body() dto: BatchUpdateDto) { return this.batches.addUpdate(admin, id, dto); }
}
