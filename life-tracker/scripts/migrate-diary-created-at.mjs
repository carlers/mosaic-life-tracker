#!/usr/bin/env node
import { MOSAIC_DATABASE, MOSAIC_TABLES } from '../infrastructure/mosaic-backend.mjs';

const DIARY = MOSAIC_TABLES.find((table) => table.id === 'diary');
const CREATED_AT = DIARY?.columns.find((column) => column.key === 'created_at');

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

export function parseDiaryCreatedAtMigrationArgs(
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
  if (!DIARY || !CREATED_AT) {
    throw new Error('Portable Mosaic diary manifest is incomplete.');
  }

  return {
    endpoint,
    projectId,
    apiKey,
    databaseId: MOSAIC_DATABASE.id,
  };
}

export function createAppwriteAdminFetch({
  endpoint,
  projectId,
  apiKey,
  fetchImpl = globalThis.fetch,
}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('Diary schema migration requires fetch.');
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

function comparable(value) {
  return value === undefined || value === null ? null : value;
}

export function assertCompatibleDiaryCreatedAtColumn(actual) {
  if (!CREATED_AT) {
    throw new Error('Portable Mosaic diary manifest is incomplete.');
  }

  for (const key of ['key', 'type', 'size', 'required', 'default']) {
    if (comparable(actual?.[key]) !== comparable(CREATED_AT[key])) {
      throw new Error(
        `Existing diary.created_at column is incompatible (${key}).`
      );
    }
  }

  if (actual?.status === 'failed') {
    throw new Error(
      `Existing diary.created_at column failed provisioning: ${actual?.error || 'unknown error'}`
    );
  }

  return true;
}

async function waitForColumnAvailable(
  request,
  columnPath,
  {
    attempts = 60,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  } = {}
) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const current = await request('GET', columnPath);
    assertCompatibleDiaryCreatedAtColumn(current);
    if (!current.status || current.status === 'available') return current;
    await sleep(500);
  }
  throw new Error('diary.created_at did not become available in time.');
}

export async function migrateDiaryCreatedAtBackend({
  request,
  databaseId = MOSAIC_DATABASE.id,
  log = () => {},
  sleep,
}) {
  if (!DIARY || !CREATED_AT) {
    throw new Error('Portable Mosaic diary manifest is incomplete.');
  }

  const tablePath = `/tablesdb/${databaseId}/tables/${DIARY.id}`;
  const table = await getOptional(request, tablePath);
  if (!table) {
    throw new Error(
      'Diary table is missing. Bootstrap the Mosaic backend before running this migration.'
    );
  }

  const columnPath = `${tablePath}/columns/${CREATED_AT.key}`;
  const existing = await getOptional(request, columnPath);

  if (!existing) {
    log('Creating diary.created_at column...');
    await request('POST', `${tablePath}/columns/varchar`, {
      key: CREATED_AT.key,
      size: CREATED_AT.size,
      required: CREATED_AT.required,
      default: CREATED_AT.default,
      array: false,
      encrypt: false,
    });
  } else {
    assertCompatibleDiaryCreatedAtColumn(existing);
    if (!existing.status || existing.status === 'available') {
      return { tableId: DIARY.id, column: CREATED_AT.key, created: false };
    }
  }

  await waitForColumnAvailable(request, columnPath, { sleep });
  return { tableId: DIARY.id, column: CREATED_AT.key, created: !existing };
}

export async function runDiaryCreatedAtMigrationCli({
  argv = process.argv.slice(2),
  env = process.env,
  fetchImpl = globalThis.fetch,
  log = console.log,
} = {}) {
  const config = parseDiaryCreatedAtMigrationArgs(argv, env);
  const request = createAppwriteAdminFetch({ ...config, fetchImpl });
  log(`Migrating diary.created_at in ${config.projectId}...`);
  const result = await migrateDiaryCreatedAtBackend({
    request,
    databaseId: config.databaseId,
    log: (message) => log(`  ${message}`),
  });
  log('Diary created_at schema is ready.');
  return result;
}

const isDirectRun =
  process.argv[1] &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (isDirectRun) {
  runDiaryCreatedAtMigrationCli().catch((cause) => {
    console.error(
      `Diary schema migration failed: ${
        cause instanceof Error ? cause.message : 'unknown error'
      }`
    );
    process.exitCode = 1;
  });
}
