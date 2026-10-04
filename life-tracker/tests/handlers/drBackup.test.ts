import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHandler } from '../../appwrite-functions/dr-backup/main.mjs';
import {
  privacyDeletionKey,
  recordPrivacyDeletion,
} from '../../appwrite-functions/dr-backup/privacy-deletion.mjs';

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

describe('DR privacy deletion marker durability', () => {
  const config = {
    prefix: 'mosaic-dr/v1',
    encryptionKey: Buffer.alloc(32, 7),
    keyVersion: 'v1',
    r2: {},
  } as any;

  function makeR2() {
    const objects = new Map<
      string,
      { bytes: Buffer; metadata: Record<string, string> }
    >();
    return {
      objects,
      headObject: vi.fn(async (key: string) => {
        const value = objects.get(key);
        return value
          ? { size: value.bytes.length, metadata: value.metadata }
          : null;
      }),
      getObject: vi.fn(async (key: string) => {
        const value = objects.get(key);
        if (!value) throw new Error('missing');
        return value.bytes;
      }),
      putObject: vi.fn(
        async (
          key: string,
          value: Buffer,
          options?: { metadata?: Record<string, string> }
        ) => {
          objects.set(key, {
            bytes: Buffer.from(value),
            metadata: { ...(options?.metadata ?? {}) },
          });
          return { etag: 'test' };
        }
      ),
    };
  }

  it('authenticates and reuses an existing object-locked marker on retry', async () => {
    const r2 = makeR2();
    const first = await recordPrivacyDeletion('alice', {
      config,
      r2: r2 as any,
      now: new Date('2026-10-04T00:00:00.000Z'),
    });
    const second = await recordPrivacyDeletion('alice', {
      config,
      r2: r2 as any,
      now: new Date('2026-10-04T01:00:00.000Z'),
    });

    expect(first).toMatchObject({ ok: true, reused: false });
    expect(second).toMatchObject({ ok: true, reused: true });
    expect(r2.putObject).toHaveBeenCalledTimes(1);
    expect(r2.getObject).toHaveBeenCalledTimes(1);
    expect(r2.objects.has(privacyDeletionKey(config.prefix, 'alice'))).toBe(
      true
    );
  });

  it('reuses an immutable privacy marker after the active DR key rotates', async () => {
    const r2 = makeR2();
    const v1Key = Buffer.alloc(32, 7);
    const v2Key = Buffer.alloc(32, 8);
    await recordPrivacyDeletion('alice', {
      config: {
        ...config,
        encryptionKey: v1Key,
        keyVersion: 'v1',
        encryptionKeys: new Map([['v1', v1Key]]),
      } as any,
      r2: r2 as any,
      now: new Date('2026-10-04T00:00:00.000Z'),
    });

    const retried = await recordPrivacyDeletion('alice', {
      config: {
        ...config,
        encryptionKey: v2Key,
        keyVersion: 'v2',
        encryptionKeys: new Map([
          ['v1', v1Key],
          ['v2', v2Key],
        ]),
      } as any,
      r2: r2 as any,
      now: new Date('2026-10-04T01:00:00.000Z'),
    });

    expect(retried).toMatchObject({
      ok: true,
      reused: true,
      keyVersion: 'v1',
    });
    expect(r2.putObject).toHaveBeenCalledTimes(1);
  });

  it('fails closed after key rotation when the marker key is not escrowed', async () => {
    const r2 = makeR2();
    const v1Key = Buffer.alloc(32, 7);
    const v2Key = Buffer.alloc(32, 8);
    await recordPrivacyDeletion('alice', {
      config: {
        ...config,
        encryptionKey: v1Key,
        keyVersion: 'v1',
      } as any,
      r2: r2 as any,
    });

    await expect(
      recordPrivacyDeletion('alice', {
        config: {
          ...config,
          encryptionKey: v2Key,
          keyVersion: 'v2',
          encryptionKeys: new Map([['v2', v2Key]]),
        } as any,
        r2: r2 as any,
      })
    ).rejects.toThrow(/Missing DR encryption key/i);
  });

  it('fails closed when an existing deterministic marker cannot be authenticated', async () => {
    const r2 = makeR2();
    const key = privacyDeletionKey(config.prefix, 'alice');
    r2.objects.set(key, {
      bytes: Buffer.from('not-a-valid-dr-envelope'),
      metadata: {},
    });

    await expect(
      recordPrivacyDeletion('alice', {
        config,
        r2: r2 as any,
      })
    ).rejects.toThrow(/Invalid Mosaic DR envelope/);
    expect(r2.putObject).not.toHaveBeenCalled();
  });
});

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

  it('accepts the server-only privacy deletion marker action without exposing user data', async () => {
    delete process.env.DR_ALLOW_MANUAL_EXECUTION;
    const runBackup = vi.fn();
    const recordPrivacyDeletion = vi.fn().mockResolvedValue({ ok: true });
    const handler = createHandler({ runBackup, recordPrivacyDeletion });

    const rejected = await handler(
      makeContext({
        trigger: 'http',
        body: { action: 'record_privacy_deletion', userId: 'alice' },
      }) as any
    );
    expect(rejected.status).toBe(403);
    expect(recordPrivacyDeletion).not.toHaveBeenCalled();

    const ctx = makeContext({
      trigger: 'http',
      key: 'dynamic-server-key',
      body: { action: 'record_privacy_deletion', userId: 'alice' },
    });
    const accepted = await handler(ctx as any);

    expect(accepted.status).toBe(200);
    expect(accepted.body).toEqual({ ok: true });
    expect(recordPrivacyDeletion).toHaveBeenCalledWith('alice');
    expect(runBackup).not.toHaveBeenCalled();
    expect(JSON.stringify(ctx.log.mock.calls)).not.toContain('alice');
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

  it('classifies Cloudflare S3 authorization and signature failures separately', async () => {
    process.env.DR_ALLOW_MANUAL_EXECUTION = 'true';
    const cases = [
      ['AccessDenied', 'r2_access_denied'],
      ['SignatureDoesNotMatch', 'r2_signature_mismatch'],
      ['ExpiredRequest', 'r2_expired_request'],
      ['NotEntitled', 'r2_not_entitled'],
    ] as const;

    for (const [s3Code, expectedCode] of cases) {
      const failure = new Error(
        `R2 PUT failed with HTTP 403 code=${s3Code}`
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
        code: expectedCode,
      });
    }
  });

  it('classifies Appwrite status codes without returning provider error text', async () => {
    process.env.DR_ALLOW_MANUAL_EXECUTION = 'true';
    const failure = Object.assign(
      new Error('Appwrite response contained private diagnostics'),
      {
        code: 401,
        backupStage: 'tables_list_rows',
      }
    );
    const runBackup = vi.fn().mockRejectedValue(failure);
    const handler = createHandler({ runBackup });
    const ctx = makeContext({ trigger: 'http', key: 'dynamic-key' });

    const response = await handler(ctx as any);

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: 'Disaster backup failed',
      stage: 'tables_list_rows',
      code: 'appwrite_http_401',
    });
    expect(JSON.stringify(response.body)).not.toContain('private diagnostics');
    expect(ctx.error).not.toHaveBeenCalledWith(
      expect.stringContaining('private diagnostics')
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
