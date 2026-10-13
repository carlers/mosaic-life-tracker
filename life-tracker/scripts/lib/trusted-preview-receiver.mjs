import { OFFICIAL_VERCEL_ORG_ID, OFFICIAL_VERCEL_PROJECT_ID } from './preview-canary-context.mjs';
import { assessPreviewDeployGate } from './preview-deploy-gate.mjs';

export const TRUSTED_PREVIEW_BRANCH = 'fix/workflow-build-parity-592-20261012';
// Approved pilot source's immutable Git blob, not just a self-reported CI check.
// Future stable branches need their own reviewed workflow-version admission.
export const TRUSTED_PILOT_QUALITY_GATE_BLOB_SHA =
  'f8a6588644db34ffa20a7c311c00a030ed88a12b';
export const TRUSTED_PREVIEW_ALIAS =
  'mosaic-life-tracker-git-fix-work-73127a-carls-projects-72516fde.vercel.app';
export const TRUSTED_GITHUB_REPO_ID = 1361399135;
export const TRUSTED_VERCEL_PROJECT = 'mosaic-life-tracker';
export const SHA = /^[a-f0-9]{40}$/i;

export function assessTrustedPreviewTrigger({ event, repository, eventName, ref,
  checkoutSha, mainHead, enabled, workflowRuns, checkRuns, branchHead,
  sourceWorkflowBlobSha }) {
  const reasons = [];
  const source = event?.workflow_run;
  if (eventName !== 'workflow_run' || repository !== 'carlers/mosaic-life-tracker')
    reasons.push('untrusted GitHub event or repository');
  if (ref !== 'refs/heads/main' || !SHA.test(checkoutSha ?? ''))
    reasons.push('trusted main workflow checkout required');
  if (mainHead !== checkoutSha || !SHA.test(mainHead ?? ''))
    reasons.push('trusted main checkout is stale');
  if (enabled !== 'true') reasons.push('trusted Preview delivery disabled');
  if (sourceWorkflowBlobSha !== TRUSTED_PILOT_QUALITY_GATE_BLOB_SHA)
    reasons.push('unreviewed candidate Quality Gate workflow');
  if (event?.repository?.full_name !== 'carlers/mosaic-life-tracker' ||
      source?.head_repository?.full_name !== 'carlers/mosaic-life-tracker' ||
      source?.repository?.full_name !== 'carlers/mosaic-life-tracker' ||
      source?.name !== 'Quality Gate' ||
      source?.path !== '.github/workflows/quality-gate.yml' ||
      source?.event !== 'push' ||
      source?.status !== 'completed' || source?.conclusion !== 'success' ||
      source?.head_branch !== TRUSTED_PREVIEW_BRANCH ||
      !SHA.test(source?.head_sha ?? '') || !Number.isSafeInteger(source?.id) ||
      !Number.isSafeInteger(source?.check_suite_id)) {
    reasons.push('untrusted completed Quality Gate evidence');
  }
  const assessment = assessPreviewDeployGate({
    repository: event?.repository?.full_name, branch: source?.head_branch,
    sha: source?.head_sha, headSha: branchHead, workflowRuns, checkRuns,
  });
  if (!assessment.eligible || assessment.acceptedRunId !== source?.id) {
    reasons.push('latest exact-SHA canonical CI or branch HEAD not accepted');
  }
  return { eligible: reasons.length === 0, reasons, sha: source?.head_sha,
    branch: source?.head_branch, runId: source?.id };
}

// Verify Git Trees metadata only, never fetch untrusted workflow source.
export function selectVerifiedGitTreeChild(tree, path, type) {
  if (tree?.truncated !== false || !Array.isArray(tree.tree))
    throw new Error('Incomplete candidate Git tree metadata');
  const entries = tree.tree.filter(entry => entry?.path === path);
  if (entries.length !== 1 || entries[0].type !== type ||
      !SHA.test(entries[0].sha ?? ''))
    throw new Error('Invalid candidate Git tree entry');
  return entries[0].sha;
}

