import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export const SELLER_LISTING_FILTERS = [
  'all',
  'draft',
  'pending',
  'approved',
  'paused',
  'changes',
  'rejected',
  'attention',
] as const;

export type SellerListingFilter = (typeof SELLER_LISTING_FILTERS)[number];

export class ListSellerListingsDto {
  @ApiPropertyOptional({ enum: SELLER_LISTING_FILTERS, default: 'all' })
  @IsOptional()
  @IsIn(SELLER_LISTING_FILTERS)
  status?: SellerListingFilter;
}

export const ADMIN_QUEUE_TABS = ['pending', 'approved', 'changes'] as const;

export type AdminQueueTab = (typeof ADMIN_QUEUE_TABS)[number];

export class AdminQueueDto {
  @ApiPropertyOptional({ enum: ADMIN_QUEUE_TABS, default: 'pending' })
  @IsOptional()
  @IsIn(ADMIN_QUEUE_TABS)
  tab?: AdminQueueTab;
}
