#!/usr/bin/env node
/**
 * One guarded, Git-owned Scratch-only chat-photo backend deployment path.
 * Does not edit Production or promote protected Git branches.
 * Requires a locally held Scratch API key, explicit project confirmation,
 * the reviewed exact Git SHA and pinned historical-client compatibility.
 */
import { execFileSync } from 'node:child_process';
import { parseBackendTarget, flagValue, assertConfirmedProject } from './lib/appwrite-backend.mjs';
import { assertScratchPreviewTarget, SCRATCH_ID, SCRATCH_ENDPOINT, runPreviewPrepare } from './appwrite-preview-prepare.mjs';
import { runAppwriteMigrateCli } from './appwrite-migrate.mjs';
import { runAppwriteFunctionCli, activateFunctionVersion } from './appwrite-function.mjs';
import { createBootstrapServices } from './lib/mosaic-bootstrap.mjs';

export function parseChatPhotoScratchArgs(argv, env = process.env) {
  const target = parseBackendTarget(argv, env);
  assertScratchPreviewTarget(argv, target);
  assertConfirmedProject(argv, target.projectId);
  const sha = flagValue(argv, '--git-sha');
  if (!/^[a-f0-9]{40}$/i.test(sha)) throw Error('Pass exact --git-sha <40-char commit SHA>');
  if (target.projectId !== SCRATCH_ID || target.endpoint !== SCRATCH_ENDPOINT)
    throw Error('Chat photos may only be deployed to the reviewed Scratch project');
  return { target, sha };
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

export async function prepareChatPhotoScratch({
  argv = process.argv.slice(2),
  env = process.env,
  log = console.log,
  sourceGit = git,
  runCompatibility = () => execFileSync(
    process.execPath, ['scripts/check-backend-consumer-compat.mjs', '--all'],
    { stdio: 'inherit' }
  ),
  migrate = runAppwriteMigrateCli,
  configureDeployActivate = runAppwriteFunctionCli,
  ready = runPreviewPrepare,
  services = createBootstrapServices,
} = {}) {
  const { target, sha } = parseChatPhotoScratchArgs(argv, env);
  if (sourceGit(['rev-parse', 'HEAD']).toLowerCase() !== sha.toLowerCase())
    throw Error('Exact Git HEAD does not match reviewed --git-sha');
  if (sourceGit(['status', '--porcelain', '--', 'scripts', 'infrastructure',
    'appwrite-functions/message-action', 'src/lib/syncMapping.ts', 'src/db/schema.ts']))
    throw Error('Backend/Function source is dirty; commit and reverify before deployment');

  log('Checking pinned historical consumers before any Scratch write...');
  await runCompatibility();

  const common = ['--project', SCRATCH_ID, '--endpoint', SCRATCH_ENDPOINT,
    '--confirm-project', SCRATCH_ID];
  const func = [...common, '--function', 'message-action',
    '--function-id', '6aa8057f002a4c306fdd'];
  const functions = services(target).functions;
  const previous = (await functions.get({ functionId: '6aa8057f002a4c306fdd' })).deploymentId;
  if (!previous) throw Error('Scratch message-action has no rollback deployment');

  // Ordered migration 016 is additive, repeatable and checks existing columns.
  await migrate({ argv: [...common, '--only', '017-message-chat-photos'], env, log });
  await configureDeployActivate({ argv: ['configure', ...func], env, log });
  const before = await ready({ argv: common, env, log });
  if (before.diffs.length) throw Error('Scratch schema/Function drift; refusing activation');

  const deployed = await configureDeployActivate({
    argv: ['deploy', ...func, '--git-sha', sha], env, log,
  });
  if (!deployed.deploymentId) throw Error('No reviewed ready Function deployment');

  let activationAttempted = false;
  try {
    activationAttempted = true;
    await configureDeployActivate({
      argv: ['activate', ...func, '--deployment', deployed.deploymentId], env, log,
    });
    const finalState = await ready({
      argv: [...common, '--expected-deployment', deployed.deploymentId], env, log,
    });
    if (finalState.diffs.length)
      throw Error('Scratch readiness mismatch after Function activation');
  } catch (cause) {
    if (activationAttempted) {
      log('Readiness rejected; restoring prior Scratch Function deployment.');
      await activateFunctionVersion({
        functions, functionId: '6aa8057f002a4c306fdd', deploymentId: previous,
      });
    }
    throw cause;
  }
  log('SCRATCH_PHOTO_BACKEND_READY git=' + sha + ' deployment=' + deployed.deploymentId);
  log('Next: enable feature only on a branch-scoped Preview, then verify 3-user ACL and devices.');
  return { sha, deploymentId: deployed.deploymentId, previous };
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  prepareChatPhotoScratch().catch(error => {
    console.error('SCRATCH_PHOTO_BACKEND_BLOCKED: ' + error.message);
    process.exitCode = 1;
  });
}
