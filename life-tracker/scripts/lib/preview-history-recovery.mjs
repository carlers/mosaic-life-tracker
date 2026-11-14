// Bounded evidence-based active Preview recovery. Never infer a release from
// a branch name, a version string or an unverified GitHub commit alone.
const SHA = /^[a-f0-9]{40}$/;
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
    const created = Number(dep.created ?? dep.createdAt);
    if (!Number.isFinite(created)) continue;
    const key = branch + ':' + sha;
    const old = candidates.get(key);
    if (!old || created < old.created) candidates.set(key, { branch, sha, created });
  }
  return [...candidates.values()].sort((a,b) =>
    a.created - b.created || a.branch.localeCompare(b.branch)).slice(0,limit);
}
