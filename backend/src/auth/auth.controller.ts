import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { CookieOptions, Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { Public } from './decorators/public.decorator.js';
import { GoogleLoginDto } from './dto/google-login.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { VerifyEmailDto } from './dto/verify-email.dto.js';
import type { AuthPayload, SessionMeta } from './types.js';

export const REFRESH_COOKIE = 'fishfarm_refresh';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({
    summary: 'Create a Buyer or Seller account and start a session',
  })
  @ApiCreatedResponse({
    description:
      'Access token in the body; refresh token in an httpOnly cookie.',
  })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthPayload> {
    const result = await this.auth.register(dto, this.meta(req));
    this.setRefreshCookie(res, result.refreshToken);
    return result.payload;
  }

  @Public()
  @Post('register-account')
  async registerAccount(@Body() dto: RegisterDto): Promise<{ created: true; email: string }> {
    const user = await this.auth.createAccount(dto);
    return { created: true, email: user.email };
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('google')
  async googleLogin(@Body() dto: GoogleLoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AuthPayload> {
    const result = await this.auth.googleLogin(dto.credential, this.meta(req));
    this.setRefreshCookie(res, result.refreshToken);
    return result.payload;
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  @ApiOperation({ summary: 'Log in; rejects suspended accounts' })
  @ApiOkResponse({
    description:
      'Access token in the body; refresh token in an httpOnly cookie.',
  })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthPayload> {
    const result = await this.auth.login(dto, this.meta(req));
    this.setRefreshCookie(res, result.refreshToken);
    return result.payload;
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  @ApiCookieAuth('refresh-token')
  @ApiOperation({
    summary: 'Rotate the refresh token and issue a new access token',
  })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthPayload> {
    try {
      const result = await this.auth.refresh(
        this.readRefreshToken(req),
        this.meta(req),
      );
      this.setRefreshCookie(res, result.refreshToken);
      return result.payload;
    } catch (error) {
      this.clearRefreshCookie(res);
      throw error;
    }
  }

  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  @ApiCookieAuth('refresh-token')
  @ApiOperation({ summary: 'Revoke the current refresh token' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logout(this.readRefreshToken(req));
    this.clearRefreshCookie(res);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('verify-email')
  @ApiOperation({
    summary: 'Request or confirm email verification',
    description:
      'Without a code, sends a 6-digit code (dev builds return it as devCode). With a code, verifies the address.',
  })
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.auth.requestEmailVerification(dto);
  }

  @Public()
  @HttpCode(HttpStatus.ACCEPTED)
  @Post('forgot-password')
  @ApiOperation({
    summary:
      'Send a password reset code (response is identical for unknown emails)',
  })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.requestPasswordReset(dto);
  }

  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('reset-password')
  @ApiOperation({
    summary: 'Set a new password using a reset code; revokes all sessions',
  })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.auth.resetPassword(dto);
  }

  private meta(req: Request): SessionMeta {
    return { userAgent: req.headers['user-agent'], ip: req.ip };
  }

  private readRefreshToken(req: Request): string | undefined {
    const cookies = req.cookies as
      Record<string, string | undefined> | undefined;
    return cookies?.[REFRESH_COOKIE];
  }

  private setRefreshCookie(res: Response, token: string): void {
    this.clearLegacyRefreshCookies(res);
    res.cookie(REFRESH_COOKIE, token, this.cookieOptions());
  }

  private clearLegacyRefreshCookies(res: Response): void {
    for (const path of ['/v1/auth', '/api/auth']) {
      res.clearCookie(REFRESH_COOKIE, {
        httpOnly: true,
        secure: this.auth.isProduction,
        sameSite: this.auth.isProduction ? 'none' : 'lax',
        path,
      });
    }
  }

  private clearRefreshCookie(res: Response): void {
    this.clearLegacyRefreshCookies(res);
    res.clearCookie(REFRESH_COOKIE, {
      httpOnly: true,
      secure: this.auth.isProduction,
      sameSite: this.auth.isProduction ? 'none' : 'lax',
      path: this.auth.refreshCookiePath,
    });
  }

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.auth.isProduction,
      sameSite: this.auth.isProduction ? 'none' : 'lax',
      path: this.auth.refreshCookiePath,
      maxAge: this.auth.refreshCookieMaxAgeMs,
    };
  }
}
