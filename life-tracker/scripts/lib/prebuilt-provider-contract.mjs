import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { PREBUILT_CANARY_BRANCH, PREBUILT_ROUTING_SHA256,
  isApprovedPrebuiltBranch, isGenericPrebuiltBranch } from './prebuilt-receiver-gate.mjs';
import { isExactPrebuiltSourceOptIn } from './prebuilt-candidate-payload.mjs';

// Policy and private staging helpers. Never run the CLI or contact Vercel here.
// The provider writer consumes a plan only after fresh independent canonical
// GitHub acceptance and full artifact byte verification.
export const VERIFIED_PREVIEW_PROJECT = 'prj_jysOLDbuO9c5rP8x6Q145DVIw0fc';
export const VERIFIED_PREVIEW_TEAM = 'team_UbpudOr8jXyrDA5SdVUxVGOr';
const SHA = /^[0-9a-f]{40}$/;
const ZIP = /^sha256:[0-9a-f]{64}$/;
const digest = data => createHash('sha256').update(data).digest('hex');

export function planAcceptedPreview({
  sha, branch, runId, attempt, zipDigest, routeSha256, target,
  createEnabled, aliasEnabled, genericEnabled, projectId = VERIFIED_PREVIEW_PROJECT,
}) {
  if (createEnabled !== 'true' || aliasEnabled === 'true') {
    throw new Error('Prebuilt creation disabled or alias control not independently approved');
  }
  if (isGenericPrebuiltBranch(branch) && genericEnabled !== 'true')
    throw new Error('Generic Preview rollout disabled');
  if (!SHA.test(sha ?? '') || !isApprovedPrebuiltBranch(branch) ||
      !Number.isSafeInteger(runId) || runId < 1 ||
      !Number.isSafeInteger(attempt) || attempt < 1 ||
      !ZIP.test(zipDigest ?? '') ||
      routeSha256 !== PREBUILT_ROUTING_SHA256 ||
      target !== 'preview' || projectId !== VERIFIED_PREVIEW_PROJECT) {
    throw new Error('Untrusted CI artifact, destination or deployment identity');
  }
  // Stable per branch+commit+project, deliberately independent of GitHub retry
  // or attempt. Provider refuses duplicate IDs, even after a lost CLI response.
  const deploymentId = 'mos' + digest(
    'mosaic-ci-prebuilt-v1\0' + projectId + '\0' + branch + '\0' + sha,
  ).slice(0, 29);
  const meta = {
    mosaicPrebuiltSha: sha,
    mosaicPrebuiltBranch: branch,
    mosaicPrebuiltId: deploymentId,
    mosaicPrebuiltRoute: routeSha256,
    mosaicPrebuiltRun: String(runId),
    mosaicPrebuiltAttempt: String(attempt),
  };
  return Object.freeze({
    sha, branch, runId, attempt, zipDigest, deploymentId,
    projectId, teamId: VERIFIED_PREVIEW_TEAM, target: 'preview',
    meta: Object.freeze(meta),
  });
}

// This permitted mutation is performed by trusted main code only, AFTER
// verifying the exact candidate-supplied version-3 route bytes/digest.
// Neither route semantics nor any static asset byte is changed.
export function addUniquePrebuiltDeploymentId(configBytes, plan) {
  if (!Buffer.isBuffer(configBytes) ||
      digest(configBytes) !== PREBUILT_ROUTING_SHA256 ||
      !/^[a-z0-9]{32}$/.test(plan?.deploymentId ?? '')) {
    throw new Error('Unverified prebuilt config or deterministic ID');
  }
  let parsed;
  try { parsed = JSON.parse(configBytes.toString('utf8')); }
  catch { throw new Error('Malformed trusted routing bytes'); }
  if (parsed?.version !== 3 || !Array.isArray(parsed.routes) ||
      Object.keys(parsed).some(key => key !== 'version' && key !== 'routes') ||
      parsed.routes.length < 15) {
    throw new Error('Unsupported Vercel static output policy');
  }
  // Deliberately no Vercel alias/promote, runtime vars, redirects or functions.
  return Buffer.from(JSON.stringify({ ...parsed, deploymentId: plan.deploymentId }) + '\n');
}

