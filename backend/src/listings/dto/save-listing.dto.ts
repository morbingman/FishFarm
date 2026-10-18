import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { SaleMode } from '../../generated/prisma/enums.js';

export class ListingImageDto {
  @ApiProperty({ example: 'https://images.example.com/koi.jpg' })
  @IsString()
  @MaxLength(2048, { message: 'validation.tooLong' })
  url!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isMain?: boolean;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}

/**
 * Draft content. Every field is optional so the six-step seller wizard can save
 * progress; completeness is enforced on submit, not on save.
 */
export class SaveListingDto {
  @ApiPropertyOptional({ example: 'Kohaku Koi, 40 cm' })
  @IsOptional()
  @IsString()
  @MaxLength(120, { message: 'validation.tooLong' })
  name?: string;

  @ApiPropertyOptional({ example: 'Koi' })
  @IsOptional()
  @IsString()
  @MaxLength(40, { message: 'validation.tooLong' })
  species?: string;

  @ApiPropertyOptional({ example: 'Kohaku' })
  @IsOptional()
  @IsString()
  @MaxLength(80, { message: 'validation.tooLong' })
  breed?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000, { message: 'validation.tooLong' })
  description?: string;

  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(600)
  ageMonths?: number;

  @ApiPropertyOptional({ example: 40 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  sizeCm?: number;

  @ApiPropertyOptional({ example: 'Female' })
  @IsOptional()
  @IsString()
  @MaxLength(40, { message: 'validation.tooLong' })
  gender?: string;

  @ApiPropertyOptional({ example: 'Niigata, Japan' })
  @IsOptional()
  @IsString()
  @MaxLength(80, { message: 'validation.tooLong' })
  origin?: string;

  @ApiPropertyOptional({ example: 'Excellent — vet certified' })
  @IsOptional()
  @IsString()
  @MaxLength(120, { message: 'validation.tooLong' })
  health?: string;

  @ApiPropertyOptional({ example: 720, description: 'VND integer đồng.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100_000)
  quantity?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  negotiable?: boolean;

  @ApiPropertyOptional({ example: '128 Nguyen Van Huong, Thao Dien' })
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'validation.tooLong' })
  location?: string;

  @ApiPropertyOptional({ example: 'Ho Chi Minh City' })
  @IsOptional()
  @IsString()
  @MaxLength(80, { message: 'validation.tooLong' })
  region?: string;

  @ApiPropertyOptional({ type: [String], example: ['Local pickup', 'Domestic overnight'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(80, { each: true, message: 'validation.tooLong' })
  shipping?: string[];

  @ApiPropertyOptional({ enum: SaleMode, default: SaleMode.in_stock })
  @IsOptional()
  @IsEnum(SaleMode)
  saleMode?: SaleMode;

  @ApiPropertyOptional({ minimum: 20, maximum: 30, description: 'Required for pre_order.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  depositPct?: number;

  @ApiPropertyOptional({ example: '2026-12-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString({}, { message: 'validation.date' })
  expectedReadyDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'validation.tooLong' })
  preorderPolicy?: string;

  @ApiPropertyOptional({ type: [ListingImageDto], maxItems: 8 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => ListingImageDto)
  images?: ListingImageDto[];
}

export class ModerateListingDto {
  @ApiProperty({ example: 'Incomplete fish details' })
  @IsString()
  @MinLength(1, { message: 'validation.required' })
  @MaxLength(120, { message: 'validation.tooLong' })
  reason!: string;

  @ApiProperty({ minLength: 10, maxLength: 2000 })
  @IsString()
  @MinLength(10, { message: 'validation.feedbackLength' })
  @MaxLength(2000, { message: 'validation.tooLong' })
  feedback!: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 6, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(6)
  step?: number;
}

export class TakedownListingDto {
  @ApiProperty({ minLength: 10, maxLength: 2000 })
  @IsString()
  @MinLength(10, { message: 'validation.feedbackLength' })
  @MaxLength(2000, { message: 'validation.tooLong' })
  reason!: string;
}
