import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsISO8601,
  MinLength,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export const PAYMENT_METHODS = ['bank_card', 'e_wallet', 'bank_transfer'] as const;
export type PaymentMethodInput = (typeof PAYMENT_METHODS)[number];

export const ORDER_FILTERS = [
  'all',
  'pending_payment',
  'paid',
  'ready',
  'shipped',
  'delivered',
  'completed',
  'cancelled',
  'refunded',
] as const;
export type OrderFilter = (typeof ORDER_FILTERS)[number];

export class OrderLineDto {
  @ApiProperty({ example: 'FM-19544' })
  @IsString()
  @MaxLength(64)
  listingId!: string;

  @ApiProperty({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreateOrderDto {
  @ApiPropertyOptional({
    type: [OrderLineDto],
    description: 'Defaults to the current cart when omitted.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => OrderLineDto)
  items?: OrderLineDto[];

  @ApiProperty({ example: 'Alex Nguyen' })
  @IsString()
  @MaxLength(80)
  recipientName!: string;

  @ApiProperty({ example: '+84 90 123 4567' })
  @IsString()
  @MaxLength(32)
  phone!: string;

  @ApiProperty({ example: '128 Nguyen Van Huong, Thao Dien' })
  @IsString()
  @MaxLength(200)
  address!: string;

  @ApiPropertyOptional({ example: 'Ho Chi Minh City' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @ApiPropertyOptional({ example: 'Ho Chi Minh City' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  province?: string;

  @ApiPropertyOptional({ example: 'Domestic overnight' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  deliveryMethod?: string;

  @ApiProperty({ enum: PAYMENT_METHODS })
  @IsIn(PAYMENT_METHODS)
  paymentMethod!: PaymentMethodInput;

  @ApiPropertyOptional({
    default: 0,
    description: 'Shipping charged by the company, VND integer đồng.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  shippingFee?: number;

  @ApiPropertyOptional({
    description: 'Client-supplied key so a double-submit cannot place two orders.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9._:-]{8,80}$/, { message: 'validation.idempotencyKey' })
  idempotencyKey?: string;
}

export class ShipOrderDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  trackingCarrier?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  trackingNumber?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsISO8601({ strict: true })
  estimatedDeliveryAt?: string;
}

export class ListOrdersDto {
  @ApiPropertyOptional({ enum: ORDER_FILTERS, default: 'all' })
  @IsOptional()
  @IsIn(ORDER_FILTERS)
  status?: OrderFilter;
}