// Git metadata is derived exclusively from the protected writer's exact SHA
// GitHub readback, never from a candidate artifact or untrusted build script.
// Vercel uses these conventional metadata keys for the dashboard commit title.
export function verifiedPrebuiltGitMetadata(commit, plan) {
  if (commit?.sha !== plan?.sha ||
      plan?.target !== 'preview' ||
      plan?.projectId !== VERIFIED_PREVIEW_PROJECT ||
      typeof commit?.commit?.message !== 'string') {
    throw new Error('Unverified Git commit metadata');
  }
  const subject = commit.commit.message.split(/\r?\n/, 1)[0].trim();
  // A title is presentation data: preserve punctuation and Unicode, but
  // reject control characters and bound its size without shell interpolation.
  if (!subject || [...subject].length > 180 ||
      /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(subject)) {
    throw new Error('Missing or unsafe Git commit subject');
  }
  const meta = {
    githubCommitMessage: subject,
    githubCommitSha: plan.sha,
    githubCommitRef: plan.branch,
    githubCommitOrg: 'carlers',
    githubCommitRepo: 'mosaic-life-tracker',
    githubOrg: 'carlers',
    githubRepo: 'mosaic-life-tracker',
    githubDeployment: '1',
  };
  const authorName = commit.commit.author?.name;
  if (typeof authorName === 'string' && authorName.trim() &&
      [...authorName].length <= 100 &&
      !/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(authorName)) {
    meta.githubCommitAuthorName = authorName.trim();
  }
  const login = commit.author?.login;
  if (typeof login === 'string' && /^[A-Za-z0-9-]{1,39}$/.test(login)) {
    meta.githubCommitAuthorLogin = login;
  }
  return Object.freeze(meta);
}

export function prebuiltCliArguments(plan, gitMetadata = null) {
  if (plan?.target !== 'preview' ||
      plan?.projectId !== VERIFIED_PREVIEW_PROJECT ||
      plan?.teamId !== VERIFIED_PREVIEW_TEAM ||
      !/^[a-z0-9]{32}$/.test(plan.deploymentId ?? '')) {
    throw new Error('Forbidden Vercel prebuilt scope');
  }
  const argv = ['deploy', '--yes', '--prebuilt', '--target=preview',
    '--archive=tgz'];
  for (const [key, value] of Object.entries(plan.meta)) {
    if (!/^[a-zA-Z0-9]+$/.test(key) ||
        !/^[a-zA-Z0-9._/-]+$/.test(value)) {
      throw new Error('Unsafe Vercel metadata');
    }
    argv.push('--meta', key + '=' + value);
  }
  if (gitMetadata !== null) {
    if (!gitMetadata || typeof gitMetadata !== 'object' ||
        gitMetadata.githubCommitSha !== plan.sha ||
        gitMetadata.githubCommitRef !== plan.branch ||
        gitMetadata.githubCommitOrg !== 'carlers' ||
        gitMetadata.githubCommitRepo !== 'mosaic-life-tracker' ||
        gitMetadata.githubOrg !== 'carlers' ||
        gitMetadata.githubRepo !== 'mosaic-life-tracker' ||
        gitMetadata.githubDeployment !== '1') {
      throw new Error('Unverified Vercel Git presentation metadata');
    }
    const allowed = new Set([
      'githubCommitMessage', 'githubCommitSha', 'githubCommitRef',
      'githubCommitOrg', 'githubCommitRepo', 'githubOrg', 'githubRepo',
      'githubDeployment', 'githubCommitAuthorName', 'githubCommitAuthorLogin',
    ]);
    if (typeof gitMetadata.githubCommitMessage !== 'string' ||
        !gitMetadata.githubCommitMessage.trim()) {
      throw new Error('Missing Git deployment title');
    }
    for (const [key, value] of Object.entries(gitMetadata)) {
      if (!allowed.has(key) || typeof value !== 'string' ||
          !value.trim() || [...value].length > 180 ||
          /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(value)) {
        throw new Error('Unsafe Git presentation metadata');
      }
      argv.push('--meta', key + '=' + value);
    }
  }
  return argv;
}

// The paginated /v6 deployment list is summary evidence, not the canonical
// identity response. On a matching ID/SHA, enrich it with an authenticated
// /v13 deployment detail before deciding to reuse, wait or block. Never
// accept a claimed summary as sufficient or infer Preview from a missing field.
export function isKnownPrebuiltHistoryCandidate(dep, plan) {
  return dep?.meta?.mosaicPrebuiltId === plan?.deploymentId ||
    (dep?.meta?.mosaicPrebuiltSha === plan?.sha &&
      dep?.meta?.mosaicPrebuiltBranch === plan?.branch);
}

// Vercel /v6/deployments uses 'uid'; /v13 detail often uses 'id'.
// Reject missing, malformed, or contradictory IDs rather than assuming that
// the two response schemas use the same field name.
export function providerDeploymentId(deployment) {
  const id = deployment?.id;
  const uid = deployment?.uid;
  if (id != null && uid != null && id !== uid)
    throw new Error('Contradictory Vercel deployment id/uid');
  const result = id ?? uid;
  if (typeof result !== 'string' || !/^dpl_[a-zA-Z0-9]+$/.test(result))
    throw new Error('Invalid matching provider deployment ID');
  return result;
}

