import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export const COMPANY_LISTING_FILTERS = [
  'all',
  'draft',
  'pending',
  'approved',
  'paused',
  'changes',
  'rejected',
  'attention',
] as const;

export type CompanyListingFilter = (typeof COMPANY_LISTING_FILTERS)[number];

export class ListCompanyListingsDto {
  @ApiPropertyOptional({ enum: COMPANY_LISTING_FILTERS, default: 'all' })
  @IsOptional()
  @IsIn(COMPANY_LISTING_FILTERS)
  status?: CompanyListingFilter;
}

export const ADMIN_QUEUE_TABS = ['pending', 'approved', 'changes'] as const;

export type AdminQueueTab = (typeof ADMIN_QUEUE_TABS)[number];

export class AdminQueueDto {
  @ApiPropertyOptional({ enum: ADMIN_QUEUE_TABS, default: 'pending' })
  @IsOptional()
  @IsIn(ADMIN_QUEUE_TABS)
  tab?: AdminQueueTab;
}
