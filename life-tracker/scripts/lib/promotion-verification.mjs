const ZERO_SHA = /^0+$/;

export const STABLE_PREVIEW_PREFIXES = [
  'feature/',
  'fix/',
  'perf/',
  'security/',
  'refactor/',
];

export function isStablePreviewBranch(branch) {
  return STABLE_PREVIEW_PREFIXES.some((prefix) => branch?.startsWith(prefix));
}

export function evaluatePromotionEvidence({
  targetBranch = 'dev',
  headSha,
  beforeSha = '',
  headCommit,
  sourceCommit,
  pulls = [],
  checkRuns = [],
}) {
  const parents = headCommit?.parents?.map((parent) => parent.sha) ?? [];
  const baseParent = parents[0] ?? '';
  const sourceSha = parents[1] ?? '';

  if (!headSha || headCommit?.sha !== headSha) {
    return { eligible: false, reason: 'promotion head commit mismatch' };
  }

  if (parents.length !== 2 || !sourceSha) {
    return { eligible: false, reason: 'promotion is not a two-parent merge commit' };
  }

  if (
    beforeSha &&
    !ZERO_SHA.test(beforeSha) &&
    beforeSha !== baseParent
  ) {
    return {
      eligible: false,
      reason: 'push before-SHA does not match the merge first parent',
      sourceSha,
    };
  }

  if (sourceCommit?.sha !== sourceSha) {
    return {
      eligible: false,
      reason: 'promotion source commit could not be resolved',
      sourceSha,
    };
  }

  const headTree = headCommit?.commit?.tree?.sha ?? '';
  const sourceTree = sourceCommit?.commit?.tree?.sha ?? '';
  if (!headTree || !sourceTree || headTree !== sourceTree) {
    return {
      eligible: false,
      reason: 'promotion merge tree differs from the stable Preview source tree',
      sourceSha,
    };
  }

  const promotionPr = pulls.find((pull) => {
    const sourceBranch = pull?.head?.ref ?? '';
    return (
      !!pull?.merged_at &&
      pull?.base?.ref === targetBranch &&
      pull?.head?.sha === sourceSha &&
      pull?.merge_commit_sha === headSha &&
      isStablePreviewBranch(sourceBranch)
    );
  });

  if (!promotionPr) {
    return {
      eligible: false,
      reason: 'no merged stable Preview pull request matches this promotion',
      sourceSha,
    };
  }

  const canonical = checkRuns.find(
    (check) =>
      check?.name === 'canonical-acceptance' &&
      check?.head_sha === sourceSha &&
      check?.status === 'completed' &&
      check?.conclusion === 'success'
  );

  if (!canonical) {
    return {
      eligible: false,
      reason: 'stable Preview source lacks successful canonical acceptance',
      sourceSha,
      sourceBranch: promotionPr.head.ref,
      prNumber: promotionPr.number,
    };
  }

  return {
    eligible: true,
    reason: 'stable Preview tree and canonical acceptance are reusable',
    sourceSha,
    sourceBranch: promotionPr.head.ref,
    prNumber: promotionPr.number,
  };
}
