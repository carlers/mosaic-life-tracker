import {
  Client,
  Query,
  Storage,
  TablesDB,
  Users,
} from 'node-appwrite';
import { InputFile } from 'node-appwrite/file';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createR2Client } from '../appwrite-functions/dr-backup/r2.mjs';
import {
  decodeMasterKey,
  decryptBuffer,
  sha256Hex,
} from '../appwrite-functions/dr-backup/crypto.mjs';
import {
  normalizeColumn,
  normalizeIndex,
  serializeRowRecord,
} from '../appwrite-functions/dr-backup/backup.mjs';

const DEFAULT_ENDPOINT = 'https://sgp.cloud.appwrite.io/v1';

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => [key, sortObject(child)])
  );
}

export function stableJson(value) {
  return JSON.stringify(sortObject(value));
}

export function parseJsonLines(buffer) {
  const text = Buffer.from(buffer).toString('utf8').trim();
  if (!text) return [];
  return text
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

export function parseArgs(argv) {
  const args = {
    snapshot: '',
    targetProject: '',
    endpoint: process.env.APPWRITE_TARGET_ENDPOINT || DEFAULT_ENDPOINT,
    verifyOnly: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--snapshot') args.snapshot = argv[++index] || '';
    else if (token === '--target-project') {
      args.targetProject = argv[++index] || '';
    } else if (token === '--endpoint') {
      args.endpoint = argv[++index] || '';
    } else if (token === '--verify-only') {
      args.verifyOnly = true;
    } else {
      throw new Error(`Unknown DR restore argument: ${token}`);
    }
  }
  if (!args.snapshot) throw new Error('Missing --snapshot <backupId>');
  if (!args.targetProject) {
    throw new Error('Missing --target-project <projectId>');
  }
  if (!args.endpoint) throw new Error('Missing target Appwrite endpoint');
  return args;
}

export function readEncryptionKeyring(env = process.env) {
  const keyring = new Map();
  if (env.DR_ENCRYPTION_KEYS_JSON) {
    let parsed;
    try {
      parsed = JSON.parse(env.DR_ENCRYPTION_KEYS_JSON);
    } catch {
      throw new Error('DR_ENCRYPTION_KEYS_JSON must be valid JSON');
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('DR_ENCRYPTION_KEYS_JSON must be an object');
    }
    for (const [version, encoded] of Object.entries(parsed)) {
      if (!version) throw new Error('DR encryption key version cannot be empty');
      keyring.set(version, decodeMasterKey(encoded));
    }
  }
  if (env.DR_ENCRYPTION_KEY_B64) {
    keyring.set(
      env.DR_KEY_VERSION || 'v1',
      decodeMasterKey(env.DR_ENCRYPTION_KEY_B64)
    );
  }
  if (keyring.size === 0) {
    throw new Error(
      'Missing restore encryption key: set DR_ENCRYPTION_KEY_B64 or DR_ENCRYPTION_KEYS_JSON'
    );
  }
  return keyring;
}

export function readRestoreConfig(env = process.env) {
  const required = [
    'APPWRITE_TARGET_API_KEY',
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET',
  ];
  for (const name of required) {
    if (!env[name]) {
      throw new Error(`Missing required restore variable: ${name}`);
    }
  }
  return {
    targetApiKey: env.APPWRITE_TARGET_API_KEY,
    r2: {
      accountId: env.R2_ACCOUNT_ID,
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      bucket: env.R2_BUCKET,
    },
    encryptionKeys: readEncryptionKeyring(env),
    prefix: (env.DR_PREFIX || 'mosaic-dr/v1').replace(/\/+$/, ''),
  };
}

export function createTargetClients({ endpoint, projectId, apiKey }) {
  const client = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey);
  return {
    users: new Users(client),
    tablesDB: new TablesDB(client),
    storage: new Storage(client),
  };
}

async function loadEncryptedObject(
  r2,
  key,
  encryptionKeys,
  { cipherSha256, plainSha256, keyVersion } = {}
) {
  const encrypted = await r2.getObject(key);
  if (cipherSha256 && sha256Hex(encrypted) !== cipherSha256) {
    throw new Error(`Ciphertext SHA-256 mismatch for ${key}`);
  }
  const encryptionKey = encryptionKeys.get(keyVersion);
  if (!encryptionKey) {
    throw new Error(`No escrowed DR encryption key for version ${keyVersion}`);
  }
  const decrypted = decryptBuffer(encrypted, {
    key: encryptionKey,
    aad: key,
  });
  if (keyVersion && decrypted.keyVersion !== keyVersion) {
    throw new Error(`Encryption key version mismatch for ${key}`);
  }
  if (plainSha256 && sha256Hex(decrypted.plain) !== plainSha256) {
    throw new Error(`Plaintext SHA-256 mismatch for ${key}`);
  }
  return decrypted.plain;
}

