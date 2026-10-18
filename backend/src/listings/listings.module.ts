import { Module } from '@nestjs/common';
import { AdminActivityController } from './admin-activity.controller.js';
import { AdminListingsController } from './admin-listings.controller.js';
import { ListingsService } from './listings.service.js';
import { SellerListingsController } from './seller-listings.controller.js';

@Module({
  controllers: [SellerListingsController, AdminListingsController, AdminActivityController],
  providers: [ListingsService],
  exports: [ListingsService],
})
export class ListingsModule {}
