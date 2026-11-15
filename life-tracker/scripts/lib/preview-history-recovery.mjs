// Bounded evidence-based active Preview recovery. Never infer a release from
// a branch name, a version string or an unverified GitHub commit alone.
const SHA = /^[a-f0-9]{40}$/;
const DEPLOYMENT_ID = /^dpl_[A-Za-z0-9]{8,64}$/;

// The inventory only discovers candidates. The trusted publisher independently
// reads the exact deployment and applies this full identity check before writes.
export function isExactReadyPreviewDeployment(dep, { id, sha, branch, projectId }) {
  if (!DEPLOYMENT_ID.test(id ?? '') ||
      (dep?.id ?? dep?.uid) !== id ||
      (dep?.readyState ?? dep?.state) !== 'READY' ||
      (dep?.projectId ?? dep?.project?.id) !== projectId ||
      ![null, undefined, 'preview'].includes(dep?.target)) return false;
  const meta = dep.meta || {};
  // Reject internally conflicting source metadata even if a fallback matches.
  for (const [field, expected] of [
    ['mosaicPrebuiltSha', sha], ['mosaicPrebuiltBranch', branch],
    ['githubCommitSha', sha], ['githubCommitRef', branch],
    ['githubOrg', 'carlers'], ['githubRepo', 'mosaic-life-tracker'],
  ]) {
    if (meta[field] != null && meta[field] !== expected) return false;
  }
  return (meta.mosaicPrebuiltSha === sha && meta.mosaicPrebuiltBranch === branch) ||
    (meta.githubCommitSha === sha && meta.githubCommitRef === branch);
}
const STABLE = /^(feature|fix|perf|security|refactor)\/[a-zA-Z0-9][a-zA-Z0-9._/-]{0,159}$/;

export function selectPendingPreviewCandidates(branches, deployments, existingEvents, limit = 25) {
  if (!Array.isArray(branches) || !Array.isArray(deployments) ||
      !Array.isArray(existingEvents) || !Number.isSafeInteger(limit) ||
      limit < 1 || limit > 100) throw new Error('Invalid Preview recovery inventory');
  const active = new Map();
  for (const branch of branches) {
    if (!STABLE.test(branch?.name ?? '') || !SHA.test(branch?.commit?.sha ?? '')) continue;
    active.set(branch.name, branch.commit.sha);
  }
  const already = new Set(existingEvents.map(event => event?.id));
  const candidates = new Map();
  for (const dep of deployments) {
    if ((dep?.readyState ?? dep?.state) !== 'READY' ||
        (dep.target != null && dep.target !== 'preview')) continue;
    const meta = dep.meta || {};
    const branch = meta.mosaicPrebuiltBranch || meta.githubCommitRef;
    const sha = meta.mosaicPrebuiltSha || meta.githubCommitSha;
    if (!active.has(branch) || active.get(branch) !== sha ||
        !SHA.test(sha) || already.has('preview:' + sha)) continue;
    const deploymentId = dep.id ?? dep.uid;
    if (!DEPLOYMENT_ID.test(deploymentId ?? '')) continue;
    const created = Number(dep.created ?? dep.createdAt);
    if (!Number.isFinite(created)) continue;
    const key = branch + ':' + sha;
    const old = candidates.get(key);
    if (!old || created > old.created) candidates.set(key, { branch, sha, created, deploymentId });
  }
  return [...candidates.values()].sort((a,b) =>
    b.created - a.created || a.branch.localeCompare(b.branch)).slice(0,limit);
}
