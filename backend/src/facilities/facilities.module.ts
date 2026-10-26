import { Module } from '@nestjs/common';
import { UploadsModule } from '../uploads/uploads.module.js';
import { AdminFacilitiesController } from './admin-facilities.controller.js';
import { CompanyFacilitiesController } from './company-facilities.controller.js';
import { FacilitiesService } from './facilities.service.js';

@Module({
  imports: [UploadsModule],
  controllers: [CompanyFacilitiesController, AdminFacilitiesController],
  providers: [FacilitiesService],
})
export class FacilitiesModule {}
