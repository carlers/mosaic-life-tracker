import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHandler } from '../../appwrite-functions/dr-backup/main.mjs';

function makeContext(options: {
  trigger?: string;
  key?: string;
  body?: Record<string, unknown>;
}) {
  const log = vi.fn();
  const error = vi.fn();
  const res = {
    json: vi.fn((body: unknown, status = 200) => ({ body, status })),
  };
  const req = {
    headers: {
      'x-appwrite-trigger': options.trigger ?? 'http',
      ...(options.key ? { 'x-appwrite-key': options.key } : {}),
    },
    body: JSON.stringify(options.body ?? {}),
  };
  return { req, res, log, error };
}

describe('dr-backup Function authorization', () => {
  const original = process.env.DR_ALLOW_MANUAL_EXECUTION;

  afterEach(() => {
    if (original === undefined) delete process.env.DR_ALLOW_MANUAL_EXECUTION;
    else process.env.DR_ALLOW_MANUAL_EXECUTION = original;
  });

  it('allows a trusted scheduled execution without a user session', async () => {
    const runBackup = vi.fn().mockResolvedValue({
      backupId: '20260927T010203004Z',
      counts: { users: 2, rows: 5, files: 1 },
    });
    const handler = createHandler({ runBackup });
    const ctx = makeContext({ trigger: 'schedule', key: 'dynamic-key' });

    const response = await handler(ctx as any);

    expect(runBackup).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      ok: true,
      backupId: '20260927T010203004Z',
    });
  });

  it('rejects normal HTTP execution by default', async () => {
    delete process.env.DR_ALLOW_MANUAL_EXECUTION;
    const runBackup = vi.fn();
    const handler = createHandler({ runBackup });
    const ctx = makeContext({ trigger: 'http', key: 'dynamic-key' });

    const response = await handler(ctx as any);

    expect(response.status).toBe(403);
    expect(runBackup).not.toHaveBeenCalled();
  });

  it('allows explicit server-side manual execution only with Appwrite key metadata', async () => {
    process.env.DR_ALLOW_MANUAL_EXECUTION = 'true';
    const runBackup = vi.fn().mockResolvedValue({
      backupId: '20260927T010203004Z',
      counts: {},
    });
    const handler = createHandler({ runBackup });

    const withoutKey = await handler(makeContext({ trigger: 'http' }) as any);
    expect(withoutKey.status).toBe(403);
    expect(runBackup).not.toHaveBeenCalled();

    const withKey = await handler(
      makeContext({ trigger: 'http', key: 'dynamic-key' }) as any
    );
    expect(withKey.status).toBe(200);
    expect(runBackup).toHaveBeenCalledTimes(1);
  });
});
