import { HttpStatus, Injectable, StreamableFile } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { open } from 'node:fs/promises';
import { join } from 'node:path';
import { AppException } from '../common/exceptions/app.exception.js';
import type { Prisma } from '../generated/prisma/client.js';
import { ALLOWED_UPLOAD_MIME, EXTENSION_BY_MIME, resolvePrivateUploadDir } from './upload.config.js';

export function privateUploadFilename(url: string): string | null {
  const match = /^\/uploads\/private\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpg|png|webp|gif|pdf))$/.exec(url);
  return match?.[1] ?? null;
}

export async function privateUploadsFor(
  tx: Prisma.TransactionClient,
  ids: string[],
  purpose: 'dispute_attachment' | 'farm_document',
  ownerId?: string,
) {
  if (new Set(ids).size !== ids.length) {
    throw new AppException('uploads.duplicateReference', HttpStatus.BAD_REQUEST);
  }
  const uploads = await tx.upload.findMany({
    where: {
      id: { in: ids },
      purpose,
      ...(ownerId ? { ownerId } : { owner: { role: 'Admin' } }),
    },
  });
  if (uploads.length !== ids.length || uploads.some((upload) => {
    const filename = privateUploadFilename(upload.url);
    return !filename || !ALLOWED_UPLOAD_MIME.has(upload.mimeType) ||
      !filename.endsWith(EXTENSION_BY_MIME[upload.mimeType]) || upload.sizeBytes <= 0;
  })) {
    throw new AppException('uploads.invalidReference', HttpStatus.BAD_REQUEST);
  }
  const byId = new Map(uploads.map((upload) => [upload.id, upload]));
  return ids.map((id) => byId.get(id)!);
}

@Injectable()
export class PrivateFilesService {
  constructor(private readonly config: ConfigService) {}

  // Authorization belongs to the resource endpoint, not to possession of an upload id.
  async stream(upload: { url: string; mimeType: string } | null): Promise<StreamableFile> {
    const filename = upload && privateUploadFilename(upload.url);
    if (!upload || !filename || !ALLOWED_UPLOAD_MIME.has(upload.mimeType)) {
      throw new AppException('uploads.notFound', HttpStatus.NOT_FOUND);
    }
    const path = join(resolvePrivateUploadDir(this.config.get<string>('UPLOAD_DIR')), filename);
    const handle = await open(path, 'r').catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
        throw new AppException('uploads.notFound', HttpStatus.NOT_FOUND);
      }
      throw error;
    });
    const stat = await handle.stat();
    if (!stat.isFile()) {
      await handle.close();
      throw new AppException('uploads.notFound', HttpStatus.NOT_FOUND);
    }
    return new StreamableFile(handle.createReadStream(), {
      type: upload.mimeType,
      disposition: `attachment; filename="${filename}"`,
      length: stat.size,
    });
  }
}
