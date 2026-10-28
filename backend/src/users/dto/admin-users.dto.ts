import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class AdminUsersQueryDto {
  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @Transform(({ obj, key }) => typeof obj[key] === 'string' ? obj[key].trim() : obj[key])
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ enum: ['active', 'suspended'] })
  @IsOptional()
  @Transform(({ obj, key }) => obj[key])
  @IsIn(['active', 'suspended'])
  status?: 'active' | 'suspended';

  @ApiPropertyOptional({ enum: ['User', 'Admin'] })
  @IsOptional()
  @Transform(({ obj, key }) => obj[key])
  @IsIn(['User', 'Admin'])
  role?: 'User' | 'Admin';

  @ApiPropertyOptional({ default: 1, minimum: 1, maximum: 1000000 })
  @Transform(({ obj, key }) => /^\d+$/.test(obj[key]) ? Number(obj[key]) : NaN)
  @IsInt()
  @Min(1)
  @Max(1000000)
  page: number = 1;

  @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 100 })
  @Transform(({ obj, key }) => /^\d+$/.test(obj[key]) ? Number(obj[key]) : NaN)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 25;
}

export class UpdateUserStatusDto {
  @ApiProperty({ enum: ['active', 'suspended'] })
  @Transform(({ obj, key }) => obj[key])
  @IsIn(['active', 'suspended'])
  status!: 'active' | 'suspended';

  @ApiProperty({ enum: ['active', 'suspended'] })
  @Transform(({ obj, key }) => obj[key])
  @IsIn(['active', 'suspended'])
  expectedStatus!: 'active' | 'suspended';
}
