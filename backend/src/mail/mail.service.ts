import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { VerificationPurpose } from '../generated/prisma/enums.js';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  async sendVerificationCode(
    to: string,
    code: string,
    purpose: VerificationPurpose,
  ): Promise<boolean> {
    const apiKey = this.config.get<string>('RESEND_API_KEY')?.trim();
    const from = this.config.get<string>('MAIL_FROM')?.trim();

    if (!apiKey || !from) {
      if (this.config.get('NODE_ENV') === 'production') {
        throw new ServiceUnavailableException(
          'Email delivery is not configured',
        );
      }
      this.logger.warn(`[dev only] ${purpose} code for ${to}: ${code}`);
      return false;
    }

    const passwordReset = purpose === 'password_reset';
    const subject = passwordReset
      ? 'FishFarm password reset code'
      : 'Verify your FishFarm email';
    const action = passwordReset
      ? 'reset your password'
      : 'verify your email address';

    let response: Response;
    try {
      response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject,
          text: `Your FishFarm code is ${code}. It expires in 5 minutes.`,
          html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#183b36"><h2>${subject}</h2><p>Use this code to ${action}:</p><p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:24px 0">${code}</p><p>This code expires in 5 minutes. If you did not request it, you can ignore this email.</p></div>`,
        }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      this.logger.error(
        `Email provider request failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      throw new ServiceUnavailableException(
        'Unable to send verification email',
      );
    }

    if (!response.ok) {
      this.logger.error(
        `Email provider rejected the request with status ${response.status}`,
      );
      throw new ServiceUnavailableException(
        'Unable to send verification email',
      );
    }

    return true;
  }
}
