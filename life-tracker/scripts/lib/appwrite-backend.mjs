import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MOSAIC_BUCKET,
  MOSAIC_DATABASE,
  MOSAIC_LEGACY_TABLE_IDS,
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

function sameStringSet(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  return sameArray(
    [...left].map(String).sort(),
    [...right].map(String).sort()
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
  pushMismatch(diffs, `table ${expected.id} name`, actual.name, expected.name);
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
  if (!sameStringSet(permissionsOf(actual), expected.permissions)) {
    diffs.push(`table ${expected.id} permissions differ`);
  }

  const actualColumns = new Map(
    (actual.columns || []).map((column) => [column.key, column])
  );
  const expectedColumnKeys = new Set(expected.columns.map((column) => column.key));
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
  for (const key of actualColumns.keys()) {
    if (!expectedColumnKeys.has(key)) {
      diffs.push(`table ${expected.id}.${key}: unexpected column`);
    }
  }

  const actualIndexes = new Map(
    (actual.indexes || []).map((index) => [index.key, index])
  );
  const expectedIndexKeys = new Set(
    (expected.indexes || []).map((index) => index.key)
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
    if (current.status === 'failed') {
      diffs.push(`table ${expected.id}.${index.key}: provisioning failed`);
    }
  }
  for (const key of actualIndexes.keys()) {
    if (!expectedIndexKeys.has(key)) {
      diffs.push(`table ${expected.id}.${key}: unexpected index`);
    }
  }
  return diffs;
}

export function diffBucket(actual, expected = MOSAIC_BUCKET) {
  const diffs = [];
  if (!actual) return [`bucket ${expected.id}: missing`];
  for (const key of [
    'name',
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
  if (!sameStringSet(permissionsOf(actual), expected.permissions)) {
    diffs.push(`bucket ${expected.id} permissions differ`);
  }
  if (
    !sameStringSet(
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
    'enabled',
    'logging',
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
    if (!sameStringSet(actual[key] || [], expected[key] || [])) {
      diffs.push(`function ${label} ${key} differ`);
    }
  }
  return diffs;
}

function variableMap(actual) {
  return new Map(
    (Array.isArray(actual?.vars) ? actual.vars : [])
      .filter((item) => item?.key)
      .map((item) => [item.key, item])
  );
}

export function diffFunctionVariables(
  actual,
  expected,
  { nonSecretOverrides = {} } = {}
) {
  const diffs = [];
  if (!actual) return diffs;
  const variables = variableMap(actual);
  const expectedNonSecret = {
    ...(expected.nonSecretVariables || {}),
    ...nonSecretOverrides,
  };
  const requiredNonSecret = expected.requiredNonSecretVariables || [];
  const requiredSecret = expected.requiredSecretVariables || [];
  const optionalNonSecret = expected.optionalNonSecretVariables || [];
  const optionalSecret = expected.optionalSecretVariables || [];
  const declared = new Set([
    ...Object.keys(expectedNonSecret),
    ...requiredNonSecret,
    ...requiredSecret,
    ...optionalNonSecret,
    ...optionalSecret,
  ]);

  for (const [key, value] of Object.entries(expectedNonSecret)) {
    const current = variables.get(key);
    if (!current) {
      diffs.push(`function ${expected.name} variable ${key}: missing`);
      continue;
    }
    if (current.secret === true) {
      diffs.push(
        `function ${expected.name} variable ${key}: expected non-secret`
      );
      continue;
    }
    if (String(current.value ?? '') !== String(value)) {
      diffs.push(
        `function ${expected.name} variable ${key}: expected ${JSON.stringify(
          String(value)
        )}, got ${JSON.stringify(String(current.value ?? ''))}`
      );
    }
  }

  for (const key of requiredNonSecret) {
    const current = variables.get(key);
    if (!current) {
      diffs.push(`function ${expected.name} variable ${key}: missing`);
    } else if (current.secret === true) {
      diffs.push(
        `function ${expected.name} variable ${key}: expected non-secret`
      );
    } else if (!String(current.value ?? '').trim()) {
      diffs.push(
        `function ${expected.name} variable ${key}: expected non-empty value`
      );
    }
  }

  for (const key of requiredSecret) {
    const current = variables.get(key);
    if (!current) {
      diffs.push(`function ${expected.name} variable ${key}: missing`);
    } else if (current.secret !== true) {
      diffs.push(
        `function ${expected.name} variable ${key}: expected secret`
      );
    }
  }

  for (const key of optionalNonSecret) {
    const current = variables.get(key);
    if (current?.secret === true) {
      diffs.push(
        `function ${expected.name} variable ${key}: expected non-secret`
      );
    }
  }
  for (const key of optionalSecret) {
    const current = variables.get(key);
    if (current && current.secret !== true) {
      diffs.push(
        `function ${expected.name} variable ${key}: expected secret`
      );
    }
  }

  for (const key of variables.keys()) {
    if (!declared.has(key)) {
      diffs.push(`function ${expected.name} variable ${key}: unexpected`);
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
      'enabled',
      'logging',
      'runtime',
      'schedule',
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
      if (!sameStringSet(cli[key] || [], portable[key] || [])) {
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

export function diffTableInventory(listed) {
  const diffs = [];
  const tables = Array.isArray(listed?.tables) ? listed.tables : [];
  const total = Number(listed?.total ?? tables.length);
  if (Number.isFinite(total) && total > tables.length) {
    diffs.push(
      `table inventory incomplete: Appwrite reports ${total}, response included ${tables.length}`
    );
  }

  const managed = new Set(MOSAIC_TABLES.map((table) => table.id));
  const legacy = new Set(MOSAIC_LEGACY_TABLE_IDS);
  const legacyTables = [];
  for (const table of tables) {
    const id = table?.$id;
    if (!id || managed.has(id)) continue;
    if (legacy.has(id)) {
      legacyTables.push(id);
    } else {
      diffs.push(`table ${id}: unexpected unmanaged table`);
    }
  }
  return { diffs, legacyTables: legacyTables.sort() };
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
  let legacyTables = [];
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
    const inventory = await request(
      'GET',
      `/tablesdb/${MOSAIC_DATABASE.id}/tables`
    );
    const inventoryDiff = diffTableInventory(inventory);
    diffs.push(...inventoryDiff.diffs);
    legacyTables = inventoryDiff.legacyTables;
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

  const resolvedDrFunctionId =
    drFunctionId || definitions.functions['dr-backup'].config.$id;
  const functionObservations = [];
  const functionTargets = [
    [
      'message-action',
      messageFunctionId ||
        definitions.functions['message-action'].config.$id,
    ],
  ];
  if (includeDr) {
    functionTargets.push(['dr-backup', resolvedDrFunctionId]);
  }
  for (const [name, functionId] of functionTargets) {
    const actual = await optionalGet(request, `/functions/${functionId}`);
    const expected = definitions.functions[name].config;
    diffs.push(...diffFunction(actual, expected, name));
    if (actual) {
      const nonSecretOverrides =
        name === 'message-action'
          ? {
              DR_BACKUP_FUNCTION_ID: resolvedDrFunctionId,
              DR_PRIVACY_DELETION_REQUIRED: includeDr ? 'true' : 'false',
            }
          : {};
      diffs.push(
        ...diffFunctionVariables(actual, expected, {
          nonSecretOverrides,
        })
      );
      if (actual.live !== true) {
        diffs.push(`function ${name} has no live deployment`);
      }
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

  return { diffs, functionObservations, legacyTables };
}
