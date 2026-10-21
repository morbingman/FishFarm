import { HttpStatus, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { diskStorage } from 'multer';
import { AppException } from '../common/exceptions/app.exception.js';
import {
  ALLOWED_UPLOAD_MIME,
  DEFAULT_UPLOAD_BYTES,
  EXTENSION_BY_MIME,
  resolveUploadDir,
} from './upload.config.js';
import { UploadsController } from './uploads.controller.js';
import { UploadsService } from './uploads.service.js';

@Module({
  imports: [
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const dir = resolveUploadDir(config.get<string>('UPLOAD_DIR'));
        mkdirSync(dir, { recursive: true });

        return {
          storage: diskStorage({
            destination: dir,
            filename: (_request, file, callback) => {
              callback(null, `${randomUUID()}${EXTENSION_BY_MIME[file.mimetype] ?? ''}`);
            },
          }),
          limits: {
            fileSize: Number(config.get('UPLOAD_MAX_BYTES') ?? DEFAULT_UPLOAD_BYTES),
            files: 1,
          },
          fileFilter: (_request, file, callback) => {
            if (!ALLOWED_UPLOAD_MIME.has(file.mimetype)) {
              callback(
                new AppException('uploads.unsupportedType', HttpStatus.UNSUPPORTED_MEDIA_TYPE, {
                  mimeType: file.mimetype,
                }),
                false,
              );
              return;
            }
            callback(null, true);
          },
        };
      },
    }),
  ],
  controllers: [UploadsController],
  providers: [UploadsService],
})
export class UploadsModule {}
