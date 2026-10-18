import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AppException } from '../../common/exceptions/app.exception.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import type { AccessTokenClaims, AuthenticatedRequest } from '../types.js';

const BEARER_PREFIX = 'Bearer ';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(request);
    if (!token) throw new AppException('auth.missingToken', HttpStatus.UNAUTHORIZED);

    let claims: AccessTokenClaims;
    try {
      claims = await this.jwt.verifyAsync<AccessTokenClaims>(token);
    } catch (error) {
      const expired = error instanceof Error && error.name === 'TokenExpiredError';
      throw new AppException(
        expired ? 'auth.tokenExpired' : 'auth.invalidToken',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const session = await this.prisma.session.findUnique({
      where: { id: claims.sid },
      include: { user: true },
    });

    if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
      throw new AppException('auth.sessionExpired', HttpStatus.UNAUTHORIZED);
    }

    if (session.userId !== claims.sub) {
      throw new AppException('auth.invalidToken', HttpStatus.UNAUTHORIZED);
    }

    const idleMs = this.config.get<number>('SESSION_IDLE_MINUTES', 30) * 60_000;
    if (session.lastActiveAt.getTime() + idleMs <= Date.now()) {
      await this.prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      throw new AppException('auth.sessionExpired', HttpStatus.UNAUTHORIZED);
    }

    if (session.user.status !== 'active') {
      throw new AppException('auth.accountSuspended', HttpStatus.FORBIDDEN);
    }

    // Sliding idle window. Access tokens are short-lived; the session is the source of truth.
    await this.prisma.session.update({
      where: { id: session.id },
      data: { lastActiveAt: new Date() },
    });

    request.user = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
      status: session.user.status,
      store: session.user.store,
      sessionId: session.id,
    };

    return true;
  }

  private extractToken(request: AuthenticatedRequest): string | undefined {
    const header = request.headers.authorization;
    if (!header || !header.startsWith(BEARER_PREFIX)) return undefined;
    const token = header.slice(BEARER_PREFIX.length).trim();
    return token.length > 0 ? token : undefined;
  }
}
