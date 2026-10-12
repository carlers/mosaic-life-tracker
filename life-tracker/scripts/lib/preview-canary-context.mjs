import { isStablePreviewBranch } from './preview-deploy-gate.mjs';

export const OFFICIAL_CANARY_REPO = 'carlers/mosaic-life-tracker';
export const OFFICIAL_VERCEL_ORG_ID = 'team_UbpudOr8jXyrDA5SdVUxVGOr';
export const OFFICIAL_VERCEL_PROJECT_ID = 'prj_jysOLDbuO9c5rP8x6Q145DVIw0fc';

const SHA = /^[0-9a-f]{40}$/i;

export function assessPreviewCanaryContext({
  repository, eventName, branch, sha, checkoutSha, requestedSha,
  ref, enabled, vercelOrgId, vercelProjectId,
}) {
  const reasons = [];
  if (repository !== OFFICIAL_CANARY_REPO) reasons.push('untrusted repository');
  if (eventName !== 'workflow_dispatch') reasons.push('manual dispatch required');
  if (!isStablePreviewBranch(branch)) reasons.push('stable Preview branch required');
  if (!SHA.test(sha ?? '') || !SHA.test(checkoutSha ?? '') ||
      !SHA.test(requestedSha ?? '') ||
      sha !== checkoutSha || sha !== requestedSha) {
    reasons.push('exact checked-out, requested and workflow commit SHAs must match');
  }
  if (ref !== 'refs/heads/' + branch) reasons.push('workflow ref must match the Preview branch');
  if (enabled !== 'true') reasons.push('canary opt-in is disabled');
  if (vercelOrgId !== OFFICIAL_VERCEL_ORG_ID ||
      vercelProjectId !== OFFICIAL_VERCEL_PROJECT_ID) reasons.push('wrong Vercel project or scope');
  return { eligible: reasons.length === 0, reasons };
}

export function assertPreviewCanaryContext(context) {
  const result = assessPreviewCanaryContext(context);
  if (!result.eligible) throw new Error('Preview canary blocked: ' + result.reasons.join('; '));
  return result;
}

export function findExistingCanary(deployments, branch, sha) {
  if (!Array.isArray(deployments)) throw new Error('Authoritative Vercel deployment list required');
  if (!isStablePreviewBranch(branch) || !SHA.test(sha ?? '')) {
    throw new Error('Valid branch and exact commit required');
  }
  return deployments.find(deployment =>
    deployment?.meta?.mosaic_canary_sha === sha &&
    deployment?.meta?.mosaic_canary_branch === branch &&
    ['READY', 'BUILDING', 'QUEUED', 'INITIALIZING'].includes(deployment.readyState ?? deployment.state)
  ) ?? null;
}
