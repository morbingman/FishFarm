import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import type { AuthenticatedUser } from '../auth/types.js';
import { CreateOrderDto, ListOrdersDto, PAYMENT_METHODS } from './dto/order.dto.js';
import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { OrdersService } from './orders.service.js';

export class PayBalanceDto {
  @ApiProperty({ enum: PAYMENT_METHODS })
  @IsIn(PAYMENT_METHODS)
  paymentMethod!: (typeof PAYMENT_METHODS)[number];
}

@ApiTags('orders')
@ApiBearerAuth('access-token')
@Controller()
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post('orders')
  @RequirePermissions('order.create')
  @ApiOperation({ summary: 'Check out the cart (or explicit items) into a simulated-payment order' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateOrderDto) {
    return this.orders.create(user, dto);
  }

  @Get('me/orders')
  @RequirePermissions('order.view')
  @ApiOperation({ summary: 'My orders, newest first' })
  mine(@CurrentUser() user: AuthenticatedUser, @Query() query: ListOrdersDto) {
    return this.orders.listMine(user.id, query.status);
  }

  @Get('me/orders/:id')
  @RequirePermissions('order.view')
  @ApiOperation({ summary: 'One of my orders by ORD-… code or id' })
  one(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.orders.getMine(user.id, id);
  }

  @Get('me/orders/:id/tracking')
  @RequirePermissions('order.view')
  @ApiOperation({ summary: 'Shipment details and recorded lifecycle events for my order' })
  tracking(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.orders.trackingMine(user.id, id);
  }

  @Post('me/orders/:id/confirm-delivery')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('order.view')
  @ApiOperation({ summary: 'Confirm receipt and complete a delivered order' })
  confirmDelivery(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.orders.confirmDelivery(user, id);
  }

  @Post('me/orders/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('order.view')
  @ApiOperation({ summary: 'Cancel an order before it ships; paid amounts are refunded' })
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.orders.cancelMine(user, id);
  }

  @Post('me/orders/:id/pay-balance')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('order.view')
  @ApiOperation({ summary: 'Pay the outstanding balance on a pre-order marked ready' })
  payBalance(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: PayBalanceDto,
  ) {
    return this.orders.payBalance(user, id, dto.paymentMethod);
  }
}
