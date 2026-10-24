import { IsString, MinLength, MaxLength } from 'class-validator';
export class GoogleLoginDto {
  @IsString()
  @MinLength(20)
  @MaxLength(10000)
  credential!: string;
}
