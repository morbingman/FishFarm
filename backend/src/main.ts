import 'reflect-metadata';
import { mkdirSync } from 'node:fs';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import type { Request, Response } from 'express';
import { AppModule } from './app.module.js';
import { REFRESH_COOKIE } from './auth/auth.controller.js';
import { ApiExceptionFilter } from './common/filters/api-exception.filter.js';
import {
  PRIVATE_UPLOAD_DIRECTORY,
  resolvePrivateUploadDir,
  resolveUploadDir,
  UPLOAD_URL_PREFIX,
} from './uploads/upload.config.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  const port = config.get<number>('PORT', 4000);
  const corsOrigins = (config.get<string>('CORS_ORIGINS') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(cookieParser());
  const uploadDir = resolveUploadDir(config.get<string>('UPLOAD_DIR'));
  mkdirSync(uploadDir, { recursive: true });
  mkdirSync(resolvePrivateUploadDir(config.get<string>('UPLOAD_DIR')), { recursive: true });
  // Private documents live under /uploads/private and are never served publicly.
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
  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : true,
    credentials: true,
  });
  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('FishFarm API')
    .setDescription(
      'Marketplace and batch-sponsorship API. Source of truth: backend/REQUIREMENTS.md.',
    )
    .setVersion('1.0.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
    .addCookieAuth(REFRESH_COOKIE, { type: 'apiKey', in: 'cookie' }, 'refresh-token')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  await app.listen(port);
  console.log(`FishFarm API listening on http://localhost:${port} (docs: /docs, health: /health)`);
}

await bootstrap();
