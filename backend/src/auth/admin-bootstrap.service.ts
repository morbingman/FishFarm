import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { ensureDefaultAdmin } from './default-admin.js';

@Injectable()
export class AdminBootstrapService implements OnApplicationBootstrap {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await ensureDefaultAdmin(this.prisma, {
      email: this.config.get<string>('DEFAULT_ADMIN_EMAIL'),
      password: this.config.get<string>('DEFAULT_ADMIN_PASSWORD'),
    });
  }
}
