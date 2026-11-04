#!/usr/bin/env node
// Read-only Oracle application-DR configuration check (#975).
// Never deploy, execute a backup, access R2 or print Appwrite errors/values.
import { Client, Functions } from 'node-appwrite';

export const TARGETS = Object.freeze({
  scratch: Object.freeze({
    projectId: '6ae94a2100014d01f5ed',
    prefix: 'mosaic-oracle-scratch-dr/v1',
  }),
  production: Object.freeze({
    projectId: '6ae9599c002ab812f9c3',
    prefix: 'mosaic-oracle-dr/v1',
  }),
});
export const ORACLE_ENDPOINT = 'https://129-221-244-67.sslip.io/v1';
export const DR_FUNCTION_ID = 'dr_backup';
export const MESSAGE_FUNCTION_ID = '6aa8057f002a4c306fdd';
const REQUIRED_SCOPES = Object.freeze([
  'users.read', 'databases.read', 'tables.read', 'columns.read',
  'indexes.read', 'rows.read', 'buckets.read', 'files.read',
]);
const REQUIRED_SECRETS = Object.freeze([
  'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'DR_ENCRYPTION_KEY_B64',
]);
const REQUIRED_NON_SECRETS = Object.freeze(['R2_ACCOUNT_ID', 'R2_BUCKET', 'DR_PREFIX']);

export function parseOracleDrArgs(argv = [], env = process.env) {
  if (argv.length !== 2 || argv[0] !== '--profile' || !Object.hasOwn(TARGETS, argv[1])) {
    throw new Error('Select --profile scratch or production');
  }
  const profile = argv[1];
  const token = env.APPWRITE_API_KEY || '';
  if (!token) throw new Error('Missing read-only APPWRITE_API_KEY');
  return { profile, ...TARGETS[profile], endpoint: ORACLE_ENDPOINT, token };
}

function variableMap(values) {
  const variables = new Map();
  for (const value of values || []) {
    if (!value || typeof value.key !== 'string' || variables.has(value.key)) {
      throw new Error('Missing or duplicate variable key');
    }
    variables.set(value.key, value);
  }
  return variables;
}

function checkVariables(vars, profile) {
  const wanted = TARGETS[profile];
  for (const key of REQUIRED_SECRETS) {
    if (!vars.has(key) || vars.get(key).secret !== true) return 'INCOMPLETE';
  }
  for (const key of REQUIRED_NON_SECRETS) {
    if (!vars.has(key) || vars.get(key).secret === true) return 'INCOMPLETE';
  }
  if (vars.get('DR_PREFIX').value !== wanted.prefix) return 'WRONG_PREFIX';
  const manual = vars.get('DR_ALLOW_MANUAL_EXECUTION');
  if (manual && (manual.secret === true || manual.value !== 'false')) {
    return 'MANUAL_EXECUTION_ENABLED';
  }
  return 'CONFIGURED';
}

function checkFunction(fn) {
  if (fn?.$id !== DR_FUNCTION_ID || fn.runtime !== 'node-22' ||
      fn.enabled !== true || fn.timeout !== 900 ||
      !Array.isArray(fn.execute) || fn.execute.length !== 0 ||
      !Array.isArray(fn.scopes)) return 'INVALID';
  const scopes = new Set(fn.scopes);
  if (scopes.size !== fn.scopes.length ||
      fn.scopes.some(s => !REQUIRED_SCOPES.includes(s)) ||
      REQUIRED_SCOPES.some(s => !scopes.has(s))) return 'INVALID';
  return 'READ_ONLY';
}

export async function inspectOracleDr({ functions, profile }) {
  const report = {
    function: 'UNVERIFIED',
    variables: 'UNVERIFIED',
    schedule: 'UNVERIFIED',
    privacy: 'UNVERIFIED',
  };
  const dr = await functions.get({ functionId: DR_FUNCTION_ID });
  report.function = checkFunction(dr);
  report.schedule = typeof dr.schedule === 'string'
    ? (dr.schedule ? 'ENABLED' : 'DISABLED') : 'UNVERIFIED';
  const vars = variableMap(
    (await functions.listVariables({ functionId: DR_FUNCTION_ID })).variables,
  );
  report.variables = checkVariables(vars, profile);
  const msgVars = variableMap(
    (await functions.listVariables({ functionId: MESSAGE_FUNCTION_ID })).variables,
  );
  report.privacy =
    msgVars.get('DR_PRIVACY_DELETION_REQUIRED')?.value === 'true' &&
    msgVars.get('DR_BACKUP_FUNCTION_ID')?.value === DR_FUNCTION_ID
      ? 'GUARDED' : 'NOT_VERIFIED';
  return report;
}

export function formatOracleDrReport(report) {
  const allowed = {
    function: ['UNVERIFIED', 'INVALID', 'READ_ONLY'],
    variables: ['UNVERIFIED', 'INCOMPLETE', 'WRONG_PREFIX', 'MANUAL_EXECUTION_ENABLED', 'CONFIGURED'],
    schedule: ['UNVERIFIED', 'ENABLED', 'DISABLED'],
    privacy: ['UNVERIFIED', 'NOT_VERIFIED', 'GUARDED'],
  };
  for (const [key, values] of Object.entries(allowed)) {
    if (!values.includes(report[key])) throw new Error('Unsafe result');
  }
  return [
    'MOSAIC_ORACLE_APP_DR_PREFLIGHT=CONFIG_REVIEWED',
    'MOSAIC_ORACLE_APP_DR_FUNCTION=' + report.function,
    'MOSAIC_ORACLE_APP_DR_VARIABLES=' + report.variables,
    'MOSAIC_ORACLE_APP_DR_SCHEDULE=' + report.schedule,
    'MOSAIC_ORACLE_APP_DR_PRIVACY_MARKERS=' + report.privacy,
    'MOSAIC_ORACLE_APP_DR_RECOVERY=NOT_VERIFIED',
    'MOSAIC_ORACLE_APP_DR_DR_READINESS=BLOCKED',
  ].join('\n');
}

export async function runOracleDrPreflight({
  argv = process.argv.slice(2),
  env = process.env,
  functions,
  log = console.log,
} = {}) {
  try {
    const config = parseOracleDrArgs(argv, env);
    const sdk = functions || new Functions(
      new Client()
        .setEndpoint(config.endpoint)
        .setProject(config.projectId)
        .setKey(config.token),
    );
    const report = await inspectOracleDr({ functions: sdk, profile: config.profile });
    log(formatOracleDrReport(report));
  } catch {
    // Never forward SDK diagnostics, credentials, function values, or URLs.
    log('MOSAIC_ORACLE_APP_DR_PREFLIGHT=BLOCKED');
  }
  return 2; // A read-only configuration check is never a successful restore.
}

const direct = process.argv[1] &&
  import.meta.url === new URL('file://' + process.argv[1]).href;
if (direct) runOracleDrPreflight().then((code) => { process.exitCode = code; });
