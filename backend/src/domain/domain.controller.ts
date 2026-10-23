import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { permissionsFor } from '../auth/permissions.js';
import type { AuthenticatedUser } from '../auth/types.js';
import { DomainService } from './domain.service.js';

@ApiTags('domain')
@ApiBearerAuth('access-token')
@Controller()
export class DomainController {
  constructor(private readonly domain: DomainService) {}

  @Public() @Get('marketplace/home') marketplaceHome() {
    return this.domain.marketplaceHome();
  }
  @Public() @Get('marketplace/listings') marketplace(@Query() q: any) {
    return this.domain.marketplace(q);
  }
  @Public() @Get('marketplace/listings/:code') marketplaceOne(
    @Param('code') code: string,
  ) {
    return this.domain.marketplaceOne(code);
  }
  @Public() @Get('marketplace/sellers/:name') marketplaceSeller(
    @Param('name') name: string,
  ) {
    return this.domain.marketplaceSeller(name);
  }

  @Get('admin/listings') @RequirePermissions('listing.update') managedListings(
    @CurrentUser() u: AuthenticatedUser,
    @Query('status') status?: string,
  ) {
    return this.domain.sellerListings(u, status);
  }
  @Post('admin/listings') @RequirePermissions('listing.create') createListing(
    @CurrentUser() u: AuthenticatedUser,
    @Body() b: any,
  ) {
    return this.domain.createListing(u, b);
  }
  @Patch('admin/listings/:code')
  @RequirePermissions('listing.update')
  updateListing(
    @CurrentUser() u: AuthenticatedUser,
    @Param('code') c: string,
    @Body() b: any,
  ) {
    return this.domain.updateListing(u, c, b);
  }
  @Delete('admin/listings/:code')
  @RequirePermissions('listing.delete')
  deleteListing(@CurrentUser() u: AuthenticatedUser, @Param('code') c: string) {
    return this.domain.deleteListing(u, c);
  }
  @Get('admin/listings/:code')
  @RequirePermissions('listing.update')
  adminListing(@CurrentUser() u: AuthenticatedUser, @Param('code') c: string) {
    return this.domain
      .sellerListings(u)
      .then((xs) => xs.find((x) => x.code === c));
  }
  @Post('admin/listings/:code/:action')
  @RequirePermissions('listing.update')
  moderate(
    @CurrentUser() u: AuthenticatedUser,
    @Param('code') c: string,
    @Param('action') a: string,
    @Body() b: any,
  ) {
    return this.domain.transition(u, c, a, b);
  }
  @Get('admin/users') @RequirePermissions('user.view') users() {
    return this.domain.adminUsers();
  }
  @Patch('admin/users/:email/status')
  @RequirePermissions('user.manage')
  setStatus(
    @CurrentUser() u: AuthenticatedUser,
    @Param('email') e: string,
    @Body('status') s: string,
  ) {
    return this.domain.setUserStatus(u, e, s);
  }
  @Get('admin/activity') @RequirePermissions('activity.view') activity(
    @Query() q: any,
  ) {
    return this.domain.activityLog(q);
  }
  @Get('admin/orders') @RequirePermissions('order.fulfill') adminOrders() {
    return this.domain.adminOrders();
  }
  @Patch('admin/orders/:code/status')
  @RequirePermissions('order.fulfill')
  updateOrder(
    @CurrentUser() u: AuthenticatedUser,
    @Param('code') c: string,
    @Body('status') s: string,
  ) {
    return this.domain.updateOrder(u, c, s);
  }
  @Get('admin/roles') @RequirePermissions('user.view') roles() {
    return ['Buyer', 'Seller', 'Admin'].map((role) => ({
      role,
      permissions: permissionsFor(role as any),
    }));
  }

  @Get('me/favorites') favorites(@CurrentUser() u: AuthenticatedUser) {
    return this.domain.favorites(u);
  }
  @Post('me/favorites/:code') addFavorite(
    @CurrentUser() u: AuthenticatedUser,
    @Param('code') c: string,
  ) {
    return this.domain.addFavorite(u, c);
  }
  @Delete('me/favorites/:code') removeFavorite(
    @CurrentUser() u: AuthenticatedUser,
    @Param('code') c: string,
  ) {
    return this.domain.removeFavorite(u, c);
  }
  @Get('me/cart') cart(@CurrentUser() u: AuthenticatedUser) {
    return this.domain.cart(u);
  }
  @Put('me/cart/:code') @RequirePermissions('order.create') putCart(
    @CurrentUser() u: AuthenticatedUser,
    @Param('code') c: string,
    @Body('quantity') q = 1,
  ) {
    return this.domain.putCart(u, c, Number(q));
  }
  @Delete('me/cart/:code') removeCart(
    @CurrentUser() u: AuthenticatedUser,
    @Param('code') c: string,
  ) {
    return this.domain.removeCart(u, c);
  }

