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

  it('returns only secret-safe failure stage/code diagnostics', async () => {
    process.env.DR_ALLOW_MANUAL_EXECUTION = 'true';
    const failure = new Error(
      'R2 PUT failed with HTTP 403: credential=do-not-leak-this-value'
    ) as Error & { backupStage?: string };
    failure.backupStage = 'auth_export';
    const runBackup = vi.fn().mockRejectedValue(failure);
    const handler = createHandler({ runBackup });
    const ctx = makeContext({ trigger: 'http', key: 'dynamic-key' });

    const response = await handler(ctx as any);

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: 'Disaster backup failed',
      stage: 'auth_export',
      code: 'r2_http_403',
    });
    expect(JSON.stringify(response.body)).not.toContain('do-not-leak');
    expect(ctx.error).toHaveBeenCalledWith(
      expect.stringContaining('stage=auth_export code=r2_http_403')
    );
    expect(ctx.error).not.toHaveBeenCalledWith(
      expect.stringContaining('do-not-leak')
    );
  });

  it('classifies invalid encryption material without echoing it', async () => {
    process.env.DR_ALLOW_MANUAL_EXECUTION = 'true';
    const runBackup = vi
      .fn()
      .mockRejectedValue(
        new Error('DR encryption key must decode to exactly 32 bytes')
      );
    const handler = createHandler({ runBackup });
    const ctx = makeContext({ trigger: 'http', key: 'dynamic-key' });

    const response = await handler(ctx as any);

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: 'Disaster backup failed',
      stage: 'config',
      code: 'config_encryption_key',
    });
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
