import { Client, Query, Storage, TablesDB, Users } from 'node-appwrite';
import { decodeMasterKey, encryptBuffer, sha256Hex } from './crypto.mjs';
import { createR2Client } from './r2.mjs';
import {
  parseCompletedMarkerKey,
  selectRetainedSnapshotIds,
} from './retention.mjs';

const PAGE_SIZE = 100;

export function buildBackupId(date = new Date()) {
  return date.toISOString().replace(/[-:.]/g, '');
}

function pickDefined(source, keys) {
  const result = {};
  for (const key of keys) {
    if (source[key] !== undefined) result[key] = source[key];
  }
  return result;
}

export function normalizeColumn(column) {
  return pickDefined(column, [
    'key',
    'type',
    'size',
    'required',
    'array',
    'default',
    'encrypt',
    'min',
    'max',
    'elements',
    'relatedTableId',
    'relationType',
    'twoWay',
    'twoWayKey',
    'onDelete',
  ]);
}

export function normalizeIndex(index) {
  const normalized = pickDefined(index, ['key', 'type', 'orders', 'lengths']);
  normalized.attributes = Array.isArray(index.attributes)
    ? [...index.attributes]
    : Array.isArray(index.columns)
      ? [...index.columns]
      : [];
  return normalized;
}

export function serializeRowRecord(row) {
  const data = {};
  for (const [key, value] of Object.entries(row)) {
    if (key.startsWith('$')) continue;
    if (key === 'databaseId' || key === 'tableId') continue;
    data[key] = value;
  }
  return {
    id: row.$id,
    permissions: Array.isArray(row.$permissions) ? [...row.$permissions] : [],
    data,
  };
}

function jsonBuffer(value) {
  return Buffer.from(JSON.stringify(value), 'utf8');
}

function jsonlBuffer(values) {
  const lines = values.map((value) => JSON.stringify(value));
  return Buffer.from(lines.length ? `${lines.join('\n')}\n` : '', 'utf8');
}

export async function listAll(
  listPage,
  itemKey,
  { cursorField = '$id' } = {}
) {
  const all = [];
  let cursor = null;
  let offset = 0;
  for (;;) {
    const queries = [Query.limit(PAGE_SIZE)];
    if (cursorField) {
      queries.push(Query.orderAsc(cursorField));
      if (cursor) queries.push(Query.cursorAfter(cursor));
    } else if (offset > 0) {
      queries.push(Query.offset(offset));
    }
    const page = await listPage(queries);
    const items = Array.isArray(page?.[itemKey]) ? page[itemKey] : [];
    if (items.length === 0) break;
    all.push(...items);
    if (items.length < PAGE_SIZE) break;
    if (cursorField) {
      const nextCursor = items.at(-1)?.[cursorField];
      if (!nextCursor || nextCursor === cursor) {
        throw new Error(`Appwrite pagination stalled for ${itemKey}`);
      }
      cursor = nextCursor;
    } else {
      offset += items.length;
    }
  }
  return all;
}

function appwriteClients({ endpoint, projectId, appwriteKey }) {
  const client = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(appwriteKey);
  return {
    tablesDB: new TablesDB(client),
    storage: new Storage(client),
    users: new Users(client),
  };
}

async function putEncrypted(
  r2,
  key,
  plain,
  { encryptionKey, keyVersion, compress = true }
) {
  const encrypted = encryptBuffer(plain, {
    key: encryptionKey,
    keyVersion,
    aad: key,
    compress,
  });
  const plainSha256 = sha256Hex(plain);
  const cipherSha256 = sha256Hex(encrypted);
  await r2.putObject(key, encrypted, {
    metadata: {
      'plain-sha256': plainSha256,
      'cipher-sha256': cipherSha256,
      'key-version': keyVersion,
    },
  });
  const head = await r2.headObject(key);
  if (
    !head ||
    head.size !== encrypted.length ||
    head.metadata['cipher-sha256'] !== cipherSha256
  ) {
    throw new Error(`R2 verification failed for ${key}`);
  }
  return {
    key,
    plainSha256,
    cipherSha256,
    cipherBytes: encrypted.length,
    plainBytes: plain.length,
  };
}

