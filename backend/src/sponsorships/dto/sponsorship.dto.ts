import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { SponsorshipStatus } from '../../generated/prisma/enums.js';

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

export const PAYMENT_METHODS = ['bank_card', 'e_wallet', 'bank_transfer'] as const;

export class CreateSponsorshipDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  shares!: number;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  recipientName!: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  phone!: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  address!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  province?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  deliveryMethod?: string;
}

export class PaySponsorshipDto {
  @ApiProperty({ enum: PAYMENT_METHODS })
  @IsIn(PAYMENT_METHODS)
  paymentMethod!: (typeof PAYMENT_METHODS)[number];

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(8)
  @MaxLength(120)
  idempotencyKey?: string;
}

export class SponsorshipCancelDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason?: string;
}

export class HarvestBatchDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000_000)
  actualCount!: number;

  /** Required for weight-share batches (total batch biomass in grams). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2_000_000_000)
  actualWeightG?: number;

  /** §11.4: optional last-mile delivery fee charged per share at harvest (VND). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  deliveryFeePerShare?: number;
}

export class ListSponsorshipsDto {
  @IsOptional()
  @IsIn(Object.values(SponsorshipStatus))
  status?: SponsorshipStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  skip?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number;
}
