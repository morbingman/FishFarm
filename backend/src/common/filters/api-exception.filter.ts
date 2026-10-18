import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AppException } from '../exceptions/app.exception.js';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const body = this.toBody(exception);

    if (body.statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${body.statusCode} ${body.code}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(body.statusCode).json({
      ...body,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private toBody(exception: unknown): {
    statusCode: number;
    code: string;
    params: Record<string, string | number | boolean>;
    details?: unknown;
  } {
    if (exception instanceof AppException) {
      return {
        statusCode: exception.getStatus(),
        code: exception.code,
        params: exception.params,
      };
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const payload = exception.getResponse();

      if (statusCode === HttpStatus.BAD_REQUEST && this.isValidationPayload(payload)) {
        return {
          statusCode,
          code: 'validation.failed',
          params: {},
          details: payload.message,
        };
      }

      const code =
        statusCode === HttpStatus.NOT_FOUND
          ? 'error.notFound'
          : statusCode === HttpStatus.UNAUTHORIZED
            ? 'auth.missingToken'
            : 'error.http';

      return { statusCode, code, params: { status: statusCode } };
    }

    return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, code: 'error.internal', params: {} };
  }

  private isValidationPayload(payload: unknown): payload is { message: string[] } {
    return (
      typeof payload === 'object' &&
      payload !== null &&
      'message' in payload &&
      Array.isArray((payload as { message: unknown }).message)
    );
  }
}