async function ensureBlob(
  r2,
  key,
  plain,
  { encryptionKey, keyVersion }
) {
  const plainSha256 = sha256Hex(plain);
  const existing = await r2.headObject(key);
  if (existing) {
    if (existing.metadata['plain-sha256'] !== plainSha256) {
      throw new Error(`Existing DR blob hash metadata mismatch for ${key}`);
    }
    return {
      key,
      plainSha256,
      cipherSha256: existing.metadata['cipher-sha256'] || '',
      cipherBytes: existing.size,
      plainBytes: plain.length,
      reused: true,
    };
  }
  return {
    ...(await putEncrypted(r2, key, plain, {
      encryptionKey,
      keyVersion,
      compress: false,
    })),
    reused: false,
  };
}

function normalizedDatabase(database) {
  return pickDefined(database, [
    '$id',
    'name',
    'enabled',
    'specification',
    'replicas',
    'syncMode',
  ]);
}

function normalizedTable(table, columns, indexes) {
  return {
    id: table.$id,
    name: table.name,
    permissions: Array.isArray(table.$permissions)
      ? [...table.$permissions]
      : [],
    rowSecurity: Boolean(table.rowSecurity),
    enabled: table.enabled !== false,
    columns: columns.map(normalizeColumn),
    indexes: indexes.map(normalizeIndex),
  };
}

function normalizedBucket(bucket) {
  return {
    id: bucket.$id,
    name: bucket.name,
    permissions: Array.isArray(bucket.$permissions)
      ? [...bucket.$permissions]
      : [],
    fileSecurity: Boolean(bucket.fileSecurity),
    enabled: bucket.enabled !== false,
    maximumFileSize: bucket.maximumFileSize,
    allowedFileExtensions: Array.isArray(bucket.allowedFileExtensions)
      ? [...bucket.allowedFileExtensions]
      : [],
    compression: bucket.compression,
    encryption: Boolean(bucket.encryption),
    antivirus: Boolean(bucket.antivirus),
    transformations: Boolean(bucket.transformations),
  };
}

function normalizedFile(file, blob) {
  return {
    id: file.$id,
    name: file.name,
    folder: file.folder || '',
    permissions: Array.isArray(file.$permissions) ? [...file.$permissions] : [],
    mimeType: file.mimeType || 'application/octet-stream',
    sizeOriginal: file.sizeOriginal,
    blobKey: blob.key,
    sha256: blob.plainSha256,
    blobCipherSha256: blob.cipherSha256,
    blobBytes: blob.cipherBytes,
  };
}

function normalizedUser(user) {
  return {
    id: user.$id,
    name: user.name || '',
    email: user.email || '',
    phone: user.phone || '',
    status: user.status !== false,
    labels: Array.isArray(user.labels) ? [...user.labels] : [],
    emailVerification: Boolean(user.emailVerification),
    phoneVerification: Boolean(user.phoneVerification),
    mfa: Boolean(user.mfa),
    prefs: user.prefs && typeof user.prefs === 'object' ? user.prefs : {},
    password: user.password || '',
    hash: user.hash || '',
    hashOptions:
      user.hashOptions && typeof user.hashOptions === 'object'
        ? user.hashOptions
        : {},
    passwordUpdate: user.passwordUpdate || '',
  };
}

async function pruneCompletedSnapshots(r2, prefix, currentBackupId, retention) {
  const keys = await r2.listObjects(`${prefix}/snapshots/`);
  const completed = keys
    .map((key) => parseCompletedMarkerKey(key, prefix))
    .filter(Boolean);
  const retained = selectRetainedSnapshotIds(completed, retention);
  retained.add(currentBackupId);
  let pruned = 0;
  for (const backupId of new Set(completed)) {
    if (retained.has(backupId)) continue;
    try {
      await r2.deletePrefix(`${prefix}/snapshots/${backupId}/`);
      pruned += 1;
    } catch {
      // R2 object lock can legitimately refuse deletion.
    }
  }
  return { completed: new Set(completed).size, retained: retained.size, pruned };
}

