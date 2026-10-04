#!/usr/bin/env node
import { MOSAIC_DATABASE, MOSAIC_TABLES } from '../infrastructure/mosaic-backend.mjs';

const ACCOUNT_DELETIONS = MOSAIC_TABLES.find(
  (table) => table.id === 'account_deletions'
);
const MESSAGES = MOSAIC_TABLES.find((table) => table.id === 'messages');
const REQUIRED_MESSAGE_INDEXES = new Set([
  'idx_sender_id',
  'idx_recipient_id',
]);

function flagValue(argv, name) {
  const index = argv.indexOf(name);
  if (index === -1) return '';
  return argv[index + 1] || '';
}

function normalizeEndpoint(value) {
  const raw = String(value || '').trim().replace(/\/+$/, '');
  if (!raw) return '';
  const url = new URL(raw);
  if (url.protocol !== 'https:' && url.hostname !== 'localhost') {
    throw new Error('Appwrite endpoint must use HTTPS unless it is localhost');
  }
  return raw.endsWith('/v1') ? raw : `${raw}/v1`;
}

export function parseAccountDeletionMigrationArgs(
  argv = [],
  env = process.env
) {
  const endpoint = normalizeEndpoint(
    flagValue(argv, '--endpoint') || env.APPWRITE_ENDPOINT || ''
  );
  const projectId =
    flagValue(argv, '--project') || env.APPWRITE_PROJECT_ID || '';
  const apiKey = env.APPWRITE_API_KEY || '';

  if (!endpoint) {
    throw new Error(
      'Missing Appwrite endpoint. Pass --endpoint <url> or set APPWRITE_ENDPOINT.'
    );
  }
  if (!projectId) {
    throw new Error(
      'Missing Appwrite project. Pass --project <id> or set APPWRITE_PROJECT_ID.'
    );
  }
  if (!apiKey) {
    throw new Error('Missing APPWRITE_API_KEY.');
  }
  if (!ACCOUNT_DELETIONS || !MESSAGES) {
    throw new Error('Portable Mosaic backend manifest is incomplete.');
  }

  return {
    endpoint,
    projectId,
    apiKey,
    databaseId: MOSAIC_DATABASE.id,
  };
}

function sameArray(left, right) {
  return (
    Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function normalizeIndexAttributes(index) {
  return Array.isArray(index.attributes)
    ? index.attributes
    : Array.isArray(index.columns)
      ? index.columns
      : [];
}

export function assertCompatibleIndex(actual, expected, label) {
  if (
    actual?.key !== expected.key ||
    actual?.type !== expected.type ||
    !sameArray(normalizeIndexAttributes(actual), expected.attributes)
  ) {
    throw new Error(
      `Existing ${label} index ${expected.key} does not match the Mosaic manifest.`
    );
  }
}

export function assertCompatibleDeletionTable(actual) {
  if (
    actual?.$id !== ACCOUNT_DELETIONS.id ||
    actual?.rowSecurity !== ACCOUNT_DELETIONS.rowSecurity
  ) {
    throw new Error(
      'Existing account_deletions table does not match the Mosaic manifest.'
    );
  }

  const columns = new Map(
    (actual.columns || []).map((column) => [column.key, column])
  );
  for (const expected of ACCOUNT_DELETIONS.columns) {
    const current = columns.get(expected.key);
    if (
      !current ||
      current.type !== expected.type ||
      Boolean(current.required) !== Boolean(expected.required)
    ) {
      throw new Error(
        `Existing account_deletions column ${expected.key} is incompatible.`
      );
    }
  }
}

export function createAppwriteAdminFetch({
  endpoint,
  projectId,
  apiKey,
  fetchImpl = globalThis.fetch,
}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('Account deletion migration requires fetch.');
  }

  return async function request(method, path, body) {
    const response = await fetchImpl(`${endpoint}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Appwrite-Project': projectId,
        'X-Appwrite-Key': apiKey,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const error = new Error(
        payload?.message ||
          `Appwrite ${method} ${path} failed with HTTP ${response.status}`
      );
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload;
  };
}

function isNotFound(error) {
  return Number(error?.status) === 404;
}

async function getOptional(request, path) {
  try {
    return await request('GET', path);
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

export async function migrateAccountDeletionBackend({
  request,
  databaseId = MOSAIC_DATABASE.id,
  log = () => {},
}) {
  if (!ACCOUNT_DELETIONS || !MESSAGES) {
    throw new Error('Portable Mosaic backend manifest is incomplete.');
  }

  const tablesPath = `/tablesdb/${databaseId}/tables`;
  const deletionTablePath = `${tablesPath}/${ACCOUNT_DELETIONS.id}`;
  const existingTable = await getOptional(request, deletionTablePath);

  if (!existingTable) {
    log('Creating account_deletions table...');
    await request('POST', tablesPath, {
      tableId: ACCOUNT_DELETIONS.id,
      name: ACCOUNT_DELETIONS.name,
      permissions: ACCOUNT_DELETIONS.permissions,
      rowSecurity: ACCOUNT_DELETIONS.rowSecurity,
      enabled: ACCOUNT_DELETIONS.enabled,
      columns: ACCOUNT_DELETIONS.columns,
      indexes: ACCOUNT_DELETIONS.indexes,
    });
  } else {
    assertCompatibleDeletionTable(existingTable);
    for (const expected of ACCOUNT_DELETIONS.indexes) {
      const indexPath = `${deletionTablePath}/indexes/${expected.key}`;
      const current = await getOptional(request, indexPath);
      if (!current) {
        log(`Creating account_deletions index ${expected.key}...`);
        await request('POST', `${deletionTablePath}/indexes`, expected);
      } else {
        assertCompatibleIndex(
          current,
          expected,
          'account_deletions'
        );
      }
    }
  }

  const messageTablePath = `${tablesPath}/${MESSAGES.id}`;
  for (const expected of MESSAGES.indexes.filter((index) =>
    REQUIRED_MESSAGE_INDEXES.has(index.key)
  )) {
    const indexPath = `${messageTablePath}/indexes/${expected.key}`;
    const current = await getOptional(request, indexPath);
    if (!current) {
      log(`Creating messages index ${expected.key}...`);
      await request('POST', `${messageTablePath}/indexes`, expected);
    } else {
      assertCompatibleIndex(current, expected, 'messages');
    }
  }

  return {
    tableId: ACCOUNT_DELETIONS.id,
    messageIndexes: [...REQUIRED_MESSAGE_INDEXES],
  };
}

export async function runAccountDeletionMigrationCli({
  argv = process.argv.slice(2),
  env = process.env,
  fetchImpl = globalThis.fetch,
  log = console.log,
} = {}) {
  const config = parseAccountDeletionMigrationArgs(argv, env);
  const request = createAppwriteAdminFetch({ ...config, fetchImpl });
  log(`Migrating account deletion support in ${config.projectId}...`);
  const result = await migrateAccountDeletionBackend({
    request,
    databaseId: config.databaseId,
    log: (message) => log(`  ${message}`),
  });
  log('Account deletion backend schema is ready.');
  return result;
}

const isDirectRun =
  process.argv[1] &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (isDirectRun) {
  runAccountDeletionMigrationCli().catch((cause) => {
    console.error(
      `Account deletion migration failed: ${
        cause instanceof Error ? cause.message : 'unknown error'
      }`
    );
    process.exitCode = 1;
  });
}
