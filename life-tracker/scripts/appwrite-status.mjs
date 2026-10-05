#!/usr/bin/env node
import {
  createAppwriteAdminRequest,
  flagValue,
  hasFlag,
  inspectManagedBackend,
  parseBackendTarget,
  readBackendDefinitions,
} from './lib/appwrite-backend.mjs';

export async function runAppwriteStatusCli({
  argv = process.argv.slice(2),
  env = process.env,
  fetchImpl = globalThis.fetch,
  log = console.log,
} = {}) {
  const target = parseBackendTarget(argv, env);
  const definitions = await readBackendDefinitions();
  const request = createAppwriteAdminRequest({ ...target, fetchImpl });
  const result = await inspectManagedBackend({
    request,
    definitions,
    messageFunctionId: flagValue(argv, '--message-function-id'),
    drFunctionId: flagValue(argv, '--dr-function-id'),
    includeDr: !hasFlag(argv, '--without-dr'),
  });

  log(`Appwrite managed-state check: ${target.projectId}`);
  if (result.diffs.length) {
    for (const diff of result.diffs) log(`  DRIFT ${diff}`);
  } else {
    log(
      '  OK managed database, tables, bucket, and Function structure match Git.'
    );
  }
  for (const item of result.functionObservations) {
    log(
      `  ${item.name}: active=${item.deploymentId || 'none'} latest=${
        item.latestDeploymentId || 'unknown'
      } live=${String(item.live)} schedule=${
        item.schedule || 'disabled'
      } vcs=${
        item.providerRepositoryId
          ? `${item.providerRepositoryId}:${item.providerBranch || '?'}`
          : 'unconnected'
      }`
    );
  }
  log(
    '  Note: schedules, secrets/variables, VCS linkage, and environment-specific Function IDs are operational state and are reported but not drift-enforced.'
  );

  if (result.diffs.length) process.exitCode = 2;
  return result;
}

const isDirectRun =
  process.argv[1] &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (isDirectRun) {
  runAppwriteStatusCli().catch((cause) => {
    console.error(
      `Appwrite status failed: ${
        cause instanceof Error ? cause.message : 'unknown error'
      }`
    );
    process.exitCode = 1;
  });
}
