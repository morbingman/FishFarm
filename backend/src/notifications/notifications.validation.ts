import { HttpStatus, Injectable, type PipeTransform } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, Max, Min, ValidateIf } from 'class-validator';
import { AppException } from '../common/exceptions/app.exception.js';
import type { NotificationType } from '../generated/prisma/enums.js';

export class NotificationsQueryDto {
  @ApiPropertyOptional({ enum: ['all', 'unread', 'read'], default: 'all' })
  @Transform(({ obj, key }) => obj[key])
  @IsIn(['all', 'unread', 'read'])
  read: 'all' | 'unread' | 'read' = 'all';

  @ApiPropertyOptional({
    enum: ['success', 'error', 'system', 'status', 'approval', 'reminder'],
  })
  @Transform(({ obj, key }) => obj[key])
  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(['success', 'error', 'system', 'status', 'approval', 'reminder'])
  type?: NotificationType;

  @ApiPropertyOptional({ default: 1, minimum: 1, maximum: 1000000 })
  @Transform(({ obj, key }) =>
    typeof obj[key] === 'string' && /^\d+$/.test(obj[key])
      ? Number(obj[key])
      : NaN,
  )
  @IsInt()
  @Min(1)
  @Max(1000000)
  page: number = 1;

  @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 100 })
  @Transform(({ obj, key }) =>
    typeof obj[key] === 'string' && /^\d+$/.test(obj[key])
      ? Number(obj[key])
      : NaN,
  )
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 25;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Validate the complete raw body, not a DTO transformed by implicit conversion.
@Injectable()
export class MarkNotificationReadPipe implements PipeTransform<
  unknown,
  { read: true }
> {
  transform(value: unknown): { read: true } {
    if (
      !isObject(value) ||
      Object.keys(value).length !== 1 ||
      value.read !== true
    ) {
      throw new AppException('validation.failed', HttpStatus.BAD_REQUEST);
    }
    return { read: true };
  }
}

@Injectable()
export class EmptyNotificationsBodyPipe implements PipeTransform<
  unknown,
  unknown
> {
  transform(value: unknown): unknown {
    if (
      value !== undefined &&
      (!isObject(value) || Object.keys(value).length !== 0)
    ) {
      throw new AppException('validation.failed', HttpStatus.BAD_REQUEST);
    }
    return value;
  }
}
