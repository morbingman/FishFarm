import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  type SchemaObject,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import type { AuthenticatedUser } from '../auth/types.js';
import { AppException } from '../common/exceptions/app.exception.js';
import { NotificationsService } from './notifications.service.js';
import {
  EmptyNotificationsBodyPipe,
  MarkNotificationReadPipe,
  NotificationsQueryDto,
} from './notifications.validation.js';

// An unconstrained OpenAPI schema includes every JSON value, including null,
// nested objects/arrays and scalars, matching Prisma's nullable JsonValue.
const jsonParamsSchema: SchemaObject = {
  description:
    'Nullable existing JSON value; objects, arrays and scalars are preserved without restriction.',
};
const notificationSchema: SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: [
    'id',
    'type',
    'titleKey',
    'titleParams',
    'bodyKey',
    'bodyParams',
    'link',
    'readAt',
    'createdAt',
  ],
  properties: {
    id: { type: 'string' },
    type: {
      type: 'string',
      enum: ['success', 'error', 'system', 'status', 'approval', 'reminder'],
    },
    titleKey: { type: 'string' },
    titleParams: jsonParamsSchema,
    bodyKey: { type: 'string' },
    bodyParams: jsonParamsSchema,
    link: { type: 'string', nullable: true },
    readAt: {
      type: 'string',
      format: 'date-time',
      nullable: true,
      description: 'ISO UTC timestamp, or null when unread.',
    },
    createdAt: {
      type: 'string',
      format: 'date-time',
      description: 'ISO UTC timestamp.',
    },
  },
};

@ApiTags('notifications')
@ApiBearerAuth('access-token')
@RequirePermissions('profile.update')
@Controller()
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('me/notifications')
  @ApiOperation({ summary: 'Own notification inbox' })
  @ApiOkResponse({
    description:
      'Recipient-owned full history ordered by createdAt DESC, then id ASC. Items and both counts share a RepeatableRead snapshot.',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['items', 'total', 'unreadTotal', 'page', 'limit'],
      properties: {
        items: { type: 'array', maxItems: 100, items: notificationSchema },
        total: {
          type: 'integer',
          minimum: 0,
          description:
            'Total matching read/type filters, independent of pagination.',
        },
        unreadTotal: {
          type: 'integer',
          minimum: 0,
          description:
            'All unread notifications owned by the actor, independent of filters and pagination.',
        },
        page: { type: 'integer', minimum: 1, maximum: 1000000, default: 1 },
        limit: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
      },
    },
  })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: NotificationsQueryDto,
  ) {
    return this.notifications.list(user.id, query);
  }

  @Patch('notifications/:id')
  @ApiOperation({ summary: 'Mark an owned notification read' })
  @ApiBody({
    required: true,
    description:
      'Exactly {"read":true}, with a raw boolean. False, strings, null and additional fields are rejected; marking unread is not supported.',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['read'],
      properties: { read: { type: 'boolean', enum: [true] } },
    },
  })
  @ApiOkResponse({
    description:
      'Exact owned notification projection. Repeated or concurrent reads preserve the original nonnull readAt.',
    schema: {
      ...notificationSchema,
      properties: {
        ...notificationSchema.properties,
        readAt: {
          type: 'string',
          format: 'date-time',
          description:
            'Original first-read ISO UTC timestamp; preserved on repeat.',
        },
      },
    },
  })
  markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(MarkNotificationReadPipe) _body: unknown,
  ) {
    return this.notifications.markRead(user.id, id);
  }

  @Post('notifications/read-all')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Mark all currently unread owned notifications read',
  })
  @ApiBody({
    required: false,
    description:
      'Bodyless request; an empty object {} is also accepted. Payload fields, arrays, strings, booleans and null are rejected.',
    schema: { type: 'object', additionalProperties: false, maxProperties: 0 },
  })
  @ApiOkResponse({
    description:
      'Single UPDATE over all actor-owned unread rows, independent of page/type/read filters. Prior timestamps are preserved. Arrivals after the UPDATE snapshot may remain unread, so this does not assert an empty inbox. Repeats return updated: 0 with a new operation timestamp.',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['updated', 'readAt'],
      properties: {
        updated: {
          type: 'integer',
          minimum: 0,
          description: 'Number of rows changed by this UPDATE.',
        },
        readAt: {
          type: 'string',
          format: 'date-time',
          description:
            'ISO UTC timestamp of this operation, even when updated is zero.',
        },
      },
    },
  })
  readAll(
    @CurrentUser() user: AuthenticatedUser,
    @Body(EmptyNotificationsBodyPipe) body: unknown,
    @Req() request: Request,
  ) {
    // Unsupported content types are unparsed, not necessarily bodyless.
    if (
      body === undefined &&
      (request.headers['transfer-encoding'] !== undefined ||
        Number(request.headers['content-length'] ?? 0) !== 0)
    ) {
      throw new AppException('validation.failed', HttpStatus.BAD_REQUEST);
    }
    return this.notifications.readAll(user.id);
  }
}
