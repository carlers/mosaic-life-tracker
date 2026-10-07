#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { InputFile } from 'node-appwrite/file';
import {
  assertConfirmedProject,
  diffFunction,
  flagValue,
  parseBackendTarget,
  readFunctionDefinition,
} from './lib/appwrite-backend.mjs';
import {
  createBootstrapServices,
  packageFunctionDirectory,
} from './lib/mosaic-bootstrap.mjs';

const execFileAsync = promisify(execFile);
const POLL_MS = 1_000;
const POLL_LIMIT = 180;

export function parseFunctionCommand(argv = [], env = process.env) {
  const action = argv[0] || '';
  if (!['configure', 'deploy', 'activate'].includes(action)) {
    throw new Error(
      'Use configure, deploy, or activate as the Appwrite Function action.'
    );
  }
  const target = parseBackendTarget(argv, env);
  assertConfirmedProject(argv, target.projectId);
  const functionName = flagValue(argv, '--function');
  if (!['message-action', 'dr-backup'].includes(functionName)) {
    throw new Error(
      'Pass --function message-action or --function dr-backup.'
    );
  }
  const deploymentId = flagValue(argv, '--deployment');
  const gitSha = flagValue(argv, '--git-sha');
  if (action === 'deploy' && !/^[0-9a-f]{7,64}$/i.test(gitSha)) {
    throw new Error('Deploy requires --git-sha <commit SHA>.');
  }
  if (action === 'activate' && !deploymentId) {
    throw new Error(
      'Activate requires --deployment <deploymentId>.'
    );
  }
  return {
    action,
    ...target,
    functionName,
    functionId: flagValue(argv, '--function-id'),
    deploymentId,
    gitSha,
  };
}

export function assertSourceMatchesGit({
  gitSha,
  headSha,
  dirtyOutput,
}) {
  if (gitSha.toLowerCase() !== headSha.toLowerCase()) {
    throw new Error(
      `Refusing Function deployment: --git-sha ${gitSha} does not match HEAD ${headSha}.`
    );
  }
  if (String(dirtyOutput || '').trim()) {
    throw new Error(
      'Refusing Function deployment: Function source has uncommitted changes.'
    );
  }
}

async function verifySourceGitState(functionName, gitSha) {
  const [{ stdout: head }, { stdout: dirty }] = await Promise.all([
    execFileAsync('git', ['rev-parse', 'HEAD']),
    execFileAsync('git', [
      'status',
      '--porcelain',
      '--',
      `appwrite-functions/${functionName}`,
    ]),
  ]);
  assertSourceMatchesGit({
    gitSha,
    headSha: head.trim(),
    dirtyOutput: dirty,
  });
}

async function waitForReady(
  functions,
  functionId,
  deploymentId,
  sleep
) {
  for (let attempt = 0; attempt < POLL_LIMIT; attempt += 1) {
    const deployment = await functions.getDeployment({
      functionId,
      deploymentId,
    });
    if (
      deployment.status === 'ready' ||
      deployment.status === 'active'
    ) {
      return deployment;
    }
    if (
      deployment.status === 'failed' ||
      deployment.status === 'canceled'
    ) {
      throw new Error(
        `Function deployment ${deploymentId} ${deployment.status}: ${
          deployment.buildLogs || ''
        }`
      );
    }
    await sleep(POLL_MS);
  }
  throw new Error(
    `Function deployment ${deploymentId} did not become ready`
  );
}

export async function configureFunctionDefinition({
  functions,
  definition,
  functionId,
}) {
  const current = await functions.get({ functionId });
  const config = definition.config;
  await functions.update({
    functionId,
    name: config.name,
    runtime: config.runtime,
    execute: config.execute || [],
    events: config.events || [],
    // The live schedule is operational state: scratch/DR intentionally disable it.
    schedule: current.schedule || '',
    timeout: config.timeout,
    enabled: config.enabled ?? true,
    logging: config.logging ?? true,
    entrypoint: config.entrypoint,
    commands: config.commands,
    scopes: config.scopes || [],
    deploymentRetention: config.deploymentRetention ?? 0,
  });
  const updated = await functions.get({ functionId });
  const drift = diffFunction(updated, config, definition.name);
  if (drift.length) {
    throw new Error(
      `Function configuration reconciliation failed:\n${drift.join('\n')}`
    );
  }
  return {
    functionId,
    events: updated.events || [],
    schedule: updated.schedule || '',
  };
}

