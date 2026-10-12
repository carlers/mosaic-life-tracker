#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { assertAutomaticPreviewContext } from './lib/preview-auto-gate.mjs';

try {
  const checkoutSha = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: new URL('..', import.meta.url), encoding: 'utf8', timeout: 10000,
  }).trim();
  assertAutomaticPreviewContext({
    repository: process.env.GITHUB_REPOSITORY,
    eventName: process.env.GITHUB_EVENT_NAME,
    branch: process.env.PREVIEW_DEPLOY_BRANCH,
    sha: process.env.GITHUB_SHA,
    checkoutSha, ref: process.env.GITHUB_REF,
    enabled: process.env.MOSAIC_AUTO_PREVIEW_ENABLED,
    vercelOrgId: process.env.VERCEL_ORG_ID,
    vercelProjectId: process.env.VERCEL_PROJECT_ID,
  });
  console.log('Automatic Preview pilot context verified at SHA ' + checkoutSha);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Automatic Preview authorization failed');
  process.exitCode = 1;
}
