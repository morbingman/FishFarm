import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import type { AuthenticatedUser } from '../auth/types.js';
import { PrismaService } from '../prisma/prisma.service.js';

const FOLDERS = {
  listing_image: 'fishfarm/listings',
  dispute_attachment: 'fishfarm/disputes',
  batch_update: 'fishfarm/batches',
  profile_avatar: 'fishfarm/profiles',
} as const;

type UploadPurpose = keyof typeof FOLDERS;

@Injectable()
export class UploadsService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  signature(user: AuthenticatedUser, rawPurpose: string) {
    const purpose = this.authorize(user, rawPurpose);
    const cloudName = this.config.get<string>('CLOUDINARY_CLOUD_NAME')?.trim();
    const apiKey = this.config.get<string>('CLOUDINARY_API_KEY')?.trim();
    const apiSecret = this.config.get<string>('CLOUDINARY_API_SECRET')?.trim();
    if (!cloudName || !apiKey || !apiSecret) {
      throw new ServiceUnavailableException(
        'Cloudinary uploads are not configured',
      );
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = FOLDERS[purpose];
    const signature = createHash('sha1')
      .update(`folder=${folder}&timestamp=${timestamp}${apiSecret}`)
      .digest('hex');

    return { cloudName, apiKey, timestamp, folder, signature };
  }

  async complete(user: AuthenticatedUser, body: Record<string, unknown>) {
    const purpose = this.authorize(
      user,
      typeof body.purpose === 'string' ? body.purpose : '',
    );
    const url = typeof body.secureUrl === 'string' ? body.secureUrl : '';
    const cloudName = this.config.get<string>('CLOUDINARY_CLOUD_NAME')?.trim();
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new BadRequestException('upload.invalidUrl');
    }
    if (
      parsed.protocol !== 'https:' ||
      parsed.hostname !== 'res.cloudinary.com' ||
      !cloudName ||
      !parsed.pathname.startsWith(`/${cloudName}/image/upload/`)
    ) {
      throw new BadRequestException('upload.invalidUrl');
    }

    const sizeBytes = Number(body.bytes);
    if (
      !Number.isInteger(sizeBytes) ||
      sizeBytes < 1 ||
      sizeBytes > 5 * 1024 * 1024
    ) {
      throw new BadRequestException('upload.invalidSize');
    }
    const format = (
      typeof body.format === 'string' ? body.format : ''
    ).toLowerCase();
    if (!['jpg', 'jpeg', 'png', 'webp', 'avif'].includes(format)) {
      throw new BadRequestException('upload.invalidFormat');
    }

    return this.prisma.upload.create({
      data: {
        ownerId: user.id,
        url,
        mimeType: format === 'jpg' ? 'image/jpeg' : `image/${format}`,
        sizeBytes,
        purpose,
      },
      select: {
        id: true,
        url: true,
        mimeType: true,
        sizeBytes: true,
        purpose: true,
      },
    });
  }

  private authorize(
    user: AuthenticatedUser,
    rawPurpose: string,
  ): UploadPurpose {
    if (!(rawPurpose in FOLDERS))
      throw new BadRequestException('upload.invalidPurpose');
    const purpose = rawPurpose as UploadPurpose;
    if (
      ['listing_image', 'batch_update'].includes(purpose) &&
      user.role !== 'Admin'
    ) {
      throw new ForbiddenException('upload.notAllowed');
    }
    return purpose;
  }
}
