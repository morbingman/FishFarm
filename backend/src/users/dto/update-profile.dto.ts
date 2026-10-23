import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 80 })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'validation.nameLength' })
  @MaxLength(80, { message: 'validation.nameLength' })
  name?: string;

  @ApiPropertyOptional({ example: '+84 90 123 4567' })
  @IsOptional()
  @IsString()
  @MaxLength(32, { message: 'validation.tooLong' })
  phone?: string;

  @ApiPropertyOptional({ example: 'Ho Chi Minh City' })
  @IsOptional()
  @IsString()
  @MaxLength(120, { message: 'validation.tooLong' })
  location?: string;

  @ApiPropertyOptional({
    example: 'Golden Koi Farm',
    description: 'Sellers only.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80, { message: 'validation.tooLong' })
  store?: string;
}
