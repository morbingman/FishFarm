import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class RegisterDto {
  @ApiProperty({ example: 'new.buyer@example.com' })
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'validation.email' })
  email!: string;

  @ApiProperty({ minLength: 8, maxLength: 128, example: 'SecurePass123' })
  @IsString()
  @MinLength(8, { message: 'validation.passwordLength' })
  @MaxLength(128, { message: 'validation.passwordLength' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, { message: 'validation.passwordWeak' })
  password!: string;

  @ApiProperty({ example: 'Nguyen Van A' })
  @IsString()
  @MinLength(1, { message: 'validation.nameLength' })
  @MaxLength(80, { message: 'validation.nameLength' })
  name!: string;

  @ApiProperty({ enum: ['Buyer'] })
  @IsIn(['Buyer'], { message: 'validation.role' })
  role!: 'Buyer';

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
