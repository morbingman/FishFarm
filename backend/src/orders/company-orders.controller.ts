import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import type { AuthenticatedUser } from '../auth/types.js';
import { ListOrdersDto, ShipOrderDto } from './dto/order.dto.js';
import { OrdersService } from './orders.service.js';

export class CancelOrderDto {
  @ApiProperty({ example: 'Stock no longer available at the agreed size.' })
  @IsString()
  @MinLength(4)
  @MaxLength(300)
  reason!: string;
}

export class OptionalReasonDto {
  @ApiPropertyOptional({ description: 'Internal note recorded with the transition.' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

@ApiTags('company')
@ApiBearerAuth('access-token')
@Controller('company/orders')
export class CompanyOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  @RequirePermissions('order.fulfill')
  @ApiOperation({ summary: 'Company orders, newest first, optionally filtered by status' })
  list(@Query() query: ListOrdersDto) {
    return this.orders.listCompany(query.status);
  }

  @Get(':id')
  @RequirePermissions('order.fulfill')
  @ApiOperation({ summary: 'One company order by ORD-… code or id' })
  one(@Param('id') id: string) {
    return this.orders.getCompany(id);
  }

  @Post(':id/mark-ready')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('order.fulfill')
  @ApiOperation({
    summary: 'Mark an order ready; pre-orders start the 7-day balance window',
  })
  markReady(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string) {
    return this.orders.markReady(admin, id);
  }

  @Post(':id/ship')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('order.fulfill')
  @ApiOperation({ summary: 'Mark a ready order as shipped' })
  ship(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ShipOrderDto,
  ) {
    return this.orders.ship(admin, id, dto);
  }

  @Post(':id/deliver')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('order.fulfill')
  @ApiOperation({ summary: 'Mark a shipped order as delivered' })
  deliver(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string) {
    return this.orders.deliver(admin, id);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('order.fulfill')
  @ApiOperation({ summary: 'Close a delivered order' })
  complete(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string) {
    return this.orders.complete(admin, id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('order.fulfill')
  @ApiOperation({ summary: 'Cancel or refund an order and return its stock to the catalog' })
  cancel(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CancelOrderDto,
  ) {
    return this.orders.cancelCompany(admin, id, dto.reason);
  }
}
