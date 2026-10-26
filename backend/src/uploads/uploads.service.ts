import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import type { AuthenticatedUser } from '../auth/types.js';
import { AppException } from '../common/exceptions/app.exception.js';
import type { UserRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  PRIVATE_UPLOAD_PURPOSES,
  resolvePrivateUploadDir,
  resolveUploadDir,
  uploadUrl,
} from './upload.config.js';

export const UPLOAD_PURPOSES = [
  'listing_image',
  'dispute_attachment',
  'batch_update',
  'batch_image',
  'farm_document',
] as const;

export type UploadPurpose = (typeof UPLOAD_PURPOSES)[number];

const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const DOCUMENT_MIME = new Set([...IMAGE_MIME, 'application/pdf']);

const PURPOSE_ACCESS: Record<UploadPurpose, { roles: UserRole[]; mime: Set<string> }> = {
  listing_image: { roles: ['Admin'], mime: IMAGE_MIME },
  dispute_attachment: { roles: ['User'], mime: DOCUMENT_MIME },
  batch_update: { roles: ['Admin'], mime: IMAGE_MIME },
  batch_image: { roles: ['Admin'], mime: IMAGE_MIME },
  farm_document: { roles: ['Admin'], mime: DOCUMENT_MIME },
};

function isPurpose(value: string): value is UploadPurpose {
  return (UPLOAD_PURPOSES as readonly string[]).includes(value);
}

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async store(
    user: AuthenticatedUser,
    file: Express.Multer.File | undefined,
    purpose: string | undefined,
  ) {
    if (!file) {
      throw new AppException('uploads.fileRequired', HttpStatus.BAD_REQUEST);
    }

    try {
      const normalized = purpose?.trim();
      if (!normalized || !isPurpose(normalized)) {
        throw new AppException('uploads.invalidPurpose', HttpStatus.BAD_REQUEST, {
          purpose: purpose ?? '',
        });
      }

      const access = PURPOSE_ACCESS[normalized];
      if (!access.roles.includes(user.role)) {
        throw new AppException('uploads.forbidden', HttpStatus.FORBIDDEN, { purpose: normalized });
      }
      if (!access.mime.has(file.mimetype)) {
        throw new AppException('uploads.unsupportedType', HttpStatus.UNSUPPORTED_MEDIA_TYPE, {
          mimeType: file.mimetype,
        });
      }

      const isPrivate = PRIVATE_UPLOAD_PURPOSES.has(normalized);
      let filename = file.filename;
      if (isPrivate) {
        const privateDir = resolvePrivateUploadDir(this.config.get<string>('UPLOAD_DIR'));
        await mkdir(privateDir, { recursive: true });
        await rename(file.path, join(privateDir, filename));
      }

      const upload = await this.prisma.upload.create({
        data: {
          ownerId: user.id,
          url: uploadUrl(filename, isPrivate),
          mimeType: file.mimetype,
          sizeBytes: file.size,
          purpose: normalized,
        },
      });

      return {
        id: upload.id,
        url: upload.url,
        mimeType: upload.mimeType,
        sizeBytes: upload.sizeBytes,
        purpose: upload.purpose,
        isPrivate,
      };
    } catch (error) {
      await this.removeFile(file);
      throw error;
    }
  }

  private async removeFile(file: Express.Multer.File): Promise<void> {
    if (!file.filename) return;
    const candidates = [
      join(resolveUploadDir(this.config.get<string>('UPLOAD_DIR')), file.filename),
      join(resolvePrivateUploadDir(this.config.get<string>('UPLOAD_DIR')), file.filename),
    ];
    for (const candidate of candidates) {
      await unlink(candidate).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') {
          this.logger.warn(`Could not remove rejected upload ${file.filename}: ${error.message}`);
        }
      });
    }
  }
}
