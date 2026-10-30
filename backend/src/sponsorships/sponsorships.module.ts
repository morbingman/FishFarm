import { Module } from '@nestjs/common';
import { CompanySponsorshipsController } from './company-sponsorships.controller.js';
import { SponsorshipsController } from './sponsorships.controller.js';
import { SponsorshipsService } from './sponsorships.service.js';

@Module({
  controllers: [SponsorshipsController, CompanySponsorshipsController],
  providers: [SponsorshipsService],
})
export class SponsorshipsModule {}