  @Post('orders') @RequirePermissions('order.create') createOrder(
    @CurrentUser() u: AuthenticatedUser,
    @Body() b: any,
  ) {
    return this.domain.createOrder(u, b);
  }
  @Get('me/orders') @RequirePermissions('order.view') orders(
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.domain.orders(u);
  }
  @Get('admin/summary') @RequirePermissions('order.fulfill') sellerSummary(
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.domain.sellerSummary(u);
  }
  @Get('admin/customers') @RequirePermissions('order.fulfill') sellerCustomers(
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.domain.sellerCustomers(u);
  }
  @Get('admin/reviews') @RequirePermissions('order.fulfill') sellerReviews(
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.domain.sellerReviews(u);
  }
  @Get('orders/:code') order(
    @CurrentUser() u: AuthenticatedUser,
    @Param('code') c: string,
  ) {
    return this.domain.order(u, c);
  }
  @Get('orders/:code/tracking') tracking(
    @CurrentUser() u: AuthenticatedUser,
    @Param('code') c: string,
  ) {
    return this.domain.order(u, c);
  }
  @Post('orders/:code/pay') @RequirePermissions('order.create') pay(
    @CurrentUser() u: AuthenticatedUser,
    @Param('code') c: string,
    @Body() b: any,
  ) {
    return this.domain.pay(u, c, b);
  }
  @Post('orders/:code/pay-balance')
  @RequirePermissions('order.create')
  payBalance(
    @CurrentUser() u: AuthenticatedUser,
    @Param('code') c: string,
    @Body() b: any,
  ) {
    return this.domain.pay(u, c, b, true);
  }
  @Post('seller/orders/:code/mark-ready')
  @RequirePermissions('order.fulfill')
  markReady(@CurrentUser() u: AuthenticatedUser, @Param('code') c: string) {
    return this.domain.markReady(u, c);
  }
  @Post('orders/:code/confirm-delivery')
  @RequirePermissions('order.view')
  delivery(@CurrentUser() u: AuthenticatedUser, @Param('code') c: string) {
    return this.domain.confirmDelivery(u, c);
  }
  @Post('orders/:code/review') @RequirePermissions('order.view') review(
    @CurrentUser() u: AuthenticatedUser,
    @Param('code') c: string,
    @Body() b: any,
  ) {
    return this.domain.review(u, c, b);
  }
  @Post('orders/:code/dispute') @RequirePermissions('order.view') dispute(
    @CurrentUser() u: AuthenticatedUser,
    @Param('code') c: string,
    @Body() b: any,
  ) {
    return this.domain.dispute(u, c, b);
  }

  @Get('me/notifications') notifications(@CurrentUser() u: AuthenticatedUser) {
    return this.domain.notifications(u);
  }
  @Patch('notifications/:id') notification(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
    @Body('read') r = true,
  ) {
    return this.domain.markNotification(u, id, r);
  }
  @Post('notifications/read-all') readAll(@CurrentUser() u: AuthenticatedUser) {
    return this.domain.readAll(u);
  }
  @Delete('notifications/:id') deleteNotification(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.domain.deleteNotification(u, id);
  }

  @Get('me/conversations') conversations(@CurrentUser() u: AuthenticatedUser) {
    return this.domain.conversations(u);
  }
  @Post('me/conversations') startConversation(
    @CurrentUser() u: AuthenticatedUser,
    @Body() b: any,
  ) {
    return this.domain.startConversation(u, b);
  }
  @Get('conversations/:id/messages') messages(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.domain.messages(u, id);
  }
  @Post('conversations/:id/messages') sendMessage(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
    @Body('body') b: string,
  ) {
    return this.domain.sendMessage(u, id, b);
  }

  @Public() @Get('batches') batches() {
    return this.domain.batches();
  }
  @Public() @Get('batches/:code') batch(@Param('code') c: string) {
    return this.domain.batch(c);
  }
  @Get('admin/batches')
  @RequirePermissions('batch.update')
  adminBatches(@CurrentUser() u: AuthenticatedUser) {
    return this.domain.adminBatches(u);
  }
  @Post('admin/batches')
  @RequirePermissions('batch.create')
  createBatch(@CurrentUser() u: AuthenticatedUser, @Body() b: any) {
    return this.domain.createBatch(u, b);
  }
  @Get('admin/sponsorships')
  @RequirePermissions('batch.update')
  adminSponsorships(@CurrentUser() u: AuthenticatedUser) {
    return this.domain.adminSponsorships(u);
  }
  @Patch('admin/sponsorships/:id/status')
  @RequirePermissions('batch.update')
  updateSponsorshipStatus(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return this.domain.updateSponsorshipStatus(u, id, status);
  }
  @Get('me/sponsorships') @RequirePermissions('batch.sponsor') sponsorships(
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.domain.sponsorships(u);
  }
  @Post('batches/:code/sponsor') @RequirePermissions('batch.sponsor') sponsor(
    @CurrentUser() u: AuthenticatedUser,
    @Param('code') c: string,
    @Body() b: any,
  ) {
    return this.domain.sponsor(u, c, b);
  }
  @Post('sponsorships/:id/pay')
  @RequirePermissions('batch.sponsor')
  paySponsorship(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
    @Body() b: any,
  ) {
    return this.domain.paySponsorship(u, id, b);
  }
}