export async function loadCommittedSnapshot({
  r2,
  prefix,
  snapshotId,
  encryptionKeys,
}) {
  const markerKey = `${prefix}/snapshots/${snapshotId}/COMPLETED`;
  const marker = JSON.parse((await r2.getObject(markerKey)).toString('utf8'));
  if (
    marker?.format !== 'mosaic-dr' ||
    marker?.version !== 1 ||
    marker?.backupId !== snapshotId ||
    typeof marker?.manifestKey !== 'string' ||
    typeof marker?.manifestCipherSha256 !== 'string'
  ) {
    throw new Error('Invalid or mismatched DR COMPLETED marker');
  }

  const manifestPlain = await loadEncryptedObject(
    r2,
    marker.manifestKey,
    encryptionKeys,
    {
      cipherSha256: marker.manifestCipherSha256,
      keyVersion: marker.keyVersion,
    }
  );
  const manifest = JSON.parse(manifestPlain.toString('utf8'));
  if (
    manifest?.format !== 'mosaic-dr' ||
    manifest?.version !== 1 ||
    manifest?.backupId !== snapshotId ||
    manifest?.keyVersion !== marker.keyVersion
  ) {
    throw new Error('Invalid or mismatched DR manifest');
  }

  const descriptors = new Map(
    (manifest.objects || []).map((object) => [object.key, object])
  );

  async function readObject(key) {
    const descriptor = descriptors.get(key);
    if (!descriptor) {
      throw new Error(`Manifest does not authenticate object ${key}`);
    }
    return loadEncryptedObject(r2, key, encryptionKeys, {
      cipherSha256: descriptor.cipherSha256,
      plainSha256: descriptor.plainSha256,
      keyVersion: manifest.keyVersion,
    });
  }

  async function readBlob(file) {
    return loadEncryptedObject(r2, file.blobKey, encryptionKeys, {
      cipherSha256: file.blobCipherSha256,
      plainSha256: file.sha256,
      keyVersion: manifest.keyVersion,
    });
  }

  return { marker, manifest, readObject, readBlob };
}

export async function preflightSnapshot(snapshot) {
  const { manifest, readObject, readBlob } = snapshot;
  for (const descriptor of manifest.objects || []) {
    await readObject(descriptor.key);
  }
  for (const bucket of manifest.storage || []) {
    const files = parseJsonLines(await readObject(bucket.filesKey));
    for (const file of files) {
      const bytes = await readBlob(file);
      if (sha256Hex(bytes) !== file.sha256) {
        throw new Error(`Source blob verification failed for ${bucket.id}/${file.id}`);
      }
    }
  }
}

export async function assertSafeTarget({
  targetProjectId,
  sourceProjectId,
  clients,
}) {
  if (targetProjectId === sourceProjectId) {
    throw new Error('Refusing to restore a snapshot into its source project');
  }
  const [users, databases, buckets] = await Promise.all([
    clients.users.list({
      queries: [Query.limit(1)],
      total: false,
    }),
    clients.tablesDB.list({
      queries: [Query.limit(1)],
      total: false,
    }),
    clients.storage.listBuckets({
      queries: [Query.limit(1)],
      total: false,
    }),
  ]);
  if (
    (users.users || []).length > 0 ||
    (databases.databases || []).length > 0 ||
    (buckets.buckets || []).length > 0
  ) {
    throw new Error(
      'Refusing to restore into a non-empty Appwrite project'
    );
  }
}

