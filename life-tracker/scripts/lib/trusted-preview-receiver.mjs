import { OFFICIAL_VERCEL_ORG_ID, OFFICIAL_VERCEL_PROJECT_ID } from './preview-canary-context.mjs';
import { assessPreviewDeployGate } from './preview-deploy-gate.mjs';

export const TRUSTED_PREVIEW_BRANCH = 'fix/workflow-build-parity-592-20261012';
export const TRUSTED_PREVIEW_ALIAS =
  'mosaic-life-tracker-git-fix-work-73127a-carls-projects-72516fde.vercel.app';
export const TRUSTED_GITHUB_REPO_ID = 1361399135;
export const TRUSTED_VERCEL_PROJECT = 'mosaic-life-tracker';
export const SHA = /^[a-f0-9]{40}$/i;

export function assessTrustedPreviewTrigger({ event, repository, eventName, ref,
  checkoutSha, enabled, workflowRuns, checkRuns, branchHead }) {
  const reasons = [];
  const source = event?.workflow_run;
  if (eventName !== 'workflow_run' || repository !== 'carlers/mosaic-life-tracker')
    reasons.push('untrusted GitHub event or repository');
  if (ref !== 'refs/heads/main' || !SHA.test(checkoutSha ?? ''))
    reasons.push('trusted main workflow checkout required');
  if (enabled !== 'true') reasons.push('trusted Preview delivery disabled');
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

export function assertTrustedPreviewDeployment(deployment, sha) {
  const meta = deployment?.meta ?? {};
  if (!SHA.test(sha ?? '') || deployment?.projectId !== OFFICIAL_VERCEL_PROJECT_ID ||
      deployment?.readyState !== 'READY' ||
      deployment?.target === 'production' ||
      !['git', 'cli'].includes(deployment?.source) ||
      meta.githubCommitSha !== sha ||
      meta.githubOrg !== 'carlers' ||
      meta.githubRepo !== 'mosaic-life-tracker' ||
      ![TRUSTED_PREVIEW_BRANCH, 'HEAD'].includes(meta.githubCommitRef) ||
      !/^[a-z0-9-]+\.vercel\.app$/.test(deployment?.url ?? '') ||
      typeof deployment?.id !== 'string') {
    throw new Error('READY Vercel deployment identity did not match the trusted exact SHA');
  }
  return deployment.id;
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
