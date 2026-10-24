import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class GoogleLoginDto {
  @ApiProperty({ description: 'Google Identity Services ID token' })
  @IsString()
  @MinLength(20)
  @MaxLength(5000)
  credential!: string;
}