export async function createImportedUser(users, user) {
  if (!user?.id) throw new Error('Backup user is missing an ID');
  if (user.mfa) {
    throw new Error(
      `User ${user.id} has MFA enabled; mosaic-dr/v1 does not back up MFA factors`
    );
  }
  if (user.hash !== 'argon2' || !user.password) {
    throw new Error(
      `User ${user.id} has unsupported password hash type ${user.hash || '(none)'}`
    );
  }
  await users.createArgon2User({
    userId: user.id,
    email: user.email,
    password: user.password,
    name: user.name || '',
  });
  if (user.phone) {
    await users.updatePhone({ userId: user.id, number: user.phone });
  }
  await users.updateLabels({
    userId: user.id,
    labels: Array.isArray(user.labels) ? user.labels : [],
  });
  await users.updatePrefs({
    userId: user.id,
    prefs: user.prefs && typeof user.prefs === 'object' ? user.prefs : {},
  });
  await users.updateEmailVerification({
    userId: user.id,
    emailVerification: Boolean(user.emailVerification),
  });
  if (user.phone) {
    await users.updatePhoneVerification({
      userId: user.id,
      phoneVerification: Boolean(user.phoneVerification),
    });
  }
  await users.updateStatus({
    userId: user.id,
    status: user.status !== false,
  });
}

function databaseCreateInput(database) {
  const input = {
    databaseId: database.id,
    name: database.name,
    enabled: database.enabled !== false,
  };
  if (database.specification) input.specification = database.specification;
  if (Number.isFinite(database.replicas)) input.replicas = database.replicas;
  if (database.syncMode) input.syncMode = database.syncMode;
  return input;
}

function bucketCreateInput(bucket) {
  return {
    bucketId: bucket.id,
    name: bucket.name,
    permissions: bucket.permissions || [],
    fileSecurity: Boolean(bucket.fileSecurity),
    enabled: bucket.enabled !== false,
    maximumFileSize: bucket.maximumFileSize,
    allowedFileExtensions: bucket.allowedFileExtensions || [],
    compression: bucket.compression,
    encryption: Boolean(bucket.encryption),
    antivirus: Boolean(bucket.antivirus),
    transformations: Boolean(bucket.transformations),
  };
}

function tableCreateInput(databaseId, schema) {
  return {
    databaseId,
    tableId: schema.id,
    name: schema.name,
    permissions: schema.permissions || [],
    rowSecurity: Boolean(schema.rowSecurity),
    enabled: schema.enabled !== false,
    columns: schema.columns || [],
    indexes: schema.indexes || [],
  };
}