export function readBackupConfig(env = process.env) {
  const required = [
    'APPWRITE_FUNCTION_API_ENDPOINT',
    'APPWRITE_FUNCTION_PROJECT_ID',
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET',
    'DR_ENCRYPTION_KEY_B64',
  ];
  for (const name of required) {
    if (!env[name]) throw new Error(`Missing required DR variable: ${name}`);
  }
  const int = (name, fallback) => {
    const value = Number.parseInt(env[name] || String(fallback), 10);
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`Invalid DR numeric variable: ${name}`);
    }
    return value;
  };
  return {
    endpoint: env.APPWRITE_FUNCTION_API_ENDPOINT,
    projectId: env.APPWRITE_FUNCTION_PROJECT_ID,
    r2: {
      accountId: env.R2_ACCOUNT_ID,
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      bucket: env.R2_BUCKET,
      endpoint: env.R2_ENDPOINT || undefined,
    },
    encryptionKey: decodeMasterKey(env.DR_ENCRYPTION_KEY_B64),
    keyVersion: env.DR_KEY_VERSION || 'v1',
    prefix: (env.DR_PREFIX || 'mosaic-dr/v1').replace(/\/+$/, ''),
    retention: {
      daily: int('DR_RETENTION_DAILY', 7),
      weekly: int('DR_RETENTION_WEEKLY', 4),
      monthly: int('DR_RETENTION_MONTHLY', 6),
      lockDays: int('DR_OBJECT_LOCK_DAYS', 30),
    },
  };
}