export function verifyPrebuiltHistoryDetail(summary, detail, plan) {
  const summaryId = providerDeploymentId(summary);
  const detailId = providerDeploymentId(detail);
  if (!isKnownPrebuiltHistoryCandidate(summary, plan) ||
      summaryId !== detailId ||
      detail?.url !== summary.url ||
      detail?.projectId !== plan.projectId ||
      ![null, 'preview'].includes(detail?.target) ||
      detail?.meta?.mosaicPrebuiltId !== plan.deploymentId ||
      detail?.meta?.mosaicPrebuiltSha !== plan.sha ||
      detail?.meta?.mosaicPrebuiltBranch !== plan.branch ||
      detail?.meta?.mosaicPrebuiltRoute !== PREBUILT_ROUTING_SHA256 ||
      (summary.target != null && summary.target !== detail.target) ||
      (summary.meta?.mosaicPrebuiltId != null &&
        summary.meta.mosaicPrebuiltId !== detail.meta.mosaicPrebuiltId) ||
      (summary.meta?.mosaicPrebuiltRoute != null &&
        summary.meta.mosaicPrebuiltRoute !== detail.meta.mosaicPrebuiltRoute) ||
      (summary.readyState ?? summary.state) !== (detail.readyState ?? detail.state)) {
    throw new Error('Prebuilt summary/detail identity mismatch');
  }
  return { ...summary, id: summaryId, projectId: detail.projectId,
    target: detail.target, meta: detail.meta,
    readyState: detail.readyState ?? detail.state };
}

export function assessKnownPrebuiltDeployments(deployments, plan, { exhaustive = false } = {}) {
  if (!exhaustive || !Array.isArray(deployments) || !plan?.deploymentId) {
    throw new Error('Incomplete Vercel history cannot prove safe first creation');
  }
  // CLI previews now also carry Git presentation metadata. Never treat our
  // own recognized prebuilt as an unrelated Git integration deployment when
  // Vercel omits 'source' in a paginated list. Still reject explicit Git
  // deployments or any unknown deployment for the same exact SHA/ref.
  if (deployments.some(dep =>
    dep?.meta?.githubCommitSha === plan.sha &&
    dep?.meta?.githubCommitRef === plan.branch &&
    (dep.source === 'git' || !isKnownPrebuiltHistoryCandidate(dep, plan)))) {
    throw new Error('Another deployment already created this SHA; do not double deploy');
  }
  const matches = deployments.filter(dep => isKnownPrebuiltHistoryCandidate(dep, plan));
  if (matches.length > 1) throw new Error('Duplicate prebuilt provider deployments');
  if (!matches.length) return Object.freeze({ action: 'create' });
  const dep = matches[0];
  if (dep.projectId !== plan.projectId ||
      ![null, 'preview'].includes(dep.target) ||
      dep.meta?.mosaicPrebuiltId !== plan.deploymentId ||
      dep.meta?.mosaicPrebuiltRoute !== PREBUILT_ROUTING_SHA256 ||
      !/^[a-z0-9-]+\.vercel\.app$/.test(dep.url ?? '') ||
      typeof dep.id !== 'string' || !/^dpl_[a-zA-Z0-9]+$/.test(dep.id)) {
    throw new Error('Vercel deployment identity or target mismatch');
  }
  const state = dep.readyState ?? dep.state;
  if (state === 'READY') return Object.freeze({ action: 'reuse', id: dep.id });
  if (['BUILDING', 'QUEUED', 'INITIALIZING'].includes(state)) {
    return Object.freeze({ action: 'wait', id: dep.id });
  }
  // Provider error, timeout or incomplete response requires review; do not
  // auto-repeat creation and consume more quota.
  throw new Error('Existing prebuilt deployment needs human investigation');
}

// CLI v62.7.0 validates the linked project's configured rootDirectory BEFORE
// reading the already verified .vercel/output. Our local project.json is at
// the temporary workspace root (not a repository-level repo.json), so CLI
// reads the single trusted output at root/.vercel/output. Create ONLY the
// required empty project directory; never copy candidate source/build bytes.
export async function createTrustedCliProjectRoot(root, plan) {
  if (plan?.projectId !== VERIFIED_PREVIEW_PROJECT ||
      plan?.teamId !== VERIFIED_PREVIEW_TEAM || plan?.target !== 'preview' ||
      typeof root !== 'string' || root.length === 0) {
    throw new Error('Untrusted Vercel rootDirectory staging request');
  }
  const directory = join(root, 'life-tracker');
  await mkdir(directory); // Exclusive: refuse existing file, link or directory.
  return directory;
}

export function assertTrustedProviderProject(project) {
  const link = project?.link ?? {};
  if (project?.id !== VERIFIED_PREVIEW_PROJECT ||
      project?.name !== 'mosaic-life-tracker' ||
      project?.rootDirectory !== 'life-tracker' ||
      link.type !== 'github' ||
      String(link.repoId) !== '1361399135' ||
      link.productionBranch !== 'main') {
    throw new Error('Untrusted Vercel linked Git project, root or production branch');
  }
  return true;
}

// Source-side Vercel suppression MUST be an exact, protected-main-reviewed
// source template: historical one-branch opt-in OR default inherited stable
// suppression. Unknown/overlapping rules block provider creation. Main/dev Git
// deployment remains enabled.
export function assertIsolatedCanaryGitDisable(raw, branch = PREBUILT_CANARY_BRANCH) {
  if (!isExactPrebuiltSourceOptIn(raw, branch))
    throw new Error('Source Git deployment disable policy was not reviewed');
  return true;
}
