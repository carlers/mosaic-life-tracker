#!/usr/bin/env node
// Git-owned, scratch-only preparation. No production user/row copying.
// Requires the same explicit target and confirmation semantics as migrations.
import {
  assertConfirmedProject,
  createAppwriteAdminRequest,
  flagValue,
  hasFlag,
  inspectManagedBackend,
  parseBackendTarget,
  readBackendDefinitions,
} from './lib/appwrite-backend.mjs';
import { APPWRITE_MIGRATIONS, runAppwriteMigrations } from './appwrite-migrate.mjs';

export const SCRATCH_ID = '6a96e82d000d1310b3be';
export const SCRATCH_ENDPOINT = 'https://fra.cloud.appwrite.io/v1';

export function assertScratchPreviewTarget(argv, target) {
  if (flagValue(argv, '--project') !== SCRATCH_ID ||
      flagValue(argv, '--endpoint').replace(/\/+$/, '') !== SCRATCH_ENDPOINT ||
      target.projectId !== SCRATCH_ID || target.endpoint !== SCRATCH_ENDPOINT) {
    throw new Error('Preview preparation requires explicit --project and --endpoint for the disposable fra scratch project.');
  }
  if (hasFlag(argv, '--apply')) assertConfirmedProject(argv, target.projectId);
}

export function classifyScratchDrift(diffs) {
  // Only additive, already-reviewed migrations may be applied. Unknown drift
  // cannot be treated as permission to mutate a nonempty scratch project.
  const allowed = [
    /^table account_deletions: missing$/,
    /^table diary\.created_at: missing column$/,
    /^table messages\.idx_(sender|recipient)_id: missing index$/,
    /^table notifications: missing$/,
    /^table push_subscriptions: missing$/,
    /^table task_shares: missing$/,
    /^table notifications\.idx_notification_created: missing index$/,
    /^table push_subscriptions\.include_task_details: missing column$/,
  ];
  return diffs.filter(diff => !allowed.some(pattern => pattern.test(diff)));
}

export async function runPreviewPrepare({
  argv = process.argv.slice(2),
  env = process.env,
  fetchImpl = globalThis.fetch,
  readDefinitions = readBackendDefinitions,
  inspect = inspectManagedBackend,
  migrate = runAppwriteMigrations,
  log = console.log,
} = {}) {
  const target = parseBackendTarget(argv, env);
  assertScratchPreviewTarget(argv, target);
  const apply = hasFlag(argv, '--apply');
  const request = createAppwriteAdminRequest({ ...target, fetchImpl });
  const definitions = await readDefinitions();
  const inspectOptions = {
    request, definitions,
    messageFunctionId: flagValue(argv, '--message-function-id'),
    includeDr: false,
  };
  let report = await inspect(inspectOptions);
  if (apply && report.diffs.length) {
    const unsafe = classifyScratchDrift(report.diffs);
    if (unsafe.length) {
      throw new Error('Refusing scratch auto-reconciliation of unreviewed drift: ' + unsafe.join('; '));
    }
    const additions = APPWRITE_MIGRATIONS.filter(m =>
      ['001-account-deletion', '002-diary-created-at',
        '004-notifications', '005-notification-retention',
        '006-push-details', '007-task-shares'].includes(m.id));
    // The bucket-security migration remains a separate reviewed action;
    // it can remove a grant and is not a safe implicit Preview prerequisite.
    await migrate({ request, migrations: additions, log });
    report = await inspect(inspectOptions);
  }
  const expected = flagValue(argv, '--expected-deployment');
  if (expected && report.functionObservations.find(f => f.name === 'message-action')?.deploymentId !== expected) {
    report.diffs.push('message-action: active deployment does not match --expected-deployment');
  }
  log('Scratch Preview backend readiness (' + target.projectId + ')');
  for (const diff of report.diffs) log('  DRIFT ' + diff);
  if (!report.diffs.length) log('  READY: managed schema, indexes, Function structure and variables match Git.');
  if (report.legacyTables.length) log('  INFO legacy tables: ' + report.legacyTables.join(', '));
  log('  Note: auth policy, CORS Web platforms, actual client login, push delivery, and secret values require separate checks.');
  if (report.diffs.length) process.exitCode = 2;
  return report;
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  runPreviewPrepare().catch(error => {
    console.error('Scratch Preview preparation failed: ' + error.message);
    process.exitCode = 1;
  });
}
