import { describe, expect, it, vi } from 'vitest';
import {
  assertSafeTarget,
  assessArchivedSource,
  createImportedUser,
  indexCreateInput,
  loadCommittedSnapshot,
  latestCommittedSnapshotId,
  loadPrivacyDeletedUserIds,
  parseArgs,
  parseJsonLines,
  planDeferredRowDefaults,
  preflightSnapshot,
  readEncryptionKeyring,
  readRestoreConfig,
  stableJson,
  restoreSnapshot,
  scrubDeletedUserRow,
  shouldRestoreFile,
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
      preflightOnly: false,
      latest: false,
    });
  });

  it('permits source-only ciphertext assessment with no target project or API key', () => {
    expect(parseArgs(['--snapshot', '20261018T000000000Z', '--preflight-only']))
      .toEqual({
        snapshot: '20261018T000000000Z',
        targetProject: '',
        endpoint: process.env.APPWRITE_TARGET_ENDPOINT || 'https://sgp.cloud.appwrite.io/v1',
        verifyOnly: false,
        preflightOnly: true,
        latest: false,
      });
    expect(() => parseArgs(['--snapshot', 'x', '--preflight-only', '--verify-only']))
      .toThrow(/cannot be combined/);
    expect(() => parseArgs(['--snapshot', 'x'])).toThrow(/target-project/);
    expect(parseArgs(['--preflight-only', '--latest']).latest).toBe(true);
    expect(() => parseArgs(['--latest'])).toThrow(/preflight-only/);
    expect(() => parseArgs(['--latest', '--preflight-only', '--snapshot', 'x']))
      .toThrow(/cannot be combined/);


    const env = {
      R2_ACCOUNT_ID: 'fake-account',
      R2_ACCESS_KEY_ID: 'fake-read-only-id',
      R2_SECRET_ACCESS_KEY: 'fake-read-only-secret',
      R2_BUCKET: 'fake-source-bucket',
      DR_ENCRYPTION_KEY_B64: Buffer.alloc(32, 3).toString('base64'),
      DR_KEY_VERSION: 'v1',
    };
    expect(readRestoreConfig(env, { requireTargetApiKey: false }).targetApiKey)
      .toBeUndefined();
    expect(() => readRestoreConfig(env)).toThrow(/APPWRITE_TARGET_API_KEY/);
  });

  it('selects newest timestamped committed R2 generation without accepting arbitrary keys', async () => {
    const root = 'mosaic-dr/v1/snapshots/';
    const keys = [
      root + '20261016T110126909Z/COMPLETED',
      root + '20261017T020003009Z/incomplete-metadata',
      root + '../../foreign/COMPLETED',
      root + '20261018T091523102Z/COMPLETED',
      'foreign-prefix/snapshots/20261019T000000000Z/COMPLETED',
      root + 'malformed/COMPLETED',
    ];
    const r2 = { listObjects: vi.fn().mockResolvedValue(keys) };
    expect(await latestCommittedSnapshotId(r2 as any, 'mosaic-dr/v1'))
      .toBe('20261018T091523102Z');
    expect(r2.listObjects).toHaveBeenCalledWith(root);
    await expect(latestCommittedSnapshotId({
      listObjects: vi.fn().mockResolvedValue([root + 'malformed/COMPLETED']),
    } as any, 'mosaic-dr/v1')).rejects.toThrow(/No timestamped completed/);
  });

  it('authenticates and assesses archived source without creating users or target clients', async () => {
    const auth = (users: unknown[]) => ({
      manifest: {
        objects: [],
        auth: { usersKey: 'auth' },
        databases: [{ id: 'life_tracker', tables: [{ id: 'tasks' }, { id: 'diary' }] }],
        storage: [],
      },
      readObject: vi.fn(async (key: string) => {
        expect(key).toBe('auth');
        return Buffer.from(users.map(x => JSON.stringify(x)).join('\n') + '\n');
      }),
      readBlob: vi.fn(),
    });
    const source = auth([
      { id: 'old_deleted', hash: 'argon2', password: 'irrelevant-legacy-hash' },
      { id: 'current_owner', hash: 'argon2', password: 'irrelevant-legacy-hash' },
    ]);
    const result = await assessArchivedSource(source as any, new Set(['old_deleted']));
    expect(result).toEqual({
      archivedAccounts: 2,
      eligibleAccounts: 1,
      maskedAccounts: 1,
      databases: 1,
      tables: 2,
      buckets: 0,
    });
    expect(source.readObject).toHaveBeenCalled();
    expect(source.readBlob).not.toHaveBeenCalled();

    await expect(assessArchivedSource(auth([
      { id: 'owner', hash: 'bcrypt', password: 'unsupported' },
    ]) as any)).rejects.toThrow(/unsupported credential/);
    await expect(assessArchivedSource(auth([
      { id: 'duplicate', hash: 'argon2', password: 'v' },
      { id: 'duplicate', hash: 'argon2', password: 'v' },
    ]) as any)).rejects.toThrow(/duplicated/);
    await expect(assessArchivedSource({
      manifest: { objects: [], auth: { usersKey: '' }, databases: [], storage: [] },
      readObject: vi.fn(), readBlob: vi.fn(),
    } as any)).rejects.toThrow(/required account/);
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

  it('loads encrypted external privacy deletion markers', async () => {
    const key = Buffer.alloc(32, 11);
    const prefix = 'mosaic-dr/v1';
    const markerKey =
      prefix +
      '/privacy-deletions/' +
      sha256Hex(Buffer.from('alice', 'utf8')) +
      '.json.enc';
    const plain = Buffer.from(
      JSON.stringify({
        format: 'mosaic-dr-privacy-deletion',
        version: 1,
        userId: 'alice',
        deletedAt: '2026-10-04T00:00:00.000Z',
      })
    );
    const cipher = encryptBuffer(plain, {
      key,
      keyVersion: 'v1',
      aad: markerKey,
      compress: true,
    });
    const r2 = {
      listObjects: vi.fn().mockResolvedValue([markerKey]),
      headObject: vi.fn().mockResolvedValue({
        metadata: {
          'key-version': 'v1',
          'cipher-sha256': sha256Hex(cipher),
          'plain-sha256': sha256Hex(plain),
        },
      }),
      getObject: vi.fn().mockResolvedValue(cipher),
    };

    const deleted = await loadPrivacyDeletedUserIds({
      r2: r2 as any,
      prefix,
      encryptionKeys: new Map([['v1', key]]),
    });

    expect([...deleted]).toEqual(['alice']);
  });

  it('filters deleted users from restored rows, reactions, preferences, and files', () => {
    const deleted = new Set(['alice']);

    expect(
      scrubDeletedUserRow(
        'messages',
        {
          id: 'msg_peer',
          data: {
            user_id: 'bob',
            sender_id: 'alice',
            recipient_id: 'bob',
          },
        },
        deleted
      )
    ).toBeNull();

    expect(
      scrubDeletedUserRow(
        'tasks',
        {
          id: 'task_bob',
          data: {
            user_id: 'bob',
            reactions: JSON.stringify([
              { emoji: '❤️', userIds: ['alice', 'bob'] },
            ]),
          },
        },
        deleted
      )?.data.reactions
    ).toBe(JSON.stringify([{ emoji: '❤️', userIds: ['bob'] }]));

    const settings = scrubDeletedUserRow(
      'settings',
      {
        id: 'settings_bob',
        data: {
          user_id: 'bob',
          key: 'friend_carousel_prefs',
          value: JSON.stringify({
            order: ['alice', 'carol'],
            hidden: ['alice'],
          }),
        },
      },
      deleted
    );
    expect(JSON.parse(settings?.data.value)).toEqual({
      order: ['carol'],
      hidden: [],
    });

    expect(
      shouldRestoreFile(
        {
          permissions: [
            'read("users")',
            'update("user:alice")',
            'delete("user:alice")',
          ],
        },
        deleted
      )
    ).toBe(false);
    expect(
      shouldRestoreFile(
        { permissions: ['update("user:bob")', 'delete("user:bob")'] },
        deleted
      )
    ).toBe(true);
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



describe('DR nullable-default restoration', () => {
  const schema = {
    id: 'tasks',
    name: 'Tasks',
    rowSecurity: true,
    columns: [
      { key: 'order', type: 'integer', required: false, default: 0, min: 0, max: 999999 },
      { key: 'title', type: 'varchar', required: false, default: '', size: 255 },
    ],
    indexes: [],
  };
  const objects = {
    users: '',
    schema: JSON.stringify(schema),
    rows: JSON.stringify({ id: 'task_a', data: { order: null, title: 'fixture' }, permissions: [] }),
  };
  const snapshot = {
    manifest: {
      auth: { usersKey: 'users' },
      databases: [{ id: 'life_tracker', tables: [{ schemaKey: 'schema', rowsKey: 'rows' }] }],
      storage: [],
    },
    readObject: async (key: keyof typeof objects) => Buffer.from(objects[key]),
  };

  it('preserves historical null before reinstating the original integer default', async () => {
    const calls: string[] = [];
    const tablesDB = {
      create: vi.fn().mockResolvedValue({}),
      createTable: vi.fn(async (input: any) => {
        calls.push('schema');
        expect(input.columns.find((c: any) => c.key === 'order').default).toBeNull();
        expect(input.columns.find((c: any) => c.key === 'title').default).toBe('');
      }),
      createRow: vi.fn(async (input: any) => {
        calls.push('row');
        expect(input.data.order).toBeNull();
      }),
      updateIntegerColumn: vi.fn(async (input: any) => {
        calls.push('default');
        return { key: input.key, default: input.default, status: 'available' };
      }),
    };
    await restoreSnapshot({
      snapshot: snapshot as any,
      clients: { users: {}, tablesDB, storage: {} } as any,
    });
    expect(calls).toEqual(['schema', 'row', 'default']);
    expect(tablesDB.updateIntegerColumn).toHaveBeenCalledWith({
      databaseId: 'life_tracker',
      tableId: 'tasks',
      key: 'order',
      required: false,
      default: 0,
      min: 0,
      max: 999999,
    });
    expect(schema.columns[0].default).toBe(0);
  });

  it('fails closed for unsupported default types, and leaves unused defaults unchanged', () => {
    expect(planDeferredRowDefaults(schema, [{ data: { order: 0, title: '' } }])).toEqual({
      deferred: [], columns: schema.columns,
    });
    expect(() => planDeferredRowDefaults(schema, [{ data: { title: null } }]))
      .toThrow(/update contract not validated/);
  });

  it('reinstates defaults even if importing the row throws', async () => {
    const tablesDB = {
      create: vi.fn().mockResolvedValue({}),
      createTable: vi.fn().mockResolvedValue({}),
      createRow: vi.fn().mockRejectedValue(new Error('row failed')),
      updateIntegerColumn: vi.fn().mockResolvedValue({
        key: 'order', default: 0, status: 'available',
      }),
    };
    await expect(restoreSnapshot({
      snapshot: snapshot as any,
      clients: { users: {}, tablesDB, storage: {} } as any,
    })).rejects.toThrow('row failed');
    expect(tablesDB.updateIntegerColumn).toHaveBeenCalledTimes(1);
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
