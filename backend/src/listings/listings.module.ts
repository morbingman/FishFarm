import { Module } from '@nestjs/common';
import { AdminActivityController } from './admin-activity.controller.js';
import { AdminListingsController } from './admin-listings.controller.js';
import { CompanyListingsController } from './company-listings.controller.js';
import { ListingsService } from './listings.service.js';

@Module({
  controllers: [CompanyListingsController, AdminListingsController, AdminActivityController],
  providers: [ListingsService],
  exports: [ListingsService],
})
export class ListingsModule {}
