#!/usr/bin/env node
import { deployRecoveredProjectFunctions } from './lib/mosaic-bootstrap.mjs';

function flagValue(argv, name) {
  const index = argv.indexOf(name);
  if (index === -1) return '';
  return argv[index + 1] || '';
}

export function parseDrFunctionDeployArgs(argv = [], env = process.env) {
  const projectId =
    flagValue(argv, '--target-project') || env.APPWRITE_TARGET_PROJECT_ID || '';
  const endpoint =
    flagValue(argv, '--endpoint') || env.APPWRITE_TARGET_ENDPOINT || '';
  const apiKey = env.APPWRITE_TARGET_API_KEY || '';

  if (!projectId) {
    throw new Error(
      'Missing target project. Pass --target-project <projectId> or set APPWRITE_TARGET_PROJECT_ID.'
    );
  }
  if (!endpoint) {
    throw new Error(
      'Missing target endpoint. Pass --endpoint <url> or set APPWRITE_TARGET_ENDPOINT.'
    );
  }
  if (!apiKey) {
    throw new Error('Missing APPWRITE_TARGET_API_KEY.');
  }

  const drSecrets = {};
  for (const name of [
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET',
    'DR_ENCRYPTION_KEY_B64',
  ]) {
    if (!env[name]) {
      throw new Error(`Missing DR recovery Function secret: ${name}`);
    }
    drSecrets[name] = env[name];
  }

  const drVariables = {};
  if (env.R2_ENDPOINT) drVariables.R2_ENDPOINT = env.R2_ENDPOINT;

  return {
    endpoint,
    projectId,
    apiKey,
    drSecrets,
    drVariables,
    messageFunctionId: flagValue(argv, '--message-function-id') || undefined,
    drFunctionId: flagValue(argv, '--dr-function-id') || undefined,
  };
}

export async function runDrFunctionDeployCli({
  argv = process.argv.slice(2),
  env = process.env,
  log = console.log,
} = {}) {
  const config = parseDrFunctionDeployArgs(argv, env);
  log(`Deploying recovered Mosaic Functions to ${config.projectId}...`);
  const result = await deployRecoveredProjectFunctions(config, {
    log: (message) => log(`  ${message}`),
  });
  log('Recovered Mosaic Functions are ready with schedules disabled.');
  log(`message-action Function: ${result.messageFunctionId}`);
  log(`dr-backup Function: ${result.drFunctionId}`);
  return result;
}

const isDirectRun =
  process.argv[1] &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (isDirectRun) {
  runDrFunctionDeployCli().catch((cause) => {
    console.error(
      `DR Function deployment failed: ${cause instanceof Error ? cause.message : 'unknown error'}`
    );
    process.exitCode = 1;
  });
}
