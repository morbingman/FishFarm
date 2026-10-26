import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator.js';
import { BatchesService } from './batches.service.js';
import { PublicBatchQueryDto } from './dto/batch-query.dto.js';

@ApiTags('batches')
@Public()
@Controller('batches')
export class BatchesController {
  constructor(private readonly batches: BatchesService) {}

  @Get()
  list(@Query() query: PublicBatchQueryDto) { return this.batches.publicList(query); }

  @Get(':id')
  one(@Param('id') id: string) { return this.batches.publicOne(id); }

  @Get(':id/updates')
  updates(@Param('id') id: string) { return this.batches.publicUpdates(id); }
}
