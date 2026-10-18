import { HttpException, HttpStatus } from '@nestjs/common';

export type ErrorParams = Record<string, string | number | boolean>;

/**
 * Transport for i18n-ready failures: the client receives a message key + params,
 * never a hard-coded English sentence.
 */
export class AppException extends HttpException {
  constructor(
    public readonly code: string,
    status: HttpStatus,
    public readonly params: ErrorParams = {},
  ) {
    super({ code, params }, status);
  }
}
