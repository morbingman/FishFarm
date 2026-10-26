import { PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { BatchStage, CostAllocation, CostCategory, ShareUnitType } from '../../generated/prisma/enums.js';

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

export class BatchImageDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  url!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position?: number;
}

export class BatchCostDto {
  @IsIn(Object.values(CostCategory))
  category!: CostCategory;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  amount!: number;

  @IsIn(Object.values(CostAllocation))
  allocation!: CostAllocation;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class SaveBatchDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  species!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  breed?: string;

  @Transform(trim)
  @IsString()
  @MinLength(20)
  @MaxLength(4000)
  description!: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  location!: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  region!: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  stockingDate?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  expectedHarvestDate?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  stockCount!: number;

  @IsIn(Object.values(ShareUnitType))
  shareUnitType!: ShareUnitType;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  shareQuantity!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedHarvestWeightG?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  packagePricePerShare!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  contingencyPct?: number;

  @Transform(trim)
  @IsString()
  @MinLength(20)
  @MaxLength(4000)
  riskDisclosure!: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  termsVersion!: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  facilityId!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => BatchImageDto)
  images?: BatchImageDto[];

  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => BatchCostDto)
  costs!: BatchCostDto[];
}

export class UpdateBatchDto extends PartialType(SaveBatchDto) {}

export class BatchReviewDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  note!: string;
}

export class BatchUpdateDto {
  @IsIn(Object.values(BatchStage))
  stage!: BatchStage;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  averageWeightG?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  countAlive?: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  note?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  photoUrls?: string[];
}
