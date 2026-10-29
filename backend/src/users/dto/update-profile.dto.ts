import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 80 })
  @Transform(({ obj, key }) => obj[key])
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MinLength(1, { message: 'validation.nameLength' })
  @Matches(/\S/u, { message: 'validation.nameLength' })
  @MaxLength(80, { message: 'validation.nameLength' })
  name?: string;

  @ApiPropertyOptional({ example: '+84 90 123 4567' })
  @Transform(({ obj, key }) => obj[key])
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(32, { message: 'validation.tooLong' })
  phone?: string;

  @ApiPropertyOptional({ example: 'Ho Chi Minh City' })
  @Transform(({ obj, key }) => obj[key])
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(120, { message: 'validation.tooLong' })
  location?: string;
}
