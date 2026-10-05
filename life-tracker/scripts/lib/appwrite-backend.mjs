import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MOSAIC_BUCKET,
  MOSAIC_DATABASE,
  MOSAIC_TABLES,
} from '../../infrastructure/mosaic-backend.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const FUNCTION_ROOT = join(ROOT, 'appwrite-functions');
const APPWRITE_CONFIG_PATH = join(ROOT, 'appwrite.config.json');

export const MANAGED_FUNCTIONS = ['message-action', 'dr-backup'];

export function flagValue(argv, name) {
  const index = argv.indexOf(name);
  return index === -1 ? '' : argv[index + 1] || '';
}

export function hasFlag(argv, name) {
  return argv.includes(name);
}

export function normalizeEndpoint(value) {
  const raw = String(value || '').trim().replace(/\/+$/, '');
  if (!raw) return '';
  const url = new URL(raw);
  if (url.protocol !== 'https:' && url.hostname !== 'localhost') {
    throw new Error('Appwrite endpoint must use HTTPS unless it is localhost');
  }
  return raw.endsWith('/v1') ? raw : `${raw}/v1`;
}

export function parseBackendTarget(argv = [], env = process.env) {
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
  if (!apiKey) throw new Error('Missing APPWRITE_API_KEY.');

  return { endpoint, projectId, apiKey };
}

export function assertConfirmedProject(argv, projectId) {
  const confirmed = flagValue(argv, '--confirm-project');
  if (!confirmed) {
    throw new Error(
      'Mutating Appwrite commands require --confirm-project <projectId>.'
    );
  }
  if (confirmed !== projectId) {
    throw new Error(
      `Refusing Appwrite mutation: confirmed project ${confirmed} does not match target ${projectId}.`
    );
  }
}

