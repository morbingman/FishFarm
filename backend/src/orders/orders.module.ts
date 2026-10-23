import { Module } from '@nestjs/common';
import { CartController } from './cart.controller.js';
import { CartService } from './cart.service.js';
import { CompanyOrdersController } from './company-orders.controller.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';

@Module({
  controllers: [CartController, OrdersController, CompanyOrdersController],
  providers: [CartService, OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
