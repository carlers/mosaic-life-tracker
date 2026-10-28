#!/usr/bin/env node
// One-time, synthetic-only Oracle recovery after the 14-table bootstrap stopped
// at the unsupported Function runtime. Never use for Production or user data.
import { fileURLToPath } from 'node:url';
import {
  createAppwriteAdminRequest,
  inspectManagedBackend,
  readBackendDefinitions,
  assertConfirmedProject,
  parseBackendTarget,
} from './lib/appwrite-backend.mjs';
import {
  createBootstrapServices,
  ensureWebPlatforms,
  inspectTarget,
  provisionFunction,
} from './lib/mosaic-bootstrap.mjs';

export const ORACLE_TEST_ID = '6ae1bf2e00034572451b';
export const ORIGINAL_MESSAGE_ID = '6aa8057f002a4c306fdd';
export const ORACLE_ENDPOINT = 'http://localhost/v1';
const MESSAGE_DIR = fileURLToPath(new URL('../appwrite-functions/message-action/', import.meta.url));

export function assertOracleFunctionRepairTarget(argv, target) {
  if (target.projectId !== ORACLE_TEST_ID || target.endpoint !== ORACLE_ENDPOINT) {
    throw new Error('Oracle Function-only recovery refuses non-isolated project or endpoint.');
  }
  assertConfirmedProject(argv, target.projectId);
}

function matchesPartiallyBootstrappedProject(state) {
  return state.databases.count === 1 &&
    state.databases.ids[0] === 'life_tracker' &&
    state.buckets.count === 1 &&
    state.buckets.ids[0] === 'task_images' &&
    state.users.count === 0 &&
    state.functions.count === 0;
}

/**
 * A strictly one-shot step after schema creation. Refuses nonempty/foreign state
 * and any managed drift beyond the single expected missing original Function.
 * The existing Git-owned provisioning code handles Function creation and build.
 */
export async function recoverOracleMessageFunction({
  target,
  services = createBootstrapServices(target),
  inspect = inspectManagedBackend,
  definitionsFactory = readBackendDefinitions,
  deploy = provisionFunction,
  ensureWeb = ensureWebPlatforms,
  requestFactory = createAppwriteAdminRequest,
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  log = () => {},
}) {
  if (target.projectId !== ORACLE_TEST_ID || target.endpoint !== ORACLE_ENDPOINT) {
    throw new Error('Oracle recovery target mismatch.');
  }
  const state = await inspectTarget(services);
  if (!matchesPartiallyBootstrappedProject(state)) {
    throw new Error('Refusing Function recovery: only original Git-owned database, bucket, and zero users/Functions are permitted.');
  }
  const definitions = await definitionsFactory();
  const canonical = definitions.functions?.['message-action']?.config;
  if (canonical?.$id !== ORIGINAL_MESSAGE_ID || canonical?.runtime !== 'node-18.0') {
    throw new Error('Refusing Function recovery: canonical Function ID/runtime differs from reviewed source.');
  }
  const request = requestFactory(target);
  const opts = {
    request, definitions, messageFunctionId: ORIGINAL_MESSAGE_ID, includeDr: false,
  };
  const before = await inspect(opts);
  if (before.diffs?.length !== 1 ||
      before.diffs[0] !== 'function message-action: missing') {
    throw new Error('Refusing Function recovery: schema/bucket state differs from Git or Function already exists.');
  }
  log('MOSAIC_ORACLE_FUNCTION_ONLY_PREFLIGHT_PASS');
  await deploy({
    functions: services.functions,
    directory: MESSAGE_DIR,
    functionId: ORIGINAL_MESSAGE_ID,
    extraVariables: {
      APPWRITE_DATABASE_ID: 'life_tracker',
      APPWRITE_STORAGE_BUCKET_ID: 'task_images',
      APPWRITE_TABLE_ACCOUNT_DELETIONS: 'account_deletions',
      DR_BACKUP_FUNCTION_ID: 'dr_backup',
      DR_PRIVACY_DELETION_REQUIRED: 'false',
    },
    functionOverrides: { schedule: '' },
    log: () => {}, // Do not forward build logs or private operational metadata.
  });
  log('MOSAIC_ORACLE_ORIGINAL_FUNCTION_DEPLOYED');
  await ensureWeb(services.project, ['localhost']);
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const after = await inspect(opts);
    if (after.diffs?.length === 0) {
      log('MOSAIC_ORACLE_FUNCTION_ONLY_DRIFT_PASS');
      return { functionId: ORIGINAL_MESSAGE_ID, drift: 0 };
    }
    if (attempt < 11) await wait(5000);
  }
  throw new Error('Function created, but Git-owned drift verification did not converge. Do not rerun automatically.');
}

export async function runOracleMessageFunctionRepair({
  argv = process.argv.slice(2),
  env = process.env,
  log = console.log,
} = {}) {
  const target = parseBackendTarget(argv, env);
  assertOracleFunctionRepairTarget(argv, target);
  return recoverOracleMessageFunction({ target, log });
}

if (process.argv[1] &&
    import.meta.url === new URL('file://' + process.argv[1]).href) {
  runOracleMessageFunctionRepair().catch(() => {
    // No raw Appwrite exceptions/build logs/response payloads in Actions output.
    console.error('MOSAIC_ORACLE_FUNCTION_ONLY_RECOVERY_FAILED: inspect the private test project; do not rerun blindly.');
    process.exitCode = 1;
  });
}
