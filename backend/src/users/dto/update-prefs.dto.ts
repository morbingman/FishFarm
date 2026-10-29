import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, ValidateIf } from 'class-validator';

export class UpdatePrefsDto {
  @ApiPropertyOptional({ description: 'Order and listing status updates.' })
  @Transform(({ obj, key }) => obj[key])
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean({ message: 'validation.boolean' })
  status?: boolean;

  @ApiPropertyOptional({ description: 'System announcements.' })
  @Transform(({ obj, key }) => obj[key])
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean({ message: 'validation.boolean' })
  system?: boolean;

  @ApiPropertyOptional({ description: 'Reminders and follow-ups.' })
  @Transform(({ obj, key }) => obj[key])
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean({ message: 'validation.boolean' })
  reminders?: boolean;
}