export function createAppwriteAdminRequest({
  endpoint,
  projectId,
  apiKey,
  fetchImpl = globalThis.fetch,
}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('Appwrite backend tooling requires fetch.');
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

export async function readFunctionDefinition(name) {
  if (!MANAGED_FUNCTIONS.includes(name)) {
    throw new Error(`Unknown managed Function: ${name}`);
  }
  const directory = join(FUNCTION_ROOT, name);
  const config = JSON.parse(
    await readFile(join(directory, 'function.config.json'), 'utf8')
  );
  return { name, directory, config };
}

export async function readBackendDefinitions() {
  const [cliConfigText, ...functionDefinitions] = await Promise.all([
    readFile(APPWRITE_CONFIG_PATH, 'utf8'),
    ...MANAGED_FUNCTIONS.map(readFunctionDefinition),
  ]);
  return {
    cliConfig: JSON.parse(cliConfigText),
    functions: Object.fromEntries(
      functionDefinitions.map((item) => [item.name, item])
    ),
  };
}

function comparable(value) {
  return value === undefined || value === null ? null : value;
}

function sameArray(left, right) {
  return (
    Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function permissionsOf(actual) {
  return Array.isArray(actual?.$permissions)
    ? actual.$permissions
    : Array.isArray(actual?.permissions)
      ? actual.permissions
      : [];
}

function indexAttributes(actual) {
  return Array.isArray(actual?.attributes)
    ? actual.attributes
    : Array.isArray(actual?.columns)
      ? actual.columns
      : [];
}

function pushMismatch(diffs, label, actual, expected) {
  if (comparable(actual) !== comparable(expected)) {
    diffs.push(
      `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

export function diffTable(actual, expected) {
  const diffs = [];
  if (!actual) return [`table ${expected.id}: missing`];
  pushMismatch(
    diffs,
    `table ${expected.id} rowSecurity`,
    actual.rowSecurity,
    expected.rowSecurity
  );
  pushMismatch(
    diffs,
    `table ${expected.id} enabled`,
    actual.enabled,
    expected.enabled
  );
  if (!sameArray(permissionsOf(actual), expected.permissions)) {
    diffs.push(`table ${expected.id} permissions differ`);
  }

  const actualColumns = new Map(
    (actual.columns || []).map((column) => [column.key, column])
  );
  for (const column of expected.columns) {
    const current = actualColumns.get(column.key);
    if (!current) {
      diffs.push(`table ${expected.id}.${column.key}: missing column`);
      continue;
    }
    for (const key of ['type', 'required', 'size', 'default']) {
      if (Object.prototype.hasOwnProperty.call(column, key)) {
        pushMismatch(
          diffs,
          `table ${expected.id}.${column.key} ${key}`,
          current[key],
          column[key]
        );
      }
    }
    if (current.status === 'failed') {
      diffs.push(`table ${expected.id}.${column.key}: provisioning failed`);
    }
  }

  const actualIndexes = new Map(
    (actual.indexes || []).map((index) => [index.key, index])
  );
  for (const index of expected.indexes || []) {
    const current = actualIndexes.get(index.key);
    if (!current) {
      diffs.push(`table ${expected.id}.${index.key}: missing index`);
      continue;
    }
    pushMismatch(
      diffs,
      `table ${expected.id}.${index.key} type`,
      current.type,
      index.type
    );
    if (!sameArray(indexAttributes(current), index.attributes)) {
      diffs.push(`table ${expected.id}.${index.key} attributes differ`);
    }
  }
  return diffs;
}

export function diffBucket(actual, expected = MOSAIC_BUCKET) {
  const diffs = [];
  if (!actual) return [`bucket ${expected.id}: missing`];
  for (const key of [
    'fileSecurity',
    'enabled',
    'maximumFileSize',
    'compression',
    'encryption',
    'antivirus',
    'transformations',
  ]) {
    pushMismatch(
      diffs,
      `bucket ${expected.id} ${key}`,
      actual[key],
      expected[key]
    );
  }
  if (!sameArray(permissionsOf(actual), expected.permissions)) {
    diffs.push(`bucket ${expected.id} permissions differ`);
  }
  if (
    !sameArray(
      actual.allowedFileExtensions || [],
      expected.allowedFileExtensions
    )
  ) {
    diffs.push(`bucket ${expected.id} allowedFileExtensions differ`);
  }
  return diffs;
}

export function diffFunction(actual, expected, label = expected.name) {
  const diffs = [];
  if (!actual) return [`function ${label}: missing`];
  for (const key of [
    'name',
    'runtime',
    'timeout',
    'entrypoint',
    'commands',
    'deploymentRetention',
  ]) {
    pushMismatch(
      diffs,
      `function ${label} ${key}`,
      actual[key],
      expected[key]
    );
  }
  for (const key of ['execute', 'scopes']) {
    if (!sameArray(actual[key] || [], expected[key] || [])) {
      diffs.push(`function ${label} ${key} differ`);
    }
  }
  return diffs;
}

export function diffLocalFunctionConfig(cliConfig, definitions) {
  const diffs = [];
  const byName = new Map(
    (cliConfig.functions || []).map((item) => [item.name, item])
  );
  for (const name of MANAGED_FUNCTIONS) {
    const portable = definitions[name]?.config;
    const cli = byName.get(name);
    if (!portable || !cli) {
      diffs.push(`local Function config missing for ${name}`);
      continue;
    }
    for (const key of [
      '$id',
      'name',
      'runtime',
      'timeout',
      'entrypoint',
      'commands',
      'deploymentRetention',
    ]) {
      pushMismatch(
        diffs,
        `local ${name} ${key}`,
        cli[key],
        portable[key]
      );
    }
    for (const key of ['execute', 'scopes']) {
      if (!sameArray(cli[key] || [], portable[key] || [])) {
        diffs.push(`local ${name} ${key} differ`);
      }
    }
  }
  return diffs;
}

async function optionalGet(request, path) {
  try {
    return await request('GET', path);
  } catch (error) {
    if (Number(error?.status) === 404) return null;
    throw error;
  }
}

export async function inspectManagedBackend({
  request,
  definitions,
  messageFunctionId,
  drFunctionId,
  includeDr = true,
}) {
  const diffs = diffLocalFunctionConfig(
    definitions.cliConfig,
    definitions.functions
  );
  const database = await optionalGet(
    request,
    `/tablesdb/${MOSAIC_DATABASE.id}`
  );
  if (!database) {
    diffs.push(`database ${MOSAIC_DATABASE.id}: missing`);
  } else {
    pushMismatch(
      diffs,
      `database ${MOSAIC_DATABASE.id} name`,
      database.name,
      MOSAIC_DATABASE.name
    );
    pushMismatch(
      diffs,
      `database ${MOSAIC_DATABASE.id} enabled`,
      database.enabled,
      MOSAIC_DATABASE.enabled
    );
  }

  for (const table of MOSAIC_TABLES) {
    const actual = await optionalGet(
      request,
      `/tablesdb/${MOSAIC_DATABASE.id}/tables/${table.id}`
    );
    diffs.push(...diffTable(actual, table));
  }

  const bucket = await optionalGet(
    request,
    `/storage/buckets/${MOSAIC_BUCKET.id}`
  );
  diffs.push(...diffBucket(bucket));

  const functionObservations = [];
  const functionTargets = [
    [
      'message-action',
      messageFunctionId ||
        definitions.functions['message-action'].config.$id,
    ],
  ];
  if (includeDr) {
    functionTargets.push([
      'dr-backup',
      drFunctionId || definitions.functions['dr-backup'].config.$id,
    ]);
  }
  for (const [name, functionId] of functionTargets) {
    const actual = await optionalGet(request, `/functions/${functionId}`);
    diffs.push(
      ...diffFunction(actual, definitions.functions[name].config, name)
    );
    if (actual) {
      functionObservations.push({
        name,
        functionId,
        live: actual.live,
        deploymentId:
          actual.deploymentId || actual.deployment || '',
        latestDeploymentId: actual.latestDeploymentId || '',
        providerRepositoryId: actual.providerRepositoryId || '',
        providerBranch: actual.providerBranch || '',
        schedule: actual.schedule || '',
      });
    }
  }

  return { diffs, functionObservations };
}
