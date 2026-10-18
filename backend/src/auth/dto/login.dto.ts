import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'buyer@fishmarket.demo' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'validation.email' })
  email!: string;

  @ApiProperty({ example: 'Buyer123' })
  @IsString()
  @MinLength(1, { message: 'validation.passwordRequired' })
  @MaxLength(128, { message: 'validation.passwordLength' })
  password!: string;
}