export async function deployFunctionVersion({
  functions,
  definition,
  functionId,
  gitSha,
  verifyGit = verifySourceGitState,
  packageDirectory = packageFunctionDirectory,
  sleep = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms)),
}) {
  await verifyGit(definition.name, gitSha);
  const current = await functions.get({ functionId });
  const drift = diffFunction(
    current,
    definition.config,
    definition.name
  );
  if (drift.length) {
    throw new Error(
      `Refusing Function deployment while Function configuration drifts from Git:\n${drift.join(
        '\n'
      )}`
    );
  }
  const archive = await packageDirectory(definition.directory);
  const created = await functions.createDeployment({
    functionId,
    code: InputFile.fromBuffer(
      archive,
      `${definition.name}-${gitSha.slice(0, 12)}.tar.gz`,
      'application/gzip'
    ),
    activate: false,
    entrypoint: definition.config.entrypoint,
    commands: definition.config.commands,
  });
  const ready = await waitForReady(
    functions,
    functionId,
    created.$id,
    sleep
  );
  return {
    deploymentId: ready.$id,
    gitSha,
    status: ready.status,
  };
}

export async function activateFunctionVersion({
  functions,
  functionId,
  deploymentId,
}) {
  const deployment = await functions.getDeployment({
    functionId,
    deploymentId,
  });
  if (!['ready', 'active'].includes(deployment.status)) {
    throw new Error(
      `Refusing activation: deployment ${deploymentId} is ${deployment.status}.`
    );
  }
  if (deployment.status !== 'active') {
    await functions.updateFunctionDeployment({
      functionId,
      deploymentId,
    });
  }
  const current = await functions.get({ functionId });
  const activeId =
    current.deploymentId || current.deployment || '';
  if (activeId !== deploymentId) {
    throw new Error(
      `Activation verification failed: expected ${deploymentId}, active is ${
        activeId || 'none'
      }.`
    );
  }
  return { deploymentId, status: 'active' };
}

export async function runAppwriteFunctionCli({
  argv = process.argv.slice(2),
  env = process.env,
  services,
  log = console.log,
} = {}) {
  const config = parseFunctionCommand(argv, env);
  const definition = await readFunctionDefinition(
    config.functionName
  );
  const functionId =
    config.functionId || definition.config.$id;
  const resolvedServices =
    services || createBootstrapServices(config);

  if (config.action === 'configure') {
    log(
      `Reconciling ${config.functionName} Function configuration in ${config.projectId}...`
    );
    const result = await configureFunctionDefinition({
      functions: resolvedServices.functions,
      definition,
      functionId,
    });
    log(
      `Configured: function=${functionId} events=${result.events.length}. Deployment traffic unchanged.`
    );
    return result;
  }

  if (config.action === 'deploy') {
    log(
      `Building inactive ${config.functionName} deployment from ${config.gitSha} in ${config.projectId}...`
    );
    const result = await deployFunctionVersion({
      functions: resolvedServices.functions,
      definition,
      functionId,
      gitSha: config.gitSha,
    });
    log(
      `Ready: git=${result.gitSha} function=${functionId} deployment=${result.deploymentId}. No traffic changed.`
    );
    return result;
  }

  log(
    `Activating ${config.functionName} deployment ${config.deploymentId} in ${config.projectId}...`
  );
  const result = await activateFunctionVersion({
    functions: resolvedServices.functions,
    functionId,
    deploymentId: config.deploymentId,
  });
  log(
    `Active: function=${functionId} deployment=${result.deploymentId}.`
  );
  return result;
}

const isDirectRun =
  process.argv[1] &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (isDirectRun) {
  runAppwriteFunctionCli().catch((cause) => {
    console.error(
      `Appwrite Function command failed: ${
        cause instanceof Error ? cause.message : 'unknown error'
      }`
    );
    process.exitCode = 1;
  });
}