export function assertTrustedPreviewDeployment(deployment, sha) {
  const meta = deployment?.meta ?? {};
  if (!SHA.test(sha ?? '') || deployment?.projectId !== OFFICIAL_VERCEL_PROJECT_ID ||
      deployment?.readyState !== 'READY' ||
      ![null, 'preview'].includes(deployment?.target) ||
      deployment?.source !== 'git' ||
      meta.githubCommitSha !== sha ||
      meta.githubOrg !== 'carlers' ||
      meta.githubRepo !== 'mosaic-life-tracker' ||
      meta.githubCommitRef !== TRUSTED_PREVIEW_BRANCH ||
      !/^[a-z0-9-]+\.vercel\.app$/.test(deployment?.url ?? '') ||
      typeof deployment?.id !== 'string') {
    throw new Error('READY Vercel deployment identity did not match the trusted exact SHA');
  }
  return deployment.id;
}

// The project-scoped Vercel deployment list does not include trustworthy full
// project/source identity: caller must validate the chosen ID using the
// authenticated deployment GET. Prefer an already READY exact-SHA Git Preview
// over duplicate in-progress entries; do not waste a retry or quota unit.
export function selectTrustedPreviewCandidate(deployments, sha) {
  if (!Array.isArray(deployments) || !SHA.test(sha ?? '')) {
    throw new Error('Incomplete or invalid Vercel candidate history');
  }
  const matches = deployments.filter(dep => {
    const meta = dep?.meta ?? {};
    // Vercel's raw GET /v6/deployments contract uses "uid" (required);
    // normalized provider clients sometimes expose "id" instead.
    // Reject contradictory identities, before full authenticated GET.
    const id = dep?.id ?? dep?.uid;
    return typeof id === 'string' && id.startsWith('dpl_') &&
      (dep?.id == null || dep?.uid == null || dep.id === dep.uid) &&
      meta.githubCommitSha === sha && meta.githubOrg === 'carlers' &&
      meta.githubRepo === 'mosaic-life-tracker' &&
      meta.githubCommitRef === TRUSTED_PREVIEW_BRANCH &&
      // LIST may omit the target. This only nominates an ID: the full
      // authenticated GET still requires an explicit non-production target.
      (dep.target == null || dep.target === 'preview') &&
      ['READY', 'BUILDING', 'QUEUED', 'INITIALIZING'].includes(
        dep.readyState ?? dep.state);
  });
  const selected = matches.find(dep => (dep.readyState ?? dep.state) === 'READY') ??
    matches[0];
  return selected?.id ?? selected?.uid ?? null;
}

// Shadow mode has read access only: absence of a matching Vercel Git
// deployment must not silently fall through to a privileged POST.
export function assertTrustedPreviewCreationEnabled(enabled) {
  if (enabled !== 'true') {
    throw new Error('Trusted Preview creation disabled: reuse-only shadow mode');
  }
}

// A remote POST is a write even if the provider later rejects the build.
// Reject an unexpected target *before* polling, aliasing or trusting its ID.
export function assertTrustedPreviewCreateResponse(created) {
  const id = created?.id ?? created?.uid;
  if (created?.target !== null || typeof id !== 'string' || !id.startsWith('dpl_')) {
    throw new Error('Vercel create response is not a verified Preview target');
  }
  return id;
}

export function trustedGitSource(sha) {
  if (!SHA.test(sha ?? '')) throw new Error('Invalid trusted Vercel gitSource SHA');
  return { type: 'github', repoId: TRUSTED_GITHUB_REPO_ID,
    ref: TRUSTED_PREVIEW_BRANCH, sha };
}

export function trustedProjectScope() {
  return { orgId: OFFICIAL_VERCEL_ORG_ID, projectId: OFFICIAL_VERCEL_PROJECT_ID };
}

export function assertTrustedVercelProject(project) {
  const link = project?.link ?? {};
  if (project?.id !== OFFICIAL_VERCEL_PROJECT_ID ||
      project?.name !== TRUSTED_VERCEL_PROJECT ||
      project?.rootDirectory !== 'life-tracker' ||
      link.type !== 'github' ||
      String(link.repoId) !== String(TRUSTED_GITHUB_REPO_ID) ||
      link.productionBranch !== 'main') {
    throw new Error('Vercel project Git binding, root or production branch is unverified');
  }
  return true;
}
