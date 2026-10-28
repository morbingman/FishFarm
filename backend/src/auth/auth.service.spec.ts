import { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import { vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { UsersService, type UserRecord } from '../users/users.service.js';
import { AuthService } from './auth.service.js';

vi.mock('argon2', () => ({ verify: vi.fn().mockResolvedValue(true) }));

const user: UserRecord = {
  id: 'user-id', email: 'user@example.test', passwordHash: 'hash', name: 'User',
  role: 'User', status: 'active', phone: null, location: null, joinedAt: new Date(),
  emailVerifiedAt: null, prefs: {},
};

function service(current: UserRecord | null) {
  const order: string[] = [];
  const create = vi.fn(async () => { order.push('session'); return { id: 'session-id' }; });
  const findUnique = vi.fn(async () => { order.push('read'); return current; });
  const queryRaw = vi.fn(async () => { order.push('lock'); return [{ id: user.id }]; });
  const tx = { $queryRaw: queryRaw, user: { findUnique }, session: { create } };
  const prisma = { $transaction: vi.fn(async (body: (client: typeof tx) => unknown) => body(tx)) } as unknown as PrismaService;
  const users = new UsersService(prisma);
  vi.spyOn(users, 'findByEmail').mockResolvedValue(user);
  const signAsync = vi.fn().mockResolvedValue('access');
  const jwt = { signAsync } as unknown as JwtService;
  return { auth: new AuthService(prisma, jwt, new ConfigService(), users), create, signAsync, order, queryRaw };
}

describe('session issuance account lock', () => {
  it('locks and rereads the account before creating a session and uses its current role', async () => {
    const { auth, create, signAsync, order, queryRaw } = service({ ...user, role: 'Admin', name: 'Current name' });
    const result = await auth.login({ email: user.email, password: 'Password123' }, {});
    expect(order).toEqual(['lock', 'read', 'session']);
    expect(queryRaw.mock.calls[0].slice(1)).toEqual([user.id]);
    expect(create).toHaveBeenCalledOnce();
    expect(result.payload.user).toMatchObject({ role: 'Admin', name: 'Current name' });
    expect(signAsync).toHaveBeenCalledWith(expect.objectContaining({ role: 'Admin', sid: 'session-id' }), expect.anything());
  });

  it.each([
    [{ ...user, status: 'suspended' } as UserRecord, 'auth.accountSuspended'],
    [null, 'auth.invalidCredentials'],
    [{ ...user, passwordHash: 'changed-hash' }, 'auth.invalidCredentials'],
  ])('does not issue a session from stale credential/status data %j', async (current, code) => {
    const { auth, create, signAsync, order } = service(current);
    await expect(auth.login({ email: user.email, password: 'Password123' }, {})).rejects.toMatchObject({ code });
    expect(order).toEqual(['lock', 'read']);
    expect(create).not.toHaveBeenCalled();
    expect(signAsync).not.toHaveBeenCalled();
  });
});
