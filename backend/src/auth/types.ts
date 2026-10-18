import type { Request } from 'express';
import type { UserRole, UserStatus } from '../generated/prisma/enums.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  store: string | null;
  sessionId: string;
}

export type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

export interface SessionMeta {
  userAgent?: string;
  ip?: string;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  phone: string | null;
  location: string | null;
  store: string | null;
  joinedAt: Date;
  emailVerifiedAt: Date | null;
  prefs: NotificationPrefs;
}

export interface NotificationPrefs {
  status: boolean;
  system: boolean;
  reminders: boolean;
  [key: string]: boolean;
}

export interface AuthPayload {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: PublicUser;
}

export interface AuthResult {
  payload: AuthPayload;
  refreshToken: string;
}

export interface AccessTokenClaims {
  sub: string;
  email: string;
  role: UserRole;
  sid: string;
  iat?: number;
  exp?: number;
}
