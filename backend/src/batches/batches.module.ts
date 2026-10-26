import { Module } from '@nestjs/common';
import { AdminBatchesController } from './admin-batches.controller.js';
import { BatchesController } from './batches.controller.js';
import { BatchesService } from './batches.service.js';
import { CompanyBatchesController } from './company-batches.controller.js';

@Module({
  controllers: [BatchesController, CompanyBatchesController, AdminBatchesController],
  providers: [BatchesService],
})
export class BatchesModule {}
