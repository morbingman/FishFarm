import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import type { Request, Response } from 'express';
import { mkdirSync } from 'node:fs';
import { AppModule } from '../src/app.module.js';
import { ApiExceptionFilter } from '../src/common/filters/api-exception.filter.js';
import {
  PRIVATE_UPLOAD_DIRECTORY,
  resolvePrivateUploadDir,
  resolveUploadDir,
  UPLOAD_URL_PREFIX,
} from '../src/uploads/upload.config.js';

/**
 * Boots the API with the same middleware as `main.ts` so e2e tests exercise the
 * real cookie, validation and error contracts.
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication<NestExpressApplication>();
  const config = app.get(ConfigService);
  const uploadDir = resolveUploadDir(config.get<string>('UPLOAD_DIR'));
  mkdirSync(uploadDir, { recursive: true });
  mkdirSync(resolvePrivateUploadDir(config.get<string>('UPLOAD_DIR')), { recursive: true });

  app.use(cookieParser());
  app.use(`${UPLOAD_URL_PREFIX}/${PRIVATE_UPLOAD_DIRECTORY}`, (_req: Request, res: Response) =>
    res.sendStatus(404),
  );
  app.useStaticAssets(uploadDir, { prefix: UPLOAD_URL_PREFIX });
  app.setGlobalPrefix('v1', { exclude: ['health'] });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());
  await app.init();

  return app;
}
