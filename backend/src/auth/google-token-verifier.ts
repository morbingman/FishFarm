import { Injectable, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { AppException } from '../common/exceptions/app.exception.js';

@Injectable()
export class GoogleTokenVerifier {
  private readonly client = new OAuth2Client();
  constructor(private readonly config: ConfigService) {}
  async verify(credential: string): Promise<{ subject: string; email: string; name: string }> {
    const audience = this.config.get<string>('GOOGLE_CLIENT_ID')?.trim();
    if (!audience) throw new AppException('auth.googleNotConfigured', HttpStatus.SERVICE_UNAVAILABLE);
    try {
      const ticket = await this.client.verifyIdToken({ idToken: credential, audience });
      const p = ticket.getPayload();
      if (!p?.sub || !p.email || !p.email_verified) throw new Error('Unverified identity');
      if (!p.email.toLowerCase().endsWith('@gmail.com') && !p.hd) throw new Error('Email requires a separate verification');
      return { subject: p.sub, email: p.email.toLowerCase(), name: p.name?.trim().slice(0, 80) || p.email.split('@')[0] };
    } catch {
      throw new AppException('auth.googleInvalidCredential', HttpStatus.UNAUTHORIZED);
    }
  }
}
