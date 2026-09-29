import { describe, expect, it, vi } from 'vitest';
import {
  assertSafeTarget,
  createImportedUser,
  indexCreateInput,
  loadCommittedSnapshot,
  parseArgs,
  parseJsonLines,
  preflightSnapshot,
  readEncryptionKeyring,
  stableJson,
  restoreSnapshot,
  unwrapUserPrefs,
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

  it('parses DR JSONL 64-bit integers as native BigInt', () => {
    const [row] = parseJsonLines(
      Buffer.from('{"id":"row_1","value":9223372036854775807}\n', 'utf8')
    );
    expect(row.value).toBe(9223372036854775807n);
    expect(stableJson(row)).toContain('9223372036854775807');
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
      encryptionKeys: new Map([['v1', key]]),
    });
    expect(loaded.manifest.source.projectId).toBe('source-project');
    expect(parseJsonLines(await loaded.readObject(usersKey))).toEqual([
      { id: 'user_1' },
    ]);
  });

  it('unwraps Appwrite preference model data for the update API', () => {
    expect(unwrapUserPrefs({ data: { theme: 'dark' } })).toEqual({
      theme: 'dark',
    });
    expect(unwrapUserPrefs({ theme: 'light' })).toEqual({ theme: 'light' });
    expect(unwrapUserPrefs(null)).toEqual({});
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
      prefs: { data: { theme: 'dark' } },
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
    expect(users.updatePrefs).toHaveBeenCalledWith({
      userId: 'user_1',
      prefs: { theme: 'dark' },
    });
    expect(users.updateStatus).toHaveBeenCalledWith({
      userId: 'user_1',
      status: true,
    });
  });

  it('skips Appwrite updatePrefs when restored preferences are empty', async () => {
    const users = {
      createArgon2User: vi.fn().mockResolvedValue({}),
      updatePhone: vi.fn().mockResolvedValue({}),
      updateLabels: vi.fn().mockResolvedValue({}),
      updatePrefs: vi.fn().mockResolvedValue({}),
      updateEmailVerification: vi.fn().mockResolvedValue({}),
      updatePhoneVerification: vi.fn().mockResolvedValue({}),
      updateStatus: vi.fn().mockResolvedValue({}),
    };

    await createImportedUser(users as any, {
      id: 'user_empty_prefs',
      name: 'User',
      email: 'empty@example.com',
      phone: '',
      status: true,
      labels: [],
      prefs: {},
      emailVerification: false,
      phoneVerification: false,
      mfa: false,
      hash: 'argon2',
      password: '$argon2id$backuphash',
    });

    expect(users.updatePrefs).not.toHaveBeenCalled();
  });

  it('omits empty index option arrays when recreating Appwrite indexes', () => {
    expect(
      indexCreateInput({
        key: 'idx_user_status',
        type: 'key',
        attributes: ['user_id', 'status'],
        orders: [],
        lengths: [],
      })
    ).toEqual({
      key: 'idx_user_status',
      type: 'key',
      attributes: ['user_id', 'status'],
    });

    expect(
      indexCreateInput({
        key: 'idx_user_status',
        type: 'key',
        attributes: ['user_id', 'status'],
        orders: ['ASC', 'DESC'],
        lengths: [32, 16],
      })
    ).toEqual({
      key: 'idx_user_status',
      type: 'key',
      attributes: ['user_id', 'status'],
      orders: ['ASC', 'DESC'],
      lengths: [32, 16],
    });
  });

  it('fails closed on partially populated index option arrays', () => {
    expect(() =>
      indexCreateInput({
        key: 'idx_user_status',
        type: 'key',
        attributes: ['user_id', 'status'],
        orders: ['ASC'],
      })
    ).toThrow(/orders array length/);
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


  it('selects retained encryption keys by snapshot key version', async () => {
    const v1 = Buffer.alloc(32, 3);
    const v2 = Buffer.alloc(32, 4);
    const keyring = readEncryptionKeyring({
      DR_KEY_VERSION: 'v2',
      DR_ENCRYPTION_KEY_B64: v2.toString('base64'),
      DR_ENCRYPTION_KEYS_JSON: JSON.stringify({
        v1: v1.toString('base64'),
      }),
    } as any);
    expect(keyring.get('v1')).toEqual(v1);
    expect(keyring.get('v2')).toEqual(v2);
  });

  it('preflights every authenticated object and file blob before restore', async () => {
    const readObject = vi.fn(async (key: string) => {
      if (key.endsWith('/files.jsonl.enc')) {
        return Buffer.from(
          JSON.stringify({
            id: 'file_1',
            blobKey: 'mosaic-dr/v1/blobs/v1/hash.enc',
            sha256: sha256Hex(Buffer.from('file bytes')),
          }) + '\n'
        );
      }
      return Buffer.from('{}');
    });
    const readBlob = vi.fn(async () => Buffer.from('file bytes'));
    await preflightSnapshot({
      manifest: {
        objects: [
          { key: 'mosaic-dr/v1/snapshots/x/auth/users.jsonl.enc' },
          { key: 'mosaic-dr/v1/snapshots/x/storage/task_images/files.jsonl.enc' },
        ],
        storage: [
          {
            id: 'task_images',
            filesKey:
              'mosaic-dr/v1/snapshots/x/storage/task_images/files.jsonl.enc',
          },
        ],
      },
      readObject,
      readBlob,
    } as any);
    expect(readObject).toHaveBeenCalledWith(
      'mosaic-dr/v1/snapshots/x/auth/users.jsonl.enc'
    );
    expect(readBlob).toHaveBeenCalledTimes(1);
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


describe('friendship disaster recovery', () => {
  it('restores server-controlled table and owner-only row permissions exactly, including tombstones', async () => {
    const records = ['pending_incoming', 'pending_outgoing', 'accepted', 'blocked'].map((status, i) => ({
      id: 'fr_' + i, data: { user_id: 'alice', friend_id: 'peer_' + i, status, deleted: i === 3 }, permissions: ['read("user:alice")'],
    }));
    const objects = {
      users: '', schema: JSON.stringify({ id: 'friendships', name: 'Friendships', permissions: [], rowSecurity: true, columns: [], indexes: [] }),
      rows: records.map(row => JSON.stringify(row)).join('\n'),
    };
    const tablesDB = { create: vi.fn(), createTable: vi.fn(), createRow: vi.fn() };
    await restoreSnapshot({ snapshot: {
      manifest: { auth: { usersKey: 'users' }, databases: [{ id: 'db', name: 'db', tables: [{ schemaKey: 'schema', rowsKey: 'rows' }] }], storage: [] },
      readObject: async (key: keyof typeof objects) => Buffer.from(objects[key]), readBlob: vi.fn(),
    }, clients: { tablesDB, users: {}, storage: {} } });
    expect(tablesDB.createTable).toHaveBeenCalledWith(expect.objectContaining({ permissions: [], rowSecurity: true }));
    expect(tablesDB.createRow.mock.calls.map(([args]) => ({ id: args.rowId, data: args.data, permissions: args.permissions }))).toEqual(records);
  });
});
