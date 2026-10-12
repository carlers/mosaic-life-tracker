#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { assertPreviewCanaryContext } from './lib/preview-canary-context.mjs';

try {
  const checkoutSha = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: new URL('..', import.meta.url), encoding: 'utf8', timeout: 10000,
  }).trim();
  const branch = process.env.PREVIEW_DEPLOY_BRANCH ?? '';
  assertPreviewCanaryContext({
    repository: process.env.GITHUB_REPOSITORY,
    eventName: process.env.GITHUB_EVENT_NAME,
    branch,
    sha: process.env.GITHUB_SHA,
    checkoutSha,
    requestedSha: process.env.PREVIEW_CANARY_REQUESTED_SHA,
    ref: process.env.GITHUB_REF,
    enabled: process.env.MOSAIC_PREBUILT_CANARY_ENABLED,
    vercelOrgId: process.env.VERCEL_ORG_ID,
    vercelProjectId: process.env.VERCEL_PROJECT_ID,
  });
  console.log('Manual Preview canary context verified: ' + branch + '@' + checkoutSha);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Preview canary context invalid');
  process.exitCode = 1;
}
