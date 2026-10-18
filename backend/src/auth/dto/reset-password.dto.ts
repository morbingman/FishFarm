import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ example: 'buyer@fishmarket.demo' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'validation.email' })
  email!: string;

  @ApiProperty({ example: '123456' })
  @Matches(/^\d{6}$/, { message: 'validation.codeFormat' })
  code!: string;

  @ApiProperty({ minLength: 8, maxLength: 128, example: 'NewSecurePass123' })
  @IsString()
  @MinLength(8, { message: 'validation.passwordLength' })
  @MaxLength(128, { message: 'validation.passwordLength' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, { message: 'validation.passwordWeak' })
  newPassword!: string;
}
