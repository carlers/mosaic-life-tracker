import { describe, expect, it, vi } from 'vitest';
import {
  assertSafeTarget,
  createImportedUser,
  loadCommittedSnapshot,
  parseArgs,
  parseJsonLines,
  stableJson,
} from '../../scripts/dr-restore.mjs';
import {
  encryptBuffer,
  sha256Hex,
} from '../../appwrite-functions/dr-backup/crypto.mjs';

describe('DR restore CLI', () => {
  it('parses the explicit snapshot and target project arguments', () => {
    expect(
      parseArgs([
        '--snapshot',
        '20260927T010203004Z',
        '--target-project',
        'dr-project',
        '--endpoint',
        'https://sgp.cloud.appwrite.io/v1',
        '--verify-only',
      ])
    ).toEqual({
      snapshot: '20260927T010203004Z',
      targetProject: 'dr-project',
      endpoint: 'https://sgp.cloud.appwrite.io/v1',
      verifyOnly: true,
    });
  });

  it('parses newline-delimited records without inventing empty records', () => {
    expect(
      parseJsonLines(
        Buffer.from('{"id":"a"}\n{"id":"b"}\n', 'utf8')
      )
    ).toEqual([{ id: 'a' }, { id: 'b' }]);
    expect(parseJsonLines(Buffer.alloc(0))).toEqual([]);
  });

  it('canonicalizes nested object keys for deterministic comparisons', () => {
    expect(
      stableJson({ b: 2, a: { d: 4, c: 3 } })
    ).toBe(stableJson({ a: { c: 3, d: 4 }, b: 2 }));
  });

  it('loads only a committed manifest with matching ciphertext hash and AAD', async () => {
    const key = Buffer.alloc(32, 9);
    const snapshotId = '20260927T010203004Z';
    const prefix = 'mosaic-dr/v1';
    const manifestKey =
      `${prefix}/snapshots/${snapshotId}/manifest.json.enc`;
    const usersKey =
      `${prefix}/snapshots/${snapshotId}/auth/users.jsonl.enc`;
    const usersPlain = Buffer.from('{"id":"user_1"}\n');
    const usersCipher = encryptBuffer(usersPlain, {
      key,
      keyVersion: 'v1',
      aad: usersKey,
      compress: true,
    });
    const manifest = {
      format: 'mosaic-dr',
      version: 1,
      backupId: snapshotId,
      keyVersion: 'v1',
      source: { projectId: 'source-project' },
      auth: { usersKey },
      objects: [
        {
          key: usersKey,
          plainSha256: sha256Hex(usersPlain),
          cipherSha256: sha256Hex(usersCipher),
        },
      ],
    };
    const manifestCipher = encryptBuffer(
      Buffer.from(JSON.stringify(manifest)),
      {
        key,
        keyVersion: 'v1',
        aad: manifestKey,
        compress: true,
      }
    );
    const marker = {
      format: 'mosaic-dr',
      version: 1,
      backupId: snapshotId,
      keyVersion: 'v1',
      manifestKey,
      manifestCipherSha256: sha256Hex(manifestCipher),
    };
    const objects = new Map([
      [`${prefix}/snapshots/${snapshotId}/COMPLETED`, Buffer.from(JSON.stringify(marker))],
      [manifestKey, manifestCipher],
      [usersKey, usersCipher],
    ]);
    const r2 = {
      getObject: vi.fn(async (objectKey: string) => {
        const value = objects.get(objectKey);
        if (!value) throw new Error('missing');
        return value;
      }),
    };

    const loaded = await loadCommittedSnapshot({
      r2,
      prefix,
      snapshotId,
      encryptionKey: key,
    });
    expect(loaded.manifest.source.projectId).toBe('source-project');
    expect(parseJsonLines(await loaded.readObject(usersKey))).toEqual([
      { id: 'user_1' },
    ]);
  });

  it('imports the original Argon2 hash and account metadata', async () => {
    const users = {
      createArgon2User: vi.fn().mockResolvedValue({}),
      updatePhone: vi.fn().mockResolvedValue({}),
      updateLabels: vi.fn().mockResolvedValue({}),
      updatePrefs: vi.fn().mockResolvedValue({}),
      updateEmailVerification: vi.fn().mockResolvedValue({}),
      updatePhoneVerification: vi.fn().mockResolvedValue({}),
      updateStatus: vi.fn().mockResolvedValue({}),
    };
    const user = {
      id: 'user_1',
      name: 'User',
      email: 'user@example.com',
      phone: '+6512345678',
      status: true,
      labels: ['friend'],
      prefs: { theme: 'dark' },
      emailVerification: true,
      phoneVerification: false,
      mfa: false,
      hash: 'argon2',
      password: '$argon2id$backuphash',
    };

    await createImportedUser(users as any, user);

    expect(users.createArgon2User).toHaveBeenCalledWith({
      userId: 'user_1',
      email: 'user@example.com',
      password: '$argon2id$backuphash',
      name: 'User',
    });
    expect(users.updateStatus).toHaveBeenCalledWith({
      userId: 'user_1',
      status: true,
    });
  });

  it('fails instead of silently weakening unsupported auth state', async () => {
    const users = { createArgon2User: vi.fn() };
    await expect(
      createImportedUser(users as any, {
        id: 'user_1',
        email: 'user@example.com',
        hash: 'bcrypt',
        password: 'hash',
        mfa: false,
      })
    ).rejects.toThrow(/unsupported password hash/);
    await expect(
      createImportedUser(users as any, {
        id: 'user_2',
        email: 'user2@example.com',
        hash: 'argon2',
        password: 'hash',
        mfa: true,
      })
    ).rejects.toThrow(/MFA enabled/);
  });

  it('refuses source-project and non-empty restore targets', async () => {
    const emptyClients = {
      users: { list: vi.fn().mockResolvedValue({ users: [] }) },
      tablesDB: { list: vi.fn().mockResolvedValue({ databases: [] }) },
      storage: { listBuckets: vi.fn().mockResolvedValue({ buckets: [] }) },
    };
    await expect(
      assertSafeTarget({
        targetProjectId: 'source',
        sourceProjectId: 'source',
        clients: emptyClients as any,
      })
    ).rejects.toThrow(/source project/);

    const nonEmpty = {
      ...emptyClients,
      users: {
        list: vi.fn().mockResolvedValue({ users: [{ $id: 'existing' }] }),
      },
    };
    await expect(
      assertSafeTarget({
        targetProjectId: 'target',
        sourceProjectId: 'source',
        clients: nonEmpty as any,
      })
    ).rejects.toThrow(/non-empty/);
  });
});
