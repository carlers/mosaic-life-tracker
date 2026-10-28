#!/usr/bin/env node
// Activate one previously built, inactive, Git-owned message-action deployment
// only in the disposable, localhost-only Oracle test project. One API mutation.
import {
  assertConfirmedProject, createAppwriteAdminRequest, inspectManagedBackend,
  parseBackendTarget, readBackendDefinitions,
} from './lib/appwrite-backend.mjs';
import { createBootstrapServices, inspectTarget } from './lib/mosaic-bootstrap.mjs';
import { activateFunctionVersion } from './appwrite-function.mjs';

export const ORACLE_PROJECT = '6ae1bf2e00034572451b';
export const ORACLE_ENDPOINT = 'http://localhost/v1';
export const MESSAGE_ID = '6aa8057f002a4c306fdd';
export const EXPECTED_DRIFT = 'function message-action has no live deployment';

export function assertOracleActivationTarget(argv, target) {
  if (!target || target.projectId !== ORACLE_PROJECT ||
      target.endpoint !== ORACLE_ENDPOINT) {
    throw new Error('Refusing to activate a Function outside the exact Oracle test target.');
  }
  assertConfirmedProject(argv, target.projectId);
}

/** Refuse unexpected state before any activation. Exactly one existing ready build. */
export async function activateOracleReadyMessage({
  target,
  services = createBootstrapServices(target),
  definitionsFactory = readBackendDefinitions,
  requestFactory = createAppwriteAdminRequest,
  inspect = inspectManagedBackend,
  activate = activateFunctionVersion,
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  log = () => {},
} = {}) {
  if (!target || target.projectId !== ORACLE_PROJECT ||
      target.endpoint !== ORACLE_ENDPOINT) {
    throw new Error('Oracle activation target mismatch.');
  }
  const state = await inspectTarget(services);
  if (state.databases.count !== 1 || state.databases.ids[0] !== 'life_tracker' ||
      state.buckets.count !== 1 || state.buckets.ids[0] !== 'task_images' ||
      state.functions.count !== 1 || state.functions.ids[0] !== MESSAGE_ID ||
      state.users.count !== 0) {
    throw new Error('Refusing activation: foreign resources or users found.');
  }
  const definitions = await definitionsFactory();
  const config = definitions.functions?.['message-action']?.config;
  if (config?.$id !== MESSAGE_ID || config.runtime !== 'node-18.0') {
    throw new Error('Refusing activation: reviewed Function ID/runtime mismatch.');
  }
  const request = requestFactory(target);
  const inspection = { request, definitions, messageFunctionId: MESSAGE_ID, includeDr: false };
  const before = await inspect(inspection);
  if (!Array.isArray(before?.diffs) || before.diffs.length !== 1 ||
      before.diffs[0] !== EXPECTED_DRIFT) {
    throw new Error('Refusing activation: Git schema/config drift or already live Function.');
  }
  const current = await services.functions.get({ functionId: MESSAGE_ID });
  if (current?.$id !== MESSAGE_ID || current.runtime !== 'node-18.0' ||
      current.live !== false || current.schedule ||
      current.deploymentId || current.deployment) {
    throw new Error('Refusing activation: existing Function state is not inactive.');
  }
  const inventory = await request('GET', '/functions/' + MESSAGE_ID + '/deployments?limit=100');
  if (inventory?.total !== 2 || inventory.deployments?.length !== 2) {
    throw new Error('Refusing activation: expected exactly one failed and one ready build.');
  }
  const ready = inventory.deployments.filter((d) => d?.status === 'ready');
  const failed = inventory.deployments.filter((d) => d?.status === 'failed');
  if (ready.length !== 1 || failed.length !== 1 ||
      !/^[a-zA-Z0-9._-]{1,36}$/.test(ready[0]?.$id || '') ||
      ready[0]?.$id === failed[0]?.$id) {
    throw new Error('Refusing activation: ready deployment is not unique and valid.');
  }
  const deploymentId = ready[0].$id;
  const exact = await services.functions.getDeployment({
    functionId: MESSAGE_ID, deploymentId,
  });
  if (exact?.$id !== deploymentId || exact.status !== 'ready') {
    throw new Error('Refusing activation: ready deployment metadata does not match.');
  }

  log('MOSAIC_ORACLE_ACTIVATION_EXACT_PREFLIGHT_PASS');
  // Exactly one irreversible activation call. NEVER auto-repeat on failures.
  const result = await activate({
    functions: services.functions, functionId: MESSAGE_ID, deploymentId,
  });
  if (result?.deploymentId !== deploymentId || result.status !== 'active') {
    throw new Error('Activation was attempted but verification failed. Do not rerun.');
  }
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const [live, drift] = await Promise.all([
      services.functions.get({ functionId: MESSAGE_ID }),
      inspect(inspection),
    ]);
    if (live?.live === true &&
        (live.deploymentId || live.deployment) === deploymentId &&
        !live.schedule && Array.isArray(drift?.diffs) && drift.diffs.length === 0) {
      log('MOSAIC_ORACLE_MESSAGE_ACTIVATION_DRIFT_PASS');
      return { activated: true, functionId: MESSAGE_ID };
    }
    if (attempt < 7) await wait(2000);
  }
  throw new Error('Activation attempted but postflight not converged. Do not rerun.');
}

export async function runOracleActivationCli({
  argv = process.argv.slice(2), env = process.env, log = console.log,
} = {}) {
  const target = parseBackendTarget(argv, env);
  assertOracleActivationTarget(argv, target);
  return activateOracleReadyMessage({ target, log });
}

if (process.argv[1] &&
    import.meta.url === new URL('file://' + process.argv[1]).href) {
  runOracleActivationCli().catch(() => {
    // Never disclose API responses, build logs, secrets, or bearer credentials.
    console.error('MOSAIC_ORACLE_ACTIVATION_FAILED: inspect state; do not rerun automatically.');
    process.exitCode = 1;
  });
}
