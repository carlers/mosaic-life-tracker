// Pure policy for Mosaic's three-day merged-branch cleanup.
// Never delete based on commit age, branch age, or naming alone.
export const RETENTION_MS = 72 * 60 * 60 * 1000;
export const TASK_PREFIXES = ['chatgpt/', 'codex/', 'task/'];
export const PREVIEW_PREFIXES = ['feature/', 'fix/', 'perf/', 'security/', 'refactor/'];

// GitHub's branch endpoint takes one URL path parameter. Git refs use a
// slash-delimited ref path instead (heads/category/name).
export function encodedBranchName(name) {
  return encodeURIComponent(name);
}

export function encodedRefPath(name) {
  return name.split('/').map(encodeURIComponent).join('/');
}

export function branchKind(name) {
  if (name === 'main' || name === 'dev') return 'permanent';
  if (TASK_PREFIXES.some((prefix) => name.startsWith(prefix) && name.length > prefix.length)) return 'task';
  if (PREVIEW_PREFIXES.some((prefix) => name.startsWith(prefix) && name.length > prefix.length)) return 'preview';
  return 'unmanaged';
}

function sameRepository(pr, side, repository) {
  return pr[side]?.repo?.full_name === repository;
}

export function assessBranch(branch, pullRequests, repository, nowMs) {
  const kind = branchKind(branch.name);
  if (kind === 'permanent') return { eligible: false, reason: 'permanent' };
  if (branch.protected) return { eligible: false, reason: 'protected' };
  if (kind === 'unmanaged') return { eligible: false, reason: 'unmanaged' };
  if (!Number.isFinite(nowMs) || !branch.commit?.sha) {
    return { eligible: false, reason: 'invalid-data' };
  }

  const active = pullRequests.some((pr) =>
    pr.state === 'open' && (
      (sameRepository(pr, 'head', repository) && pr.head.ref === branch.name) ||
      (sameRepository(pr, 'base', repository) && pr.base.ref === branch.name)
    ));
  if (active) return { eligible: false, reason: 'open-pr' };

  const matches = pullRequests.filter((pr) =>
    pr.merged_at &&
    pr.head?.ref === branch.name &&
    sameRepository(pr, 'head', repository) &&
    pr.head.sha === branch.commit.sha &&
    (kind === 'task' ? PREVIEW_PREFIXES.some((prefix) => pr.base?.ref?.startsWith(prefix)) : pr.base?.ref === 'dev') &&
    sameRepository(pr, 'base', repository) &&
    Number.isFinite(Date.parse(pr.merged_at))
  ).sort((a, b) => Date.parse(b.merged_at) - Date.parse(a.merged_at));

  const newest = matches[0];
  if (!newest) return { eligible: false, reason: 'no-merged-pr-for-head' };
  const age = nowMs - Date.parse(newest.merged_at);
  if (age < RETENTION_MS) return { eligible: false, reason: 'within-72-hours' };
  return {
    eligible: true,
    reason: 'expired-merged-branch',
    mergedAt: newest.merged_at,
    pr: newest.number,
    sha: branch.commit.sha,
    kind,
  };
}
