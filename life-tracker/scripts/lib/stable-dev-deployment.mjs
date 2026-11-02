// Stable installed-PWA origin, independent of immutable Vercel deployment URLs.
// Read-only contract: never assume READY means that the branch alias moved.
export const STABLE_DEV_ALIAS = 'mosaic-life-tracker-git-dev-carls-projects-72516fde.vercel.app';
export const MOSAIC_VERCEL_PROJECT = 'prj_jysOLDbuO9c5rP8x6Q145DVIw0fc';
export const MOSAIC_VERCEL_TEAM = 'team_UbpudOr8jXyrDA5SdVUxVGOr';
export const MOSAIC_GITHUB_REPO = 'carlers/mosaic-life-tracker';

const isSha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);

/** Validate the exact dev HEAD -> canonical CI -> READY Preview -> stable alias chain. */
export function assertStableDevDeployment({ headSha, aliasRecord, deployment, checks }) {
  if (!isSha(headSha)) throw new Error('Live dev SHA unavailable');
  if (!aliasRecord || aliasRecord.alias !== STABLE_DEV_ALIAS ||
      aliasRecord.projectId !== MOSAIC_VERCEL_PROJECT ||
      aliasRecord.redirect != null) {
    throw new Error('Stable dev hostname is not an owned non-redirecting alias');
  }
  const deploymentId = aliasRecord.deploymentId ?? aliasRecord.deployment?.id;
  if (!deploymentId || !deployment || deployment.id !== deploymentId ||
      deployment.projectId !== MOSAIC_VERCEL_PROJECT) {
    throw new Error('Stable dev alias is not mapped to the official deployment');
  }
  if ((deployment.readyState ?? deployment.state) !== 'READY' ||
      ![null, undefined, 'preview'].includes(deployment.target)) {
    throw new Error('Stable dev alias does not target a READY Preview build');
  }
  if (deployment.meta?.githubOrg !== 'carlers' ||
      deployment.meta?.githubRepo !== 'mosaic-life-tracker' ||
      deployment.meta?.githubCommitRef !== 'dev' ||
      deployment.meta?.githubCommitSha !== headSha) {
    throw new Error('Stable dev alias is stale or deployment Git identity is invalid');
  }
  if (!Array.isArray(checks?.check_runs) || checks.total_count > 100 ||
      !checks.check_runs.some(check =>
        check.name === 'canonical-acceptance' &&
        check.status === 'completed' && check.conclusion === 'success')) {
    throw new Error('Exact dev commit lacks successful canonical acceptance');
  }
  return { sha: headSha, deploymentId, alias: STABLE_DEV_ALIAS };
}
