import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { VerificationLevel, VerificationStatus } from '../../generated/prisma/enums.js';

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

export class CreateFacilityDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  location!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  region?: string;
}

export class VerificationDocumentDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  type!: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  uploadId!: string;
}

export class SaveVerificationDto {
  @IsIn(Object.values(VerificationLevel))
  level!: VerificationLevel;

  @IsOptional()
  @IsISO8601({ strict: true })
  inspectedAt?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  inspector?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  validUntil?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ArrayUnique((document: VerificationDocumentDto) => document.uploadId)
  @ValidateNested({ each: true })
  @Type(() => VerificationDocumentDto)
  documents!: VerificationDocumentDto[];
}

export class InspectFacilityDto {
  @IsIn(Object.values(VerificationStatus))
  status!: VerificationStatus;

  @IsOptional()
  @IsIn(Object.values(VerificationLevel))
  level?: VerificationLevel;

  @IsOptional()
  @IsISO8601({ strict: true })
  inspectedAt?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  inspector?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  validUntil?: string;
}
