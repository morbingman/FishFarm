import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { MulterError } from 'multer';

/**
 * Multer rejects oversized/invalid uploads outside Nest's HTTP exception flow,
 * so translate its errors into the API's i18n error contract.
 */
@Catch(MulterError)
export class MulterExceptionFilter implements ExceptionFilter {
  catch(exception: MulterError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const tooLarge = exception.code === 'LIMIT_FILE_SIZE';

    response.status(tooLarge ? HttpStatus.PAYLOAD_TOO_LARGE : HttpStatus.BAD_REQUEST).json({
      statusCode: tooLarge ? HttpStatus.PAYLOAD_TOO_LARGE : HttpStatus.BAD_REQUEST,
      code: tooLarge ? 'uploads.fileTooLarge' : 'uploads.uploadFailed',
      params: { limit: exception.field ?? '' },
      path: host.switchToHttp().getRequest<{ url: string }>().url,
      timestamp: new Date().toISOString(),
    });
  }
}
