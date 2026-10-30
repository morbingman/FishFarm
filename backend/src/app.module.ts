import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { BatchesModule } from './batches/batches.module.js';
import { CompanyModule } from './company/company.module.js';
import { validateEnv } from './config/env.validation.js';
import { DisputesModule } from './disputes/disputes.module.js';
import { FacilitiesModule } from './facilities/facilities.module.js';
import { HealthModule } from './health/health.module.js';
import { ListingsModule } from './listings/listings.module.js';
import { MarketplaceModule } from './marketplace/marketplace.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { SponsorshipsModule } from './sponsorships/sponsorships.module.js';
import { UploadsModule } from './uploads/uploads.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    CompanyModule,
    AuthModule,
    UsersModule,
    NotificationsModule,
    ListingsModule,
    MarketplaceModule,
    OrdersModule,
    DisputesModule,
    FacilitiesModule,
    BatchesModule,
    SponsorshipsModule,
    UploadsModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
