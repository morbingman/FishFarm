import { vi } from 'vitest';
import type { Prisma } from '../generated/prisma/client.js';
import { notify, type NotificationInput } from './notifications.js';

const input: NotificationInput = {
  role: 'Admin',
  type: 'status',
  titleKey: 'notifications.test.title',
  titleParams: { code: 'TEST-1' },
  bodyKey: 'notifications.test.body',
  link: '#test',
};

function database(recipients: Array<{ id: string; prefs: unknown }>) {
  const findMany = vi.fn().mockResolvedValue(recipients);
  const createMany = vi.fn().mockResolvedValue({ count: recipients.length });
  const queryRaw = vi.fn().mockResolvedValue(recipients.map(({ id }) => ({ id })));
  const tx = { user: { findMany }, notification: { createMany }, $queryRaw: queryRaw } as unknown as Prisma.TransactionClient;
  return { tx, findMany, createMany, queryRaw };
}

describe('notification fan-out', () => {
  it('creates one directly addressed notification per active Admin', async () => {
    const { tx, findMany, createMany } = database([
      { id: 'admin-a', prefs: {} },
      { id: 'admin-b', prefs: {} },
    ]);
    await notify(tx, input);
    expect(findMany).toHaveBeenCalledWith({
      where: { role: 'Admin', status: 'active' },
      select: { id: true, prefs: true },
    });
    const rows = createMany.mock.calls[0][0].data;
    expect(rows.map((row: { recipientId: string }) => row.recipientId)).toEqual(['admin-a', 'admin-b']);
    expect(rows.every((row: Record<string, unknown>) => !('recipientRole' in row))).toBe(true);
    expect(rows[0]).toMatchObject({ titleParams: { code: 'TEST-1' }, link: '#test' });
  });

  it.each([
    ['status', 'status'],
    ['system', 'system'],
    ['reminder', 'reminders'],
  ] as const)('respects the %s preference for each recipient', async (type, preference) => {
    const { tx, createMany } = database([
      { id: 'muted', prefs: { [preference]: false } },
      { id: 'enabled', prefs: {} },
    ]);
    await notify(tx, { ...input, type });
    expect(createMany.mock.calls[0][0].data).toHaveLength(1);
    expect(createMany.mock.calls[0][0].data[0].recipientId).toBe('enabled');
  });

  it('gives an explicit recipient precedence over the role', async () => {
    const { tx, findMany } = database([{ id: 'buyer', prefs: null }]);
    await notify(tx, { ...input, userId: 'buyer' });
    expect(findMany.mock.calls[0][0].where).toEqual({ id: 'buyer' });
  });

  it('does not write notifications when every recipient is muted', async () => {
    const { tx, createMany } = database([{ id: 'muted', prefs: { status: false } }]);
    await notify(tx, input);
    expect(createMany).not.toHaveBeenCalled();
  });

  it('defaults malformed preferences to enabled', async () => {
    const { tx, createMany } = database([{ id: 'enabled', prefs: 'invalid' }]);
    await notify(tx, input);
    expect(createMany).toHaveBeenCalledOnce();
  });

  it('skips recipients deleted between selection and locking', async () => {
    const { tx, queryRaw, createMany } = database([{ id: 'deleted', prefs: {} }]);
    queryRaw.mockResolvedValue([]);
    await notify(tx, input);
    expect(createMany).not.toHaveBeenCalled();
  });

  it('never broadcasts when no recipient is specified', async () => {
    const { tx, findMany, createMany } = database([]);
    await notify(tx, { ...input, role: undefined });
    expect(findMany.mock.calls[0][0].where).toEqual({ id: { in: [] } });
    expect(createMany).not.toHaveBeenCalled();
  });
});
