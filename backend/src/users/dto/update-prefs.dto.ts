import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdatePrefsDto {
  @ApiPropertyOptional({ description: 'Order and listing status updates.' })
  @IsOptional()
  @IsBoolean({ message: 'validation.boolean' })
  status?: boolean;

  @ApiPropertyOptional({ description: 'System announcements.' })
  @IsOptional()
  @IsBoolean({ message: 'validation.boolean' })
  system?: boolean;

  @ApiPropertyOptional({ description: 'Reminders and follow-ups.' })
  @IsOptional()
  @IsBoolean({ message: 'validation.boolean' })
  reminders?: boolean;
}
