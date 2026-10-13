#!/usr/bin/env node
/**
 * Default-branch-only, data-only privileged receiver for #592.
 *
 * It never checks out or executes the candidate commit. Vercel's already
 * connected Git integration builds the exact accepted SHA on Vercel, using
 * normal hosted Preview branch settings. Do not run npm, Vite, plugins,
 * candidate scripts or untrusted artifacts in this secret-bearing runner.
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { assessTrustedPreviewTrigger, assertTrustedPreviewDeployment,
  trustedGitSource, trustedProjectScope, assertTrustedVercelProject, TRUSTED_PREVIEW_BRANCH,
  TRUSTED_PREVIEW_ALIAS, TRUSTED_VERCEL_PROJECT,
  assertTrustedPreviewCreationEnabled, assertTrustedPreviewCreateResponse,
  selectTrustedPreviewCandidate } from './lib/trusted-preview-receiver.mjs';
import { canaryHistoryStart } from './lib/preview-canary-context.mjs';

const repo = 'carlers/mosaic-life-tracker';
const { orgId, projectId } = trustedProjectScope();
const gitToken = process.env.GITHUB_TOKEN ?? '';
const vercelToken = process.env.VERCEL_TOKEN ?? '';

async function get(url, token, label, extra = {}) {
  const res = await fetch(url, {
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
    ...extra,
  });
  if (!res.ok) throw new Error(label + ' HTTP ' + res.status);
  return res.json();
}

async function authorized(event) {
  const run = event.workflow_run;
  const sha = run?.head_sha;
  if (!/^[a-f0-9]{40}$/i.test(sha ?? '') ||
      !Number.isSafeInteger(run?.id)) throw new Error('Invalid triggering workflow identity');
  const ref = TRUSTED_PREVIEW_BRANCH.split('/').map(encodeURIComponent).join('/');
  const gh = path => get('https://api.github.com/repos/' + repo + path,
    gitToken, 'GitHub acceptance');
  const [runs, checks, branch, main] = await Promise.all([
    gh('/actions/runs?head_sha=' + sha + '&per_page=100'),
    gh('/commits/' + sha + '/check-runs?per_page=100'),
    gh('/git/ref/heads/' + ref),
    gh('/git/ref/heads/main'),
  ]);
  if (!Array.isArray(runs.workflow_runs) || !Array.isArray(checks.check_runs) ||
      runs.total_count > 100 || checks.total_count > 100) {
    throw new Error('Incomplete GitHub acceptance history');
  }
  const checkoutSha = execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8', timeout: 10000,
  }).trim();
  if (checkoutSha !== process.env.GITHUB_SHA) {
    throw new Error('Trusted main checkout is not the workflow source SHA');
  }
  const verdict = assessTrustedPreviewTrigger({
    event, repository: process.env.GITHUB_REPOSITORY,
    eventName: process.env.GITHUB_EVENT_NAME, ref: process.env.GITHUB_REF,
    checkoutSha, mainHead: main.object?.sha,
    enabled: process.env.MOSAIC_TRUSTED_PREVIEW_ENABLED,
    workflowRuns: runs.workflow_runs, checkRuns: checks.check_runs,
    branchHead: branch.object?.sha,
  });
  if (!verdict.eligible) throw new Error('Trusted Preview blocked: ' + verdict.reasons.join('; '));
  return verdict;
}

async function findDeployment(sha, since) {
  let until;
  for (let page = 0; page < 5; page += 1) {
    const q = new URLSearchParams({
      teamId: orgId, projectId, since: String(since), limit: '100',
    });
    if (until != null) q.set('until', String(until));
    const body = await get('https://api.vercel.com/v6/deployments?' + q,
      vercelToken, 'Vercel Preview history');
    if (!Array.isArray(body.deployments) || !body.pagination)
      throw new Error('Incomplete deployment history');
    const acceptedId = selectTrustedPreviewCandidate(body.deployments, sha);
    if (acceptedId) return acceptedId;
    const next = body.pagination.next;
    if (next == null) return null;
    if (!Number.isSafeInteger(next) || next <= 0 ||
      (until != null && next >= until)) {
      throw new Error('Vercel history cursor is incomplete');
    }
    until = next;
  }
  throw new Error('Vercel candidate history exceeded bounded inspection');
}

async function getDeployment(id) {
  return get('https://api.vercel.com/v13/deployments/' + encodeURIComponent(id) +
    '?teamId=' + encodeURIComponent(orgId), vercelToken, 'Vercel deployment readback');
}

async function waitReady(id, sha) {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const dep = await getDeployment(id);
    if ((dep.readyState ?? dep.state) === 'READY') {
      assertTrustedPreviewDeployment(dep, sha);
      return dep;
    }
    if (['ERROR', 'CANCELED', 'DELETED'].includes(dep.readyState ?? dep.state)) {
      throw new Error('Vercel did not build the accepted Preview');
    }
    if (attempt < 24) await new Promise(done => setTimeout(done, 12000));
  }
  throw new Error('Vercel Preview did not reach READY within timeout');
}

async function aliasesFor(id) {
  const data = await get('https://api.vercel.com/v2/deployments/' + encodeURIComponent(id) +
    '/aliases?teamId=' + encodeURIComponent(orgId), vercelToken, 'Vercel alias readback');
  if (!Array.isArray(data.aliases)) throw new Error('Missing Vercel alias evidence');
  return data.aliases;
}

async function main() {
  // The triggering event is signed GitHub context, but the branch HEAD and
  // check suite are still independently revalidated via read-only APIs.
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  if (!gitToken || !vercelToken) throw new Error('Trusted GitHub/Vercel credentials unavailable');
  const { sha } = await authorized(event);
  const ghCommit = await get('https://api.github.com/repos/' + repo +
    '/commits/' + sha, gitToken, 'GitHub commit timestamp');
  const seconds = Date.parse(ghCommit.commit?.committer?.date ?? '') / 1000;
  const since = canaryHistoryStart(seconds, Date.now());
  let id = await findDeployment(sha, since);
  if (!id) {
    // The normal first-stage shadow pilot reuses Vercel's existing Git
    // deployment. A missing candidate must never create Production or
    // consume an extra deployment quota without separate explicit opt-in.
    assertTrustedPreviewCreationEnabled(process.env.MOSAIC_TRUSTED_PREVIEW_CREATE_ENABLED);
    // Fail before requesting a remote build if the linked GitHub repo,
    // monorepo root, or production branch configuration is unverified.
    const project = await get('https://api.vercel.com/v9/projects/' +
      encodeURIComponent(projectId) + '?teamId=' + encodeURIComponent(orgId),
      vercelToken, 'Vercel linked project preflight');
    assertTrustedVercelProject(project);
    // Exactly one hosted Git-source request. No Vercel CLI and no candidate
    // checkout: source scripts execute only in Vercel's normal build sandbox.
    const q = new URLSearchParams({ teamId: orgId });
    const created = await get('https://api.vercel.com/v13/deployments?' + q,
      vercelToken, 'Vercel exact Git-source deployment', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + vercelToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: TRUSTED_VERCEL_PROJECT, project: projectId,
          gitSource: trustedGitSource(sha),
          meta: { mosaic_trusted_preview_sha: sha },
        }),
      });
    id = assertTrustedPreviewCreateResponse(created);
  }
  const deployment = await waitReady(id, sha);
  // Do not print the deployed JavaScript or environment inputs; only the
  // accepted public deployment hostname and identity.
  console.log('Trusted Preview READY at ' + deployment.url + ' for ' + sha);

  if (process.env.MOSAIC_TRUSTED_PREVIEW_ALIAS_ENABLED !== 'true') {
    console.log('Shadow mode: stable alias was NOT changed.');
    return;
  }
  // Reconfirm the same GitHub CI, exact branch HEAD and default-branch
  // receiver identity immediately before changing any public alias.
  await authorized(event);
  if (!(await aliasesFor(id)).some(item => item.alias === TRUSTED_PREVIEW_ALIAS)) {
    await get('https://api.vercel.com/v2/deployments/' + encodeURIComponent(id) +
      '/aliases?teamId=' + encodeURIComponent(orgId), vercelToken,
      'Vercel stable Preview alias assignment', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + vercelToken,
          'Content-Type': 'application/json' },
        body: JSON.stringify({ alias: TRUSTED_PREVIEW_ALIAS }),
      });
  }
  if (!(await aliasesFor(id)).some(item => item.alias === TRUSTED_PREVIEW_ALIAS))
    throw new Error('Stable Preview alias did not resolve to accepted deployment');
  console.log('Stable Preview alias verified at accepted SHA ' + sha);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Trusted Preview blocked');
  process.exitCode = 1;
});
