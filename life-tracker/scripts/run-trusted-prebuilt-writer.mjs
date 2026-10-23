#!/usr/bin/env node
// Main-owned credential-bearing Preview writer. NEVER used in the shadow job.
// Only vetted Build Output API static files are sent to Vercel; no candidate
// source, package scripts, build tools, or production deployment is executed.
import { randomUUID } from 'node:crypto';
import { readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { accepted, loadAcceptedArtifact } from './lib/prebuilt-github-admission.mjs';
import { assembleVerifiedCandidateStatic } from './lib/prebuilt-candidate-payload.mjs';
import {
  planAcceptedPreview, addUniquePrebuiltDeploymentId, prebuiltCliArguments,
  assessKnownPrebuiltDeployments, assertTrustedProviderProject, assertIsolatedCanaryGitDisable,
  createTrustedCliProjectRoot, isKnownPrebuiltHistoryCandidate,
  providerDeploymentId, verifyPrebuiltHistoryDetail, verifiedPrebuiltGitMetadata,
} from './lib/prebuilt-provider-contract.mjs';

const token = process.env.VERCEL_TOKEN ?? '';
const id = process.env.VERCEL_PROJECT_ID;
const team = process.env.VERCEL_ORG_ID;
const repo = 'carlers/mosaic-life-tracker';
const shaRegex = /^[a-f0-9]{40}$/i;

async function vercelGet(path) {
  const result = await fetch('https://api.vercel.com' + path, {
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
    signal: AbortSignal.timeout(20000),
  });
  if (!result.ok) throw new Error('Vercel readback failed HTTP ' + result.status);
  return result.json();
}

async function deploymentHistory(plan, start) {
  if (!Number.isFinite(start) || start < 1) throw new Error('No bounded provider history start');
  const collected = [];
  let until;
  for (let i = 0; i < 5; i++) {
    const q = new URLSearchParams({
      teamId: plan.teamId, projectId: plan.projectId,
      since: String(start), limit: '100',
    });
    if (until != null) q.set('until', String(until));
    const x = await vercelGet('/v6/deployments?' + q);
    if (!Array.isArray(x?.deployments) || !x.pagination)
      throw new Error('Incomplete Vercel deployment evidence');
    collected.push(...x.deployments);
    if (x.pagination.next == null) break;
    if (!Number.isSafeInteger(x.pagination.next) || x.pagination.next <= 0 ||
        (until != null && x.pagination.next >= until))
      throw new Error('Invalid Vercel deployment page');
    until = x.pagination.next;
    if (i === 4) throw new Error('Vercel deployment history beyond bounded review');
  }
  // The list endpoint can omit canonical project/target/route fields on CLI
  // deployments. An exact ID/SHA match MUST be verified via complete detail,
  // rather than rejecting safe reuse or attempting a second provider POST.
  for (let i = 0; i < collected.length; i++) {
    const summary = collected[i];
    if (!isKnownPrebuiltHistoryCandidate(summary, plan)) continue;
    const historyId = providerDeploymentId(summary);
    const detail = await vercelGet('/v13/deployments/' +
      encodeURIComponent(historyId) + '?teamId=' +
      encodeURIComponent(plan.teamId));
    collected[i] = verifyPrebuiltHistoryDetail(summary, detail, plan);
  }
  return collected;
}

function inspectCliURL(output) {
  const raw = String(output ?? '').trim();
  let url;
  try { url = new URL(raw); } catch { throw new Error('Invalid prebuilt Vercel deployment URL'); }
  if (url.protocol !== 'https:' || url.origin !== raw ||
      !/^[a-z0-9-]+\.vercel\.app$/.test(url.hostname))
    throw new Error('Unexpected Vercel deployment hostname');
  return url.hostname;
}

async function assertProviderReady(host, plan, gitMetadata) {
  const d = await vercelGet('/v13/deployments/' +
    encodeURIComponent(host) + '?teamId=' + encodeURIComponent(plan.teamId));
  if (d.projectId !== plan.projectId ||
      ![null, 'preview'].includes(d.target) ||
      (d.readyState ?? d.state) !== 'READY' ||
      d.meta?.mosaicPrebuiltId !== plan.deploymentId ||
      d.meta?.mosaicPrebuiltSha !== plan.sha ||
      d.meta?.mosaicPrebuiltBranch !== plan.branch ||
      d.meta?.mosaicPrebuiltRoute !== plan.meta.mosaicPrebuiltRoute ||
      d.url !== host || !shaRegex.test(plan.sha) ||
      Object.entries(gitMetadata).some(([key, value]) => d.meta?.[key] !== value)) {
    throw new Error('Prebuilt deployment failed READY / identity / Preview readback');
  }
  return d;
}

async function main() {
  if (!token || !process.env.GITHUB_TOKEN || id !== 'prj_jysOLDbuO9c5rP8x6Q145DVIw0fc' ||
      team !== 'team_UbpudOr8jXyrDA5SdVUxVGOr') {
    throw new Error('Trusted provider credentials or project scope unavailable');
  }
  const { acceptedRun, event, metadata, verified } = await loadAcceptedArtifact();
  const plan = planAcceptedPreview({
    sha: acceptedRun.sha, branch: acceptedRun.branch,
    runId: acceptedRun.runId, attempt: acceptedRun.attempt,
    zipDigest: metadata.digest, routeSha256: verified.routingSha256,
    target: 'preview',
    createEnabled: process.env.MOSAIC_TRUSTED_PREVIEW_CREATE_ENABLED,
    aliasEnabled: process.env.MOSAIC_TRUSTED_PREVIEW_ALIAS_ENABLED,
    genericEnabled: process.env.MOSAIC_TRUSTED_PREVIEW_GENERIC_ENABLED,
    projectId: id,
  });
  if (!shaRegex.test(plan.sha) || verified.deploymentAuthorized !== false)
    throw new Error('No trusted Preview candidate');

  // Commit time, not workflow-run time: rerunning the exact same SHA later
  // must still find its prior upload. No secrets ever enter this GET.
  const gh = await fetch('https://api.github.com/repos/' + repo + '/commits/' + plan.sha, {
    headers: { Authorization: 'Bearer ' + process.env.GITHUB_TOKEN },
    signal: AbortSignal.timeout(15000),
  });
  if (!gh.ok) throw new Error('Cannot establish source commit history window');
  const commit = await gh.json();
  const gitMetadata = verifiedPrebuiltGitMetadata(commit, plan);
  const timestamp = Date.parse(commit.commit?.committer?.date ?? '');
  if (!Number.isFinite(timestamp)) throw new Error('Missing trusted Git commit date');
  const since = timestamp - 24 * 60 * 60 * 1000;

  // Never POST while the original Git integration could create the same
  // canary SHA. Vercel's broad fix/* rule would override a specific false.
  const ghConfig = await fetch('https://api.github.com/repos/' + repo +
    '/contents/life-tracker/vercel.json?ref=' + encodeURIComponent(plan.sha), {
      headers: {Authorization:'Bearer ' + process.env.GITHUB_TOKEN,
        Accept:'application/vnd.github+json'},
      signal:AbortSignal.timeout(15000),
    });
  if (!ghConfig.ok) throw new Error('No trusted candidate Git configuration');
  const json = await ghConfig.json();
  if (json?.encoding !== 'base64' || typeof json.content !== 'string')
    throw new Error('Incomplete GitHub configuration readback');
  assertIsolatedCanaryGitDisable(Buffer.from(json.content, 'base64'), plan.branch);
  const project = await vercelGet('/v9/projects/' +
    encodeURIComponent(plan.projectId) + '?teamId=' +
    encodeURIComponent(plan.teamId));
  assertTrustedProviderProject(project);

  const first = assessKnownPrebuiltDeployments(
    await deploymentHistory(plan, since), plan, { exhaustive: true });
  if (first.action !== 'create') {
    console.log('Verified prebuilt already present: ' + first.action +
      '; no additional provider POST or alias change.');
    return;
  }

  const root = join(tmpdir(), 'mosaic-prebuilt-' + randomUUID());
  try {
    const staged = await assembleVerifiedCandidateStatic(verified, root);
    if (staged.deploymentAuthorized !== false || staged.files !== verified.fileCount)
      throw new Error('Cannot stage modified or incomplete static artifact');
    const configPath = join(root, '.vercel', 'output', 'config.json');
    const original = await readFile(configPath);
    await writeFile(configPath, addUniquePrebuiltDeploymentId(original, plan));
    await mkdir(join(root, '.vercel'), { recursive: true });
    await writeFile(join(root, '.vercel', 'project.json'),
      JSON.stringify({ orgId: plan.teamId, projectId: plan.projectId }) + '\n',
      { flag: 'wx' });
    await createTrustedCliProjectRoot(root, plan);

    await accepted(event); // Latest exact branch/source/canonical before writing.
    const last = assessKnownPrebuiltDeployments(
      await deploymentHistory(plan, since), plan, { exhaustive: true });
    if (last.action !== 'create') {
      console.log('Prebuilt appeared after last check: ' + last.action +
        '; duplicate creation suppressed.');
      return;
    }
    await accepted(event); // Last read-only GitHub verification before CLI POST.

    // Pin the Vercel binary at workflow-install time without provider secrets.
    // The child may upload verified static bytes only, never build app sources.
    const result = execFileSync('vercel', prebuiltCliArguments(plan, gitMetadata), {
      cwd: root,
      env: process.env,
      encoding: 'utf8',
      timeout: 8 * 60 * 1000,
      maxBuffer: 256 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const host = inspectCliURL(result);
    await assertProviderReady(host, plan, gitMetadata);
    console.log('Verified CI-first prebuilt READY for accepted SHA ' + plan.sha +
      ', run ' + plan.runId + ', deploymentId ' + plan.deploymentId + '.');
    console.log('No Vercel build, candidate script execution or alias mutation.');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Prebuilt provider writer blocked');
  process.exitCode = 1;
});