export async function runBackup({
  appwriteKey,
  config = readBackupConfig(),
  now = new Date(),
  r2: injectedR2,
}) {
  if (!appwriteKey) throw new Error('Missing Appwrite execution key');
  const { tablesDB, storage, users } = appwriteClients({
    ...config,
    appwriteKey,
  });
  const r2 = injectedR2 || createR2Client(config.r2);
  const backupId = buildBackupId(now);
  const snapshotPrefix = `${config.prefix}/snapshots/${backupId}`;
  const startedAt = now.toISOString();
  const objects = [];
  const counts = {
    databases: 0,
    tables: 0,
    rows: 0,
    users: 0,
    buckets: 0,
    files: 0,
    fileBytes: 0,
    newBlobs: 0,
    reusedBlobs: 0,
  };

  let backupStage = 'auth_export';
  try {
    const listedUsers = await listAll(
    (queries) => users.list({ queries, total: false }),
    'users'
  );
  const fullUsers = [];
  for (const user of listedUsers) {
    fullUsers.push(normalizedUser(await users.get({ userId: user.$id })));
  }
  counts.users = fullUsers.length;
  const usersKey = `${snapshotPrefix}/auth/users.jsonl.enc`;
  objects.push(
    await putEncrypted(r2, usersKey, jsonlBuffer(fullUsers), {
      encryptionKey: config.encryptionKey,
      keyVersion: config.keyVersion,
      compress: true,
    })
  );

    backupStage = 'tables_export';
    const manifestDatabases = [];
    const databases = await listAll(
    (queries) => tablesDB.list({ queries, total: false }),
    'databases'
  );
  for (const database of databases) {
    counts.databases += 1;
    const tableManifests = [];
    const tables = await listAll(
      (queries) =>
        tablesDB.listTables({
          databaseId: database.$id,
          queries,
          total: false,
        }),
      'tables'
    );
    for (const table of tables) {
      counts.tables += 1;
      const [columns, indexes, rows] = await Promise.all([
        listAll(
          (queries) =>
            tablesDB.listColumns({
              databaseId: database.$id,
              tableId: table.$id,
              queries,
              total: false,
            }),
          'columns',
          { cursorField: null }
        ),
        listAll(
          (queries) =>
            tablesDB.listIndexes({
              databaseId: database.$id,
              tableId: table.$id,
              queries,
              total: false,
            }),
          'indexes',
          { cursorField: null }
        ),
        listAll(
          (queries) =>
            tablesDB.listRows({
              databaseId: database.$id,
              tableId: table.$id,
              queries,
              total: false,
              ttl: 0,
            }),
          'rows'
        ),
      ]);
      const records = rows.map(serializeRowRecord);
      counts.rows += records.length;
      const schema = normalizedTable(table, columns, indexes);
      const schemaKey = `${snapshotPrefix}/tables/${database.$id}/${table.$id}/schema.json.enc`;
      const rowsKey = `${snapshotPrefix}/tables/${database.$id}/${table.$id}/rows.jsonl.enc`;
      objects.push(
        await putEncrypted(r2, schemaKey, jsonBuffer(schema), {
          encryptionKey: config.encryptionKey,
          keyVersion: config.keyVersion,
          compress: true,
        })
      );
      objects.push(
        await putEncrypted(r2, rowsKey, jsonlBuffer(records), {
          encryptionKey: config.encryptionKey,
          keyVersion: config.keyVersion,
          compress: true,
        })
      );
      tableManifests.push({
        id: table.$id,
        schemaKey,
        rowsKey,
        rowCount: records.length,
      });
    }
    manifestDatabases.push({
      ...normalizedDatabase(database),
      id: database.$id,
      tables: tableManifests,
    });
  }

    backupStage = 'storage_export';
    const manifestBuckets = [];
    const buckets = await listAll(
    (queries) => storage.listBuckets({ queries, total: false }),
    'buckets'
  );
  for (const bucket of buckets) {
    counts.buckets += 1;
    const bucketConfig = normalizedBucket(bucket);
    const bucketKey = `${snapshotPrefix}/storage/${bucket.$id}/bucket.json.enc`;
    objects.push(
      await putEncrypted(r2, bucketKey, jsonBuffer(bucketConfig), {
        encryptionKey: config.encryptionKey,
        keyVersion: config.keyVersion,
        compress: true,
      })
    );

    const files = await listAll(
      (queries) =>
        storage.listFiles({
          bucketId: bucket.$id,
          queries,
          total: false,
        }),
      'files'
    );
    const fileRecords = [];
    for (const file of files) {
      const raw = Buffer.from(
        await storage.getFileDownload({
          bucketId: bucket.$id,
          fileId: file.$id,
        })
      );
      const hash = sha256Hex(raw);
      const blobKey = `${config.prefix}/blobs/${config.keyVersion}/${hash}.enc`;
      const blob = await ensureBlob(r2, blobKey, raw, {
        encryptionKey: config.encryptionKey,
        keyVersion: config.keyVersion,
      });
      counts.files += 1;
      counts.fileBytes += raw.length;
      counts[blob.reused ? 'reusedBlobs' : 'newBlobs'] += 1;
      fileRecords.push(normalizedFile(file, blob));
    }
    const filesKey = `${snapshotPrefix}/storage/${bucket.$id}/files.jsonl.enc`;
    objects.push(
      await putEncrypted(r2, filesKey, jsonlBuffer(fileRecords), {
        encryptionKey: config.encryptionKey,
        keyVersion: config.keyVersion,
        compress: true,
      })
    );
    manifestBuckets.push({
      id: bucket.$id,
      configKey: bucketKey,
      filesKey,
      fileCount: fileRecords.length,
    });
  }

    backupStage = 'commit';
    const completedAt = new Date().toISOString();
    const manifest = {
    format: 'mosaic-dr',
    version: 1,
    backupId,
    keyVersion: config.keyVersion,
    startedAt,
    completedAt,
    source: {
      endpoint: config.endpoint,
      projectId: config.projectId,
    },
    counts,
    auth: { usersKey },
    databases: manifestDatabases,
    storage: manifestBuckets,
    objects,
  };
  const manifestKey = `${snapshotPrefix}/manifest.json.enc`;
  const manifestObject = await putEncrypted(
    r2,
    manifestKey,
    jsonBuffer(manifest),
    {
      encryptionKey: config.encryptionKey,
      keyVersion: config.keyVersion,
      compress: true,
    }
  );
  const markerKey = `${snapshotPrefix}/COMPLETED`;
  const marker = {
    format: 'mosaic-dr',
    version: 1,
    backupId,
    keyVersion: config.keyVersion,
    completedAt,
    manifestKey,
    manifestCipherSha256: manifestObject.cipherSha256,
  };
  await r2.putObject(markerKey, jsonBuffer(marker), {
    contentType: 'application/json',
    metadata: { 'backup-id': backupId },
  });
  const markerHead = await r2.headObject(markerKey);
  if (!markerHead) {
    throw new Error('R2 verification failed for COMPLETED marker');
  }

    backupStage = 'retention';
    const retention = await pruneCompletedSnapshots(
      r2,
      config.prefix,
      backupId,
      { ...config.retention, now: new Date(completedAt) }
    );
    return { backupId, counts, retention };
  } catch (err) {
    if (err && typeof err === 'object' && !err.backupStage) {
      try {
        Object.defineProperty(err, 'backupStage', {
          value: backupStage,
          enumerable: false,
          configurable: true,
        });
      } catch {
        // Preserve the original error when the thrown value cannot be annotated.
      }
    }
    throw err;
  }
}
