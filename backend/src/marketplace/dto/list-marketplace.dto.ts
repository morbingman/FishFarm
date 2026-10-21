import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type, type TransformFnParams } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

const toArray = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return undefined;
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
};

// Read the raw query value: with implicit conversion enabled, class-transformer
// turns the string "false" into `true` by running it through Boolean() before
// this decorator sees it.
const toBoolean = ({ obj, key }: TransformFnParams) => {
  const value = (obj as Record<string, unknown>)[key];
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  return value === 'true' || value === '1';
};

const normalizeSize = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const normalized = value.trim().toLowerCase();
  if (['under15', 'under-15', 'under 15 cm', 'under 15'].includes(normalized)) return 'under15';
  if (['15plus', '15-plus', '15 cm and above', '15 and above'].includes(normalized)) {
    return '15plus';
  }
  return value;
};

const normalizeSort = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const normalized = value.trim().toLowerCase();
  if (['price low to high', 'price_asc', 'price-asc'].includes(normalized)) return 'price_asc';
  if (['price high to low', 'price_desc', 'price-desc'].includes(normalized)) return 'price_desc';
  if (['newest', 'new'].includes(normalized)) return 'newest';
  if (normalized === 'recommended') return 'recommended';
  return value;
};

export const MARKETPLACE_SIZES = ['under15', '15plus'] as const;
export const MARKETPLACE_SORTS = ['recommended', 'price_asc', 'price_desc', 'newest'] as const;

export class ListMarketplaceDto {
  @ApiPropertyOptional({
    description: 'Free-text search across name, species, breed, company, location.',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ type: [String], description: 'Repeat or comma-separate species values.' })
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsString({ each: true })
  species?: string[];

  @ApiPropertyOptional({ example: 'Kohaku' })
  @IsOptional()
  @IsString()
  breed?: string;

  @ApiPropertyOptional({ example: 5_000_000, description: 'Maximum price in VND integer đồng.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceMax?: number;

  @ApiPropertyOptional({ enum: MARKETPLACE_SIZES, description: 'Size bucket: under 15 cm or 15 cm and above.' })
  @IsOptional()
  @Transform(normalizeSize)
  @IsIn(MARKETPLACE_SIZES)
  size?: (typeof MARKETPLACE_SIZES)[number];

  @ApiPropertyOptional({ example: 'Ho Chi Minh City' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 5, example: 4.8 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional({ default: true, description: 'Only listings with quantity > 0.' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  available?: boolean;

  @ApiPropertyOptional({ enum: MARKETPLACE_SORTS, default: 'recommended' })
  @IsOptional()
  @Transform(normalizeSort)
  @IsIn(MARKETPLACE_SORTS)
  sort?: (typeof MARKETPLACE_SORTS)[number];

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
