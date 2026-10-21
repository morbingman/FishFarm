import { join, resolve } from 'node:path';

export const UPLOAD_URL_PREFIX = '/uploads';
export const DEFAULT_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * Dispute attachments and compliance documents are private: they are stored in
 * a subdirectory that the public static middleware refuses to serve.
 */
export const PRIVATE_UPLOAD_DIRECTORY = 'private';
export const PRIVATE_UPLOAD_PURPOSES: ReadonlySet<string> = new Set([
  'dispute_attachment',
  'farm_document',
]);

export function resolveUploadDir(configured?: string): string {
  return resolve(configured?.trim() || 'uploads');
}

export function resolvePrivateUploadDir(configured?: string): string {
  return join(resolveUploadDir(configured), PRIVATE_UPLOAD_DIRECTORY);
}

export function uploadUrl(filename: string, isPrivate: boolean): string {
  return isPrivate
    ? `${UPLOAD_URL_PREFIX}/${PRIVATE_UPLOAD_DIRECTORY}/${filename}`
    : `${UPLOAD_URL_PREFIX}/${filename}`;
}

export const ALLOWED_UPLOAD_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
]);

export const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'application/pdf': '.pdf',
};
