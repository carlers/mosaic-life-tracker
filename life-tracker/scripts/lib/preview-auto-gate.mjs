import { OFFICIAL_CANARY_REPO, OFFICIAL_VERCEL_ORG_ID, OFFICIAL_VERCEL_PROJECT_ID } from './preview-canary-context.mjs';

export const AUTO_PREVIEW_PILOT_BRANCH = 'fix/workflow-build-parity-592-20261012';
export const AUTO_PREVIEW_PILOT_ALIAS =
  'mosaic-life-tracker-git-fix-work-73127a-carls-projects-72516fde.vercel.app';
const SHA = /^[0-9a-f]{40}$/i;

export function assessAutomaticPreviewContext({
  repository, eventName, branch, sha, checkoutSha, ref, enabled,
  vercelOrgId, vercelProjectId,
}) {
  const reasons = [];
  if (repository !== OFFICIAL_CANARY_REPO) reasons.push('untrusted repository');
  if (eventName !== 'push') reasons.push('canonical push event required');
  if (branch !== AUTO_PREVIEW_PILOT_BRANCH) reasons.push('pilot branch is not authorized');
  if (!SHA.test(sha ?? '') || sha !== checkoutSha) reasons.push('exact checked-out SHA required');
  if (ref !== 'refs/heads/' + AUTO_PREVIEW_PILOT_BRANCH) reasons.push('pilot branch ref mismatch');
  if (enabled !== 'true') reasons.push('automatic Preview pilot disabled');
  if (vercelOrgId !== OFFICIAL_VERCEL_ORG_ID ||
      vercelProjectId !== OFFICIAL_VERCEL_PROJECT_ID) reasons.push('wrong Vercel scope');
  return { eligible: reasons.length === 0, reasons };
}

export function assertAutomaticPreviewContext(context) {
  const result = assessAutomaticPreviewContext(context);
  if (!result.eligible) throw new Error('Automatic Preview blocked: ' + result.reasons.join('; '));
  return result;
}

export function assertAutomaticPreviewDeployment(deployment, {
  hostname, branch, sha, alias,
}) {
  if (alias !== AUTO_PREVIEW_PILOT_ALIAS || branch !== AUTO_PREVIEW_PILOT_BRANCH ||
      !SHA.test(sha ?? '') || !/^[a-z0-9-]+\.vercel\.app$/.test(hostname ?? '')) {
    throw new Error('Automatic Preview target, alias, branch or SHA is invalid');
  }
  const meta = deployment?.meta ?? {};
  if (!deployment?.id || deployment.url !== hostname ||
      deployment.project?.id !== OFFICIAL_VERCEL_PROJECT_ID ||
      !['READY'].includes(deployment.readyState ?? deployment.state) ||
      deployment.target === 'production' ||
      deployment.source !== 'cli' ||
      meta.githubCommitSha !== sha || meta.githubCommitRef !== 'HEAD' ||
      meta.githubRepo !== 'mosaic-life-tracker' || meta.githubOrg !== 'carlers') {
    throw new Error('Automatic Preview deployment is not verified READY CLI evidence');
  }
  return deployment.id;
}
