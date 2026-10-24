import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { OAuth2Client, type TokenPayload } from 'google-auth-library';
import {
  createHash,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';
import { AppException } from '../common/exceptions/app.exception.js';
import type { VerificationPurpose } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { UsersService, type UserRecord } from '../users/users.service.js';
import type { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import type { LoginDto } from './dto/login.dto.js';
import type { RegisterDto } from './dto/register.dto.js';
import type { ResetPasswordDto } from './dto/reset-password.dto.js';
import type { VerifyEmailDto } from './dto/verify-email.dto.js';
import type { AuthResult, SessionMeta } from './types.js';

const OTP_TTL_MS = 5 * 60_000;
const OTP_RESEND_COOLDOWN_MS = 45_000;
const OTP_MAX_ATTEMPTS = 5;
const ACCESS_COOKIE_PATH = '/v1/auth';

export interface CodeIssue {
  sent: true;
  devCode?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly users: UsersService,
    private readonly mail: MailService,
  ) {}

  get refreshCookiePath(): string {
    return ACCESS_COOKIE_PATH;
  }

  get accessTtlSeconds(): number {
    return Number(this.config.get('JWT_ACCESS_TTL_SECONDS', 900));
  }

  get refreshTtlDays(): number {
    return Number(this.config.get('REFRESH_TOKEN_TTL_DAYS', 30));
  }

  get refreshCookieMaxAgeMs(): number {
    return this.refreshTtlDays * 24 * 60 * 60 * 1000;
  }

  get isProduction(): boolean {
    return this.config.get('NODE_ENV') === 'production';
  }

  async register(dto: RegisterDto, meta: SessionMeta): Promise<AuthResult> {
    if (dto.store) {
      throw new AppException(
        'profile.storeRequiresSeller',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (await this.users.findByEmail(dto.email)) {
      throw new AppException('auth.emailTaken', HttpStatus.CONFLICT);
    }

    const passwordHash = await argon2.hash(dto.password);
    let user;
    try {
      user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            email: dto.email,
            passwordHash,
            name: dto.name,
            role: dto.role,
            phone: dto.phone,
            location: dto.location,
            store: null,
          },
        });

        await tx.notification.create({
          data: {
            recipientId: created.id,
            type: 'system',
            titleKey: 'notifications.welcome.title',
            bodyKey: 'notifications.welcome.body',
            link: created.role === 'Seller' ? '#seller' : '#marketplace',
          },
        });

        await tx.activity.create({
          data: {
            actorId: created.id,
            actorLabel: created.name,
            role: created.role,
            action: 'user.registered',
            target: created.email,
          },
        });

        return created;
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new AppException('auth.emailTaken', HttpStatus.CONFLICT);
      }
      throw error;
    }

    return this.issueSession(user, meta);
  }

  async login(dto: LoginDto, meta: SessionMeta): Promise<AuthResult> {
    const user = await this.users.findByEmail(dto.email);
    if (!user) {
      throw new AppException(
        'auth.invalidCredentials',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const passwordOk = await argon2.verify(user.passwordHash, dto.password);
    if (!passwordOk) {
      throw new AppException(
        'auth.invalidCredentials',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (user.status !== 'active') {
      throw new AppException('auth.accountSuspended', HttpStatus.FORBIDDEN);
    }

    return this.issueSession(user, meta);
  }

  async googleLogin(
    credential: string,
    meta: SessionMeta,
  ): Promise<AuthResult> {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID')?.trim();
    if (!clientId) {
      throw new AppException(
        'auth.googleNotConfigured',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    let googleProfile: TokenPayload | undefined;
    try {
      const ticket = await new OAuth2Client(clientId).verifyIdToken({
        idToken: credential,
        audience: clientId,
      });
      googleProfile = ticket.getPayload();
    } catch {
      throw new AppException('auth.googleInvalid', HttpStatus.UNAUTHORIZED);
    }

    if (!googleProfile?.email || !googleProfile.email_verified) {
      throw new AppException('auth.googleInvalid', HttpStatus.UNAUTHORIZED);
    }

    const email = googleProfile.email.trim().toLowerCase();
    let user = await this.users.findByEmail(email);
    if (!user) {
      const passwordHash = await argon2.hash(randomBytes(32).toString('hex'));
      try {
        user = await this.prisma.$transaction(async (tx) => {
          const created = await tx.user.create({
            data: {
              email,
              passwordHash,
              name: (googleProfile.name ?? email.split('@')[0]).slice(0, 120),
              role: 'Buyer',
              emailVerifiedAt: new Date(),
            },
          });
          await tx.notification.create({
            data: {
              recipientId: created.id,
              type: 'system',
              titleKey: 'notifications.welcome.title',
              bodyKey: 'notifications.welcome.body',
              link: '#marketplace',
            },
          });
          await tx.activity.create({
            data: {
              actorId: created.id,
              actorLabel: created.name,
              role: created.role,
              action: 'user.registered.google',
              target: created.email,
            },
          });
          return created;
        });
      } catch (error) {
        if (!this.isUniqueViolation(error)) throw error;
        user = await this.users.findByEmail(email);
      }
    } else if (!user.emailVerifiedAt) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { emailVerifiedAt: new Date() },
      });
    }

    if (!user) {
      throw new AppException('auth.googleInvalid', HttpStatus.UNAUTHORIZED);
    }
    if (user.status !== 'active') {
      throw new AppException('auth.accountSuspended', HttpStatus.FORBIDDEN);
    }
    return this.issueSession(user, meta);
  }

  async refresh(
    rawToken: string | undefined,
    meta: SessionMeta,
  ): Promise<AuthResult> {
    if (!rawToken) {
      throw new AppException(
        'auth.missingRefreshToken',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const tokenHash = sha256(rawToken);
    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash: tokenHash },
      include: { user: true },
    });

    if (
      !session ||
      session.revokedAt ||
      session.expiresAt.getTime() <= Date.now()
    ) {
      throw new AppException('auth.sessionExpired', HttpStatus.UNAUTHORIZED);
    }

    if (this.idleExpired(session.lastActiveAt)) {
      await this.prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      throw new AppException('auth.sessionExpired', HttpStatus.UNAUTHORIZED);
    }

    if (session.user.status !== 'active') {
      throw new AppException('auth.accountSuspended', HttpStatus.FORBIDDEN);
    }

    const nextToken = this.newRefreshToken();
    const rotated = await this.prisma.session.updateMany({
      where: { id: session.id, refreshTokenHash: tokenHash, revokedAt: null },
      data: {
        refreshTokenHash: sha256(nextToken),
        lastActiveAt: new Date(),
        expiresAt: this.refreshExpiry(),
        userAgent: meta.userAgent ?? session.userAgent,
        ip: meta.ip ?? session.ip,
      },
    });

    // Lost a rotation race (or the session was revoked concurrently).
    if (rotated.count !== 1) {
      throw new AppException('auth.sessionExpired', HttpStatus.UNAUTHORIZED);
    }

    return {
      refreshToken: nextToken,
      payload: await this.buildPayload(session.user, session.id),
    };
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    await this.prisma.session.updateMany({
      where: { refreshTokenHash: sha256(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async requestEmailVerification(dto: VerifyEmailDto): Promise<CodeIssue> {
    if (dto.code) {
      await this.confirmEmail(dto);
      return { sent: true };
    }

    const user = await this.users.findByEmail(dto.email);
    if (!user || user.emailVerifiedAt) return { sent: true };

    const code = await this.issueCode(user.id, 'email_verify');
    const delivered = await this.mail.sendVerificationCode(
      dto.email,
      code,
      'email_verify',
    );
    return {
      sent: true,
      ...(!this.isProduction && !delivered ? { devCode: code } : {}),
    };
  }

  async requestPasswordReset(dto: ForgotPasswordDto): Promise<CodeIssue> {
    const user = await this.users.findByEmail(dto.email);
    if (!user) return { sent: true };

    const code = await this.issueCode(user.id, 'password_reset');
    const delivered = await this.mail.sendVerificationCode(
      dto.email,
      code,
      'password_reset',
    );
    return {
      sent: true,
      ...(!this.isProduction && !delivered ? { devCode: code } : {}),
    };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const user = await this.users.findByEmail(dto.email);
    if (!user) {
      throw new AppException('auth.invalidCode', HttpStatus.BAD_REQUEST);
    }

    await this.consumeCode(user.id, 'password_reset', dto.code);
    const passwordHash = await argon2.hash(dto.newPassword);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      this.prisma.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  private async confirmEmail(dto: VerifyEmailDto): Promise<void> {
    const user = await this.users.findByEmail(dto.email);
    if (!user)
      throw new AppException('auth.invalidCode', HttpStatus.BAD_REQUEST);

    await this.consumeCode(user.id, 'email_verify', dto.code!);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date() },
    });
  }

  private async issueSession(
    user: UserRecord,
    meta: SessionMeta,
  ): Promise<AuthResult> {
    const refreshToken = this.newRefreshToken();
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: sha256(refreshToken),
        expiresAt: this.refreshExpiry(),
        userAgent: meta.userAgent,
        ip: meta.ip,
      },
    });

    return {
      refreshToken,
      payload: await this.buildPayload(user, session.id),
    };
  }

  private async buildPayload(
    user: UserRecord,
    sessionId: string,
  ): Promise<AuthResult['payload']> {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email, role: user.role, sid: sessionId },
      { expiresIn: this.accessTtlSeconds },
    );

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: this.accessTtlSeconds,
      user: this.users.toPublicUser(user),
    };
  }

  private async issueCode(
    userId: string,
    purpose: VerificationPurpose,
  ): Promise<string> {
    const latest = await this.prisma.verificationCode.findFirst({
      where: { userId, purpose },
      orderBy: { createdAt: 'desc' },
    });

    if (
      latest &&
      Date.now() - latest.createdAt.getTime() < OTP_RESEND_COOLDOWN_MS
    ) {
      const retryAfterSeconds = Math.ceil(
        (OTP_RESEND_COOLDOWN_MS - (Date.now() - latest.createdAt.getTime())) /
          1000,
      );
      throw new AppException(
        'auth.codeCooldown',
        HttpStatus.TOO_MANY_REQUESTS,
        {
          retryAfterSeconds,
        },
      );
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');

    await this.prisma.$transaction([
      this.prisma.verificationCode.updateMany({
        where: { userId, purpose, consumedAt: null },
        data: { consumedAt: new Date() },
      }),
      this.prisma.verificationCode.create({
        data: {
          userId,
          purpose,
          codeHash: sha256(code),
          expiresAt: new Date(Date.now() + OTP_TTL_MS),
        },
      }),
    ]);

    return code;
  }

  private async consumeCode(
    userId: string,
    purpose: VerificationPurpose,
    code: string,
  ): Promise<void> {
    const record = await this.prisma.verificationCode.findFirst({
      where: { userId, purpose, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!record)
      throw new AppException('auth.invalidCode', HttpStatus.BAD_REQUEST);

    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      throw new AppException(
        'auth.tooManyAttempts',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (record.expiresAt.getTime() <= Date.now()) {
      throw new AppException('auth.codeExpired', HttpStatus.BAD_REQUEST);
    }

    if (!constantTimeEqual(record.codeHash, sha256(code))) {
      await this.prisma.verificationCode.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw new AppException('auth.invalidCode', HttpStatus.BAD_REQUEST);
    }

    await this.prisma.verificationCode.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    });
  }

  private newRefreshToken(): string {
    return randomBytes(48).toString('base64url');
  }

  private refreshExpiry(): Date {
    return new Date(Date.now() + this.refreshCookieMaxAgeMs);
  }

  private idleExpired(lastActiveAt: Date): boolean {
    const idleMs = Number(this.config.get('SESSION_IDLE_MINUTES', 30)) * 60_000;
    return lastActiveAt.getTime() + idleMs <= Date.now();
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      (error as { code?: string }).code === 'P2002'
    );
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function constantTimeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