async function withTempFile(name, bytes, callback) {
  const directory = await mkdtemp(join(tmpdir(), 'mosaic-dr-'));
  const path = join(directory, 'file');
  try {
    await writeFile(path, bytes);
    return await callback(InputFile.fromPath(path, name));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export async function restoreSnapshot({ snapshot, clients }) {
  const { manifest, readObject, readBlob } = snapshot;

  const users = parseJsonLines(await readObject(manifest.auth.usersKey));
  for (const user of users) {
    await createImportedUser(clients.users, user);
  }

  for (const database of manifest.databases || []) {
    await clients.tablesDB.create(databaseCreateInput(database));
    for (const table of database.tables || []) {
      const schema = JSON.parse(
        (await readObject(table.schemaKey)).toString('utf8')
      );
      await clients.tablesDB.createTable(
        tableCreateInput(database.id, schema)
      );
      const rows = parseJsonLines(await readObject(table.rowsKey));
      for (const row of rows) {
        await clients.tablesDB.createRow({
          databaseId: database.id,
          tableId: schema.id,
          rowId: row.id,
          data: row.data,
          permissions: row.permissions || [],
        });
      }
    }
  }

  for (const bucket of manifest.storage || []) {
    const config = JSON.parse(
      (await readObject(bucket.configKey)).toString('utf8')
    );
    await clients.storage.createBucket(bucketCreateInput(config));
    const files = parseJsonLines(await readObject(bucket.filesKey));
    for (const file of files) {
      const bytes = await readBlob(file);
      if (sha256Hex(bytes) !== file.sha256) {
        throw new Error(`File SHA-256 mismatch for ${file.id}`);
      }
      await withTempFile(file.name || file.id, bytes, async (inputFile) => {
        await clients.storage.createFile({
          bucketId: config.id,
          fileId: file.id,
          file: inputFile,
          permissions: file.permissions || [],
          ...(file.folder ? { folder: file.folder } : {}),
        });
      });
    }
  }

  return {
    users: users.length,
    databases: (manifest.databases || []).length,
    buckets: (manifest.storage || []).length,
  };
}

function comparableUser(user) {
  return {
    id: user.$id,
    name: user.name || '',
    email: user.email || '',
    phone: user.phone || '',
    status: user.status !== false,
    labels: [...(user.labels || [])].sort(),
    emailVerification: Boolean(user.emailVerification),
    phoneVerification: Boolean(user.phoneVerification),
    prefs: user.prefs || {},
    password: user.password || '',
    hash: user.hash || '',
  };
}

function expectedUser(user) {
  return {
    id: user.id,
    name: user.name || '',
    email: user.email || '',
    phone: user.phone || '',
    status: user.status !== false,
    labels: [...(user.labels || [])].sort(),
    emailVerification: Boolean(user.emailVerification),
    phoneVerification: user.phone
      ? Boolean(user.phoneVerification)
      : false,
    prefs: user.prefs || {},
    password: user.password || '',
    hash: user.hash || '',
  };
}

function comparableTable(table, columns, indexes) {
  return {
    id: table.$id,
    name: table.name,
    permissions: [...(table.$permissions || [])].sort(),
    rowSecurity: Boolean(table.rowSecurity),
    enabled: table.enabled !== false,
    columns: columns
      .map(normalizeColumn)
      .sort((a, b) => a.key.localeCompare(b.key)),
    indexes: indexes
      .map(normalizeIndex)
      .sort((a, b) => a.key.localeCompare(b.key)),
  };
}

function expectedTable(schema) {
  return {
    id: schema.id,
    name: schema.name,
    permissions: [...(schema.permissions || [])].sort(),
    rowSecurity: Boolean(schema.rowSecurity),
    enabled: schema.enabled !== false,
    columns: [...(schema.columns || [])].sort((a, b) =>
      a.key.localeCompare(b.key)
    ),
    indexes: [...(schema.indexes || [])].sort((a, b) =>
      a.key.localeCompare(b.key)
    ),
  };
}

function comparableBucket(bucket) {
  return {
    id: bucket.$id,
    name: bucket.name,
    permissions: [...(bucket.$permissions || [])].sort(),
    fileSecurity: Boolean(bucket.fileSecurity),
    enabled: bucket.enabled !== false,
    maximumFileSize: bucket.maximumFileSize,
    allowedFileExtensions: [...(bucket.allowedFileExtensions || [])].sort(),
    compression: bucket.compression,
    encryption: Boolean(bucket.encryption),
    antivirus: Boolean(bucket.antivirus),
    transformations: Boolean(bucket.transformations),
  };
}

function expectedBucket(bucket) {
  return {
    id: bucket.id,
    name: bucket.name,
    permissions: [...(bucket.permissions || [])].sort(),
    fileSecurity: Boolean(bucket.fileSecurity),
    enabled: bucket.enabled !== false,
    maximumFileSize: bucket.maximumFileSize,
    allowedFileExtensions: [...(bucket.allowedFileExtensions || [])].sort(),
    compression: bucket.compression,
    encryption: Boolean(bucket.encryption),
    antivirus: Boolean(bucket.antivirus),
    transformations: Boolean(bucket.transformations),
  };
}

export async function verifySnapshot({ snapshot, clients }) {
  const { manifest, readObject, readBlob } = snapshot;
  const users = parseJsonLines(await readObject(manifest.auth.usersKey));
  let checkedRows = 0;
  let checkedFiles = 0;

  for (const source of users) {
    const target = await clients.users.get({ userId: source.id });
    if (stableJson(comparableUser(target)) !== stableJson(expectedUser(source))) {
      throw new Error(`User verification failed for ${source.id}`);
    }
  }

  for (const database of manifest.databases || []) {
    const targetDatabase = await clients.tablesDB.get({
      databaseId: database.id,
    });
    if (
      targetDatabase.$id !== database.id ||
      targetDatabase.name !== database.name ||
      targetDatabase.enabled !== (database.enabled !== false)
    ) {
      throw new Error(`Database verification failed for ${database.id}`);
    }

    for (const table of database.tables || []) {
      const schema = JSON.parse(
        (await readObject(table.schemaKey)).toString('utf8')
      );
      const [targetTable, columns, indexes] = await Promise.all([
        clients.tablesDB.getTable({
          databaseId: database.id,
          tableId: schema.id,
        }),
        clients.tablesDB.listColumns({
          databaseId: database.id,
          tableId: schema.id,
          queries: [Query.limit(100)],
          total: false,
        }),
        clients.tablesDB.listIndexes({
          databaseId: database.id,
          tableId: schema.id,
          queries: [Query.limit(100)],
          total: false,
        }),
      ]);
      if (
        stableJson(comparableTable(targetTable, columns.columns || [], indexes.indexes || [])) !==
        stableJson(expectedTable(schema))
      ) {
        throw new Error(
          `Table schema verification failed for ${database.id}/${schema.id}`
        );
      }

      const sourceRows = parseJsonLines(await readObject(table.rowsKey));
      for (const sourceRow of sourceRows) {
        const targetRow = await clients.tablesDB.getRow({
          databaseId: database.id,
          tableId: schema.id,
          rowId: sourceRow.id,
        });
        if (
          stableJson(serializeRowRecord(targetRow)) !==
          stableJson(sourceRow)
        ) {
          throw new Error(
            `Row verification failed for ${database.id}/${schema.id}/${sourceRow.id}`
          );
        }
        checkedRows += 1;
      }
    }
  }

  for (const bucket of manifest.storage || []) {
    const sourceBucket = JSON.parse(
      (await readObject(bucket.configKey)).toString('utf8')
    );
    const targetBucket = await clients.storage.getBucket({
      bucketId: sourceBucket.id,
    });
    if (
      stableJson(comparableBucket(targetBucket)) !==
      stableJson(expectedBucket(sourceBucket))
    ) {
      throw new Error(`Bucket verification failed for ${sourceBucket.id}`);
    }

    const sourceFiles = parseJsonLines(await readObject(bucket.filesKey));
    for (const sourceFile of sourceFiles) {
      const targetFile = await clients.storage.getFile({
        bucketId: sourceBucket.id,
        fileId: sourceFile.id,
      });
      const sourceMeta = {
        id: sourceFile.id,
        name: sourceFile.name,
        folder: sourceFile.folder || '',
        permissions: [...(sourceFile.permissions || [])].sort(),
      };
      const targetMeta = {
        id: targetFile.$id,
        name: targetFile.name,
        folder: targetFile.folder || '',
        permissions: [...(targetFile.$permissions || [])].sort(),
      };
      if (stableJson(sourceMeta) !== stableJson(targetMeta)) {
        throw new Error(
          `File metadata verification failed for ${sourceBucket.id}/${sourceFile.id}`
        );
      }
      const targetBytes = Buffer.from(
        await clients.storage.getFileDownload({
          bucketId: sourceBucket.id,
          fileId: sourceFile.id,
        })
      );
      if (sha256Hex(targetBytes) !== sourceFile.sha256) {
        throw new Error(
          `File verification failed for ${sourceBucket.id}/${sourceFile.id}`
        );
      }
      const sourceBytes = await readBlob(sourceFile);
      if (sha256Hex(sourceBytes) !== sourceFile.sha256) {
        throw new Error(
          `Source blob verification failed for ${sourceBucket.id}/${sourceFile.id}`
        );
      }
      checkedFiles += 1;
    }
  }

  return {
    users: users.length,
    rows: checkedRows,
    files: checkedFiles,
  };
}

export async function runRestoreCli({
  argv = process.argv.slice(2),
  env = process.env,
  log = console.log,
} = {}) {
  const args = parseArgs(argv);
  const config = readRestoreConfig(env);
  const r2 = createR2Client(config.r2);
  const snapshot = await loadCommittedSnapshot({
    r2,
    prefix: config.prefix,
    snapshotId: args.snapshot,
    encryptionKeys: config.encryptionKeys,
  });
  if (snapshot.manifest.source?.projectId === args.targetProject) {
    throw new Error('Refusing to restore a snapshot into its source project');
  }

  const clients = createTargetClients({
    endpoint: args.endpoint,
    projectId: args.targetProject,
    apiKey: config.targetApiKey,
  });

  if (!args.verifyOnly) {
    await assertSafeTarget({
      targetProjectId: args.targetProject,
      sourceProjectId: snapshot.manifest.source?.projectId,
      clients,
    });
    log(`Preflighting Mosaic DR snapshot ${args.snapshot}...`);
    await preflightSnapshot(snapshot);
    log(`Restoring Mosaic DR snapshot ${args.snapshot}...`);
    await restoreSnapshot({ snapshot, clients });
  }

  log(`Verifying Mosaic DR snapshot ${args.snapshot}...`);
  const verified = await verifySnapshot({ snapshot, clients });
  log(
    `DR verification passed: users=${verified.users} rows=${verified.rows} files=${verified.files}`
  );
  return verified;
}

const isDirectRun =
  process.argv[1] &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (isDirectRun) {
  runRestoreCli().catch((error) => {
    console.error(
      `DR restore failed: ${error instanceof Error ? error.message : 'unknown error'}`
    );
    process.exitCode = 1;
  });
}
