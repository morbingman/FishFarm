import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, Matches } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({ example: 'new.buyer@example.com' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'validation.email' })
  email!: string;

  @ApiPropertyOptional({
    example: '123456',
    description: 'Omit to request a new code. Provide it to confirm the address.',
  })
  @IsOptional()
  @Matches(/^\d{6}$/, { message: 'validation.codeFormat' })
  code?: string;
}
