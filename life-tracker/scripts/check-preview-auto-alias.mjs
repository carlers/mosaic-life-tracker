#!/usr/bin/env node
import { assertAutomaticPreviewContext, assertAutomaticPreviewDeployment,
  AUTO_PREVIEW_PILOT_ALIAS } from './lib/preview-auto-gate.mjs';
import { OFFICIAL_VERCEL_ORG_ID } from './lib/preview-canary-context.mjs';

try {
  const token = process.env.VERCEL_TOKEN;
  const suppliedUrl = process.env.DEPLOYMENT_URL;
  const mode = process.env.PREVIEW_ALIAS_MODE;
  if (!token || !['before', 'after'].includes(mode)) throw new Error('Protected alias check unavailable');
  if (!suppliedUrl?.startsWith('https://')) throw new Error('Deployment URL missing or untrusted');
  const url = new URL(suppliedUrl);
  if (url.origin !== suppliedUrl || url.pathname !== '/' || url.search || url.hash ||
      !/^[a-z0-9-]+\.vercel\.app$/.test(url.hostname)) {
    throw new Error('Deployment URL must be a standalone HTTPS Vercel hostname');
  }
  const branch = process.env.PREVIEW_DEPLOY_BRANCH;
  const sha = process.env.PREVIEW_DEPLOY_SHA;
  const alias = process.env.PREVIEW_AUTO_ALIAS;
  // Context validation in this step complements the earlier exact git check.
  assertAutomaticPreviewContext({
    repository: process.env.GITHUB_REPOSITORY, eventName: process.env.GITHUB_EVENT_NAME,
    branch, sha, checkoutSha: sha, ref: process.env.GITHUB_REF,
    enabled: process.env.MOSAIC_AUTO_PREVIEW_ENABLED,
    vercelOrgId: process.env.VERCEL_ORG_ID,
    vercelProjectId: process.env.VERCEL_PROJECT_ID,
  });
  if (alias !== AUTO_PREVIEW_PILOT_ALIAS) throw new Error('Untrusted Preview alias');
  const api = async path => {
    const response = await fetch('https://api.vercel.com' + path, {
      headers: { Authorization: 'Bearer ' + token },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error('Vercel protected deployment check HTTP ' + response.status);
    return response.json();
  };
  const suffix = '?teamId=' + encodeURIComponent(OFFICIAL_VERCEL_ORG_ID);
  const dep = await api('/v13/deployments/' + encodeURIComponent(url.hostname) + suffix);
  const id = assertAutomaticPreviewDeployment(dep, {
    hostname: url.hostname, branch, sha, alias,
  });
  if (mode === 'after') {
    const result = await api('/v2/deployments/' + encodeURIComponent(id) + '/aliases' + suffix);
    if (!Array.isArray(result.aliases) ||
        !result.aliases.some(item => item.alias === alias)) {
      throw new Error('Automatic Preview alias was not verified on the accepted deployment');
    }
  }
  console.log('Preview ' + (mode === 'after' ? 'alias readback' : 'deployment preflight') +
    ' verified for accepted SHA ' + sha + '.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Automatic Preview alias verification failed');
  process.exitCode = 1;
}
