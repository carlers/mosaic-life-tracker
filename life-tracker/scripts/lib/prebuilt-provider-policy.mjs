// Reviewed, default-main-only provider policy; never import candidate code.
export const VERCEL_TEAM_ID = 'team_UbpudOr8jXyrDA5SdVUxVGOr';
export const VERCEL_PROJECT_ID = 'prj_jysOLDbuO9c5rP8x6Q145DVIw0fc';
export const CANARY_BRANCH = 'fix/592-trusted-archive-20261014';
export const CANARY_ALIAS =
  'mosaic-life-tracker-git-fix-592-93fb02-carls-projects-72516fde.vercel.app';
const SHA = /^[a-f0-9]{40}$/i;
const ID = /^dpl_[a-zA-Z0-9]{8,}$/;
const STRICT_META = ['mosaic_prebuilt_sha', 'mosaic_prebuilt_run', 'mosaic_prebuilt_attempt'];
const states = new Set(['READY', 'QUEUED', 'BUILDING', 'INITIALIZING']);

export function assertPrebuiltProject(project) {
  const link = project?.link ?? {};
  if (project?.id !== VERCEL_PROJECT_ID ||
      project?.name !== 'mosaic-life-tracker' ||
      project?.rootDirectory !== 'life-tracker' ||
      link.type !== 'github' ||
      String(link.repoId) !== '1361399135' ||
      link.productionBranch !== 'main') {
    throw new Error('Unreviewed Vercel project, repository, root, or Production branch');
  }
  return true;
}

export function findPrebuiltCandidate(deployments, { sha, runId, attempt, branch }) {
  if (!Array.isArray(deployments) || !SHA.test(sha ?? '') ||
      branch !== CANARY_BRANCH || !Number.isSafeInteger(runId) || runId < 1 ||
      !Number.isSafeInteger(attempt) || attempt < 1)
    throw new Error('Incomplete provider idempotency request');
  const matches = deployments.filter(x => {
    if (!x || x.target === 'production' || x.target === 'staging' ||
        (x.source != null && x.source !== 'cli') ||
        (x.meta?.githubCommitSha != null && x.meta.githubCommitSha !== sha)) return false;
    const meta = x.meta ?? {};
    const exact = meta.mosaic_prebuilt_sha === sha &&
      String(meta.mosaic_prebuilt_run) === String(runId) &&
      String(meta.mosaic_prebuilt_attempt) === String(attempt);
    // Vercel LIST may omit custom CLI metadata; a matching CLI HEAD deploy
    // is deliberately treated as already deployed, never a green light to POST.
    const conservative = meta.githubCommitSha === sha &&
      meta.githubCommitRef === 'HEAD' &&
      meta.githubOrg === 'carlers' && meta.githubRepo === 'mosaic-life-tracker';
    return exact || conservative;
  });
  if (matches.length > 1) throw new Error('Ambiguous existing CLI Preview deployments');
  return matches[0] ?? null;
}

export function assertPrebuiltReady(deployment, { sha, runId, attempt }) {
  const meta = deployment?.meta ?? {};
  if (!ID.test(deployment?.id ?? '') ||
      deployment?.projectId !== VERCEL_PROJECT_ID ||
      deployment?.readyState !== 'READY' ||
      ![null, 'preview'].includes(deployment.target) ||
      deployment?.source !== 'cli' ||
      meta.mosaic_prebuilt_sha !== sha ||
      String(meta.mosaic_prebuilt_run) !== String(runId) ||
      String(meta.mosaic_prebuilt_attempt) !== String(attempt) ||
      !/^[a-z0-9-]+\.vercel\.app$/.test(deployment?.url ?? ''))
    throw new Error('Untrusted or non-Preview prebuilt deployment readback');
  return deployment;
}

export function prebuiltCliArgs({ sha, runId, attempt, branch }) {
  if (!SHA.test(sha ?? '') || branch !== CANARY_BRANCH ||
      !Number.isSafeInteger(runId) || runId < 1 ||
      !Number.isSafeInteger(attempt) || attempt < 1)
    throw new Error('Incomplete accepted Preview identity');
  return [
    'deploy', '--yes', '--prebuilt', '--target=preview', '--archive=tgz',
    '--no-color',
    '--meta', 'mosaic_prebuilt_sha=' + sha,
    '--meta', 'mosaic_prebuilt_run=' + String(runId),
    '--meta', 'mosaic_prebuilt_attempt=' + String(attempt),
    '--meta', 'mosaic_prebuilt_branch=' + branch,
  ];
}

export function decideProviderCreate({ enabled, aliasEnabled, canonicalEligible,
  artifactVerified, headStillCurrent, prior }) {
  if (!canonicalEligible || !artifactVerified || !headStillCurrent)
    return { action: 'reject', reason: 'unverified CI, build artifact or latest branch' };
  if (prior) return { action: 'reuse', id: prior.id };
  if (enabled !== 'true') return { action: 'shadow' };
  if (aliasEnabled !== 'true') return { action: 'create-without-alias' };
  return { action: 'create-then-alias' };
}

export function assertAliasTarget(aliases, id) {
  if (!ID.test(id ?? '') || !Array.isArray(aliases) ||
      !aliases.some(x => x?.alias === CANARY_ALIAS &&
        (!x.deploymentId || x.deploymentId === id)))
    throw new Error('Reviewed stable Preview alias does not point to accepted deployment');
  return true;
}

export function assertCanaryGitDisabled(highLevelConfig) {
  const enabled = highLevelConfig?.git?.deploymentEnabled;
  // Vercel minimatch is ADDITIVE: a matching true (e.g. "fix/*") wins
  // over any more-specific false. Use a non-overlapping extglob allow rule.
  const nonCanaryFix = 'fix/!(592-trusted-archive-20261014)';
  const allowed = {
    '*': false, main: true, dev: true, 'feature/*': true,
    [nonCanaryFix]: true, 'perf/*': true, 'security/*': true,
    'refactor/*': true, 'chatgpt/*': false, 'codex/*': false,
  };
  if (!enabled || typeof enabled !== 'object' || Array.isArray(enabled) ||
      Object.keys(enabled).length !== Object.keys(allowed).length ||
      Object.entries(allowed).some(([key, value]) => enabled[key] !== value) ||
      highLevelConfig?.framework !== 'vite' ||
      highLevelConfig?.outputDirectory !== 'dist') {
    throw new Error('Canary Git auto-deploy is not exclusively disabled with main/dev intact');
  }
  return true;
}
