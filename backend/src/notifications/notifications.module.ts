import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import {
  EmptyNotificationsBodyPipe,
  MarkNotificationReadPipe,
} from './notifications.validation.js';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    EmptyNotificationsBodyPipe,
    MarkNotificationReadPipe,
  ],
})
export class NotificationsModule {}
