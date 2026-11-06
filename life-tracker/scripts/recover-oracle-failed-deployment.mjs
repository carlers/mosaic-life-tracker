#!/usr/bin/env node
// Only for the disposable Oracle test project after its first failed build.
// Reuses the Git-owned Function packager. Never creates or activates a Function.
import { fileURLToPath } from 'node:url';
import {
  assertConfirmedProject,
  createAppwriteAdminRequest,
  flagValue,
  inspectManagedBackend,
  parseBackendTarget,
  readBackendDefinitions,
} from './lib/appwrite-backend.mjs';
import { createBootstrapServices, inspectTarget } from './lib/mosaic-bootstrap.mjs';
import { deployFunctionVersion } from './appwrite-function.mjs';

export const ORACLE_TEST_PROJECT_ID = '6ae1bf2e00034572451b';
export const ORIGINAL_MESSAGE_FUNCTION_ID = '6aa8057f002a4c306fdd';
export const ORACLE_TEST_ENDPOINT = 'http://localhost/v1';
export const EXPECTED_MISSING_LIVE_DRIFT =
  'function message-action has no live deployment';

export function assertOracleDeploymentTarget(target, argv = []) {
  if (target.projectId !== ORACLE_TEST_PROJECT_ID ||
      target.endpoint !== ORACLE_TEST_ENDPOINT) {
    throw new Error('Oracle deployment-only recovery refuses this project or endpoint.');
  }
  assertConfirmedProject(argv, target.projectId);
}

export async function buildOracleMessageDeploymentOnly({
  target,
  gitSha,
  services = createBootstrapServices(target),
  definitionsFactory = readBackendDefinitions,
  requestFactory = createAppwriteAdminRequest,
  inspect = inspectManagedBackend,
  deploy = deployFunctionVersion,
  log = () => {},
}) {
  if (!target || target.projectId !== ORACLE_TEST_PROJECT_ID ||
      target.endpoint !== ORACLE_TEST_ENDPOINT ||
      !/^[0-9a-f]{40}$/i.test(gitSha || '')) {
    throw new Error('Oracle deployment-only target or pinned source is invalid.');
  }
  const state = await inspectTarget(services);
  if (state.databases.count !== 1 || state.databases.ids[0] !== 'life_tracker' ||
      state.buckets.count !== 1 || state.buckets.ids[0] !== 'task_images' ||
      state.functions.count !== 1 ||
      state.functions.ids[0] !== ORIGINAL_MESSAGE_FUNCTION_ID ||
      state.users.count !== 0) {
    throw new Error('Refusing deployment-only recovery: unexpected project resources.');
  }

  const definitions = await definitionsFactory();
  const definition = definitions.functions?.['message-action'];
  if (definition?.config?.$id !== ORIGINAL_MESSAGE_FUNCTION_ID ||
      definition?.config?.runtime !== 'node-18.0' ||
      definition?.name !== 'message-action') {
    throw new Error('Refusing deployment-only recovery: canonical Function mismatch.');
  }
  const request = requestFactory(target);
  const drift = await inspect({
    request, definitions, messageFunctionId: ORIGINAL_MESSAGE_FUNCTION_ID,
    includeDr: false,
  });
  if (!Array.isArray(drift?.diffs) || drift.diffs.length !== 1 ||
      drift.diffs[0] !== EXPECTED_MISSING_LIVE_DRIFT) {
    throw new Error('Refusing deployment-only recovery: Git-owned schema or Function drift.');
  }

  const current = await services.functions.get({ functionId: ORIGINAL_MESSAGE_FUNCTION_ID });
  if (current?.$id !== ORIGINAL_MESSAGE_FUNCTION_ID ||
      current.live !== false || current.schedule ||
      current.deploymentId || current.deployment) {
    throw new Error('Refusing deployment-only recovery: Function already live or unexpected state.');
  }
  const deploymentPath = `/functions/${ORIGINAL_MESSAGE_FUNCTION_ID}/deployments?limit=100`;
  const deployments = await request('GET', deploymentPath);
  if (deployments?.total !== 1 ||
      !Array.isArray(deployments.deployments) ||
      deployments.deployments.length !== 1 ||
      deployments.deployments[0]?.status !== 'failed') {
    throw new Error('Refusing deployment-only recovery: expected exactly one failed build.');
  }

  log('MOSAIC_ORACLE_DEPLOYMENT_ONLY_PREFLIGHT_PASS');
  // Exactly one build request; no Function create, config reconciliation, or
  // activation. If the build fails or times out, do not blindly retry it.
  const built = await deploy({
    functions: services.functions,
    definition,
    functionId: ORIGINAL_MESSAGE_FUNCTION_ID,
    gitSha,
  });
  if (!built || built.status !== 'ready' || !built.deploymentId) {
    throw new Error('Inactive deployment did not become ready.');
  }
  const [ready, updated, after] = await Promise.all([
    services.functions.getDeployment({
      functionId: ORIGINAL_MESSAGE_FUNCTION_ID, deploymentId: built.deploymentId,
    }),
    services.functions.get({ functionId: ORIGINAL_MESSAGE_FUNCTION_ID }),
    request('GET', deploymentPath),
  ]);
  if (ready?.status !== 'ready' ||
      updated?.live !== false || updated?.deploymentId || updated?.deployment ||
      after?.total !== 2 || !Array.isArray(after.deployments) ||
      after.deployments.length !== 2 ||
      after.deployments.filter((d) => d?.status === 'ready').length !== 1 ||
      after.deployments.filter((d) => d?.status === 'failed').length !== 1 ||
      !after.deployments.some((d) => d?.$id === built.deploymentId && d?.status === 'ready')) {
    throw new Error('New deployment exists but inactive read-back proof failed; do not retry.');
  }
  log('MOSAIC_ORACLE_INACTIVE_MESSAGE_DEPLOYMENT_READY_PASS');
  return { status: 'ready', deploymentId: built.deploymentId, activated: false };
}

export async function runOracleDeploymentOnlyCli({
  argv = process.argv.slice(2),
  env = process.env,
  log = console.log,
} = {}) {
  const target = parseBackendTarget(argv, env);
  assertOracleDeploymentTarget(target, argv);
  const gitSha = flagValue(argv, '--git-sha');
  return buildOracleMessageDeploymentOnly({ target, gitSha, log });
}

if (process.argv[1] &&
    import.meta.url === new URL('file://' + process.argv[1]).href) {
  runOracleDeploymentOnlyCli().catch(() => {
    // Do not print raw Appwrite build logs, endpoints, tokens or response bodies.
    console.error('MOSAIC_ORACLE_DEPLOYMENT_ONLY_RECOVERY_FAILED: inspect read-only Function status; do not rerun.');
    process.exitCode = 1;
  });
}
