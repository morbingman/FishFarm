import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export const DISPUTE_REASONS = [
  'fish_unwell',
  'not_as_described',
  'damaged_packaging',
  'not_received',
  'other',
] as const;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateDisputeDto {
  @IsIn(DISPUTE_REASONS)
  reason!: (typeof DISPUTE_REASONS)[number];

  @Transform(trim)
  @IsString()
  @MinLength(15)
  @MaxLength(2000)
  description!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ArrayUnique()
  @IsString({ each: true })
  uploadIds?: string[];
}

export class ResolveDisputeDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  resolution!: string;
}
