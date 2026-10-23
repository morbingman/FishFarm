import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import type { AuthenticatedUser } from '../auth/types.js';
import { CartService } from './cart.service.js';
import { AddCartItemDto, UpdateCartItemDto } from './dto/cart.dto.js';

@ApiTags('cart')
@ApiBearerAuth('access-token')
@Controller('me/cart')
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  @RequirePermissions('order.create')
  @ApiOperation({ summary: 'Current cart with live prices and availability' })
  get(@CurrentUser() user: AuthenticatedUser) {
    return this.cart.get(user.id);
  }

  @Post('items')
  @RequirePermissions('order.create')
  @ApiOperation({ summary: 'Add a listing to the cart (adds to an existing quantity)' })
  add(@CurrentUser() user: AuthenticatedUser, @Body() dto: AddCartItemDto) {
    return this.cart.add(user.id, dto.listingId, dto.quantity ?? 1);
  }

  @Patch('items/:listingId')
  @RequirePermissions('order.create')
  @ApiOperation({ summary: 'Set the quantity of one cart line' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('listingId') listingId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cart.update(user.id, listingId, dto.quantity);
  }

  @Delete('items/:listingId')
  @RequirePermissions('order.create')
  @ApiOperation({ summary: 'Remove one cart line' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('listingId') listingId: string) {
    return this.cart.remove(user.id, listingId);
  }

  @Delete()
  @RequirePermissions('order.create')
  @ApiOperation({ summary: 'Empty the cart' })
  clear(@CurrentUser() user: AuthenticatedUser) {
    return this.cart.clear(user.id);
  }
}
