// Read-only GitHub-side PR premerge evidence. This is NOT Vercel, Scratch,
// version-impact, human acceptance, or explicit merge authorization.
const SHA = /^[a-f0-9]{40}$/;
const STABLE = /^(feature|fix|perf|security|refactor)\/[a-zA-Z0-9._/-]+$/;
const VERSION = /^(\d+)\.(\d+)\.(\d+)$/;

function versionParts(value) {
  const match = VERSION.exec(value ?? '');
  return match ? match.slice(1).map(Number) : null;
}

export function evaluatePromotionPrEvidence(e) {
  const reasons = [];
  if (e?.baseBranch !== 'dev' && e?.baseBranch !== 'main') {
    reasons.push('unsupported promotion target');
  }
  if (e?.baseBranch === 'dev' && !STABLE.test(e?.headBranch ?? '')) {
    reasons.push('dev promotions must originate from a stable Preview');
  }
  if (e?.baseBranch === 'main' && e?.headBranch !== 'dev') {
    reasons.push('main promotions must originate from dev');
  }
  if (!e?.repository || e.headRepository !== e.repository || e.baseRepository !== e.repository) {
    reasons.push('cross-repository or missing PR provenance');
  }
  if (e?.draft !== false) reasons.push('draft or missing PR readiness');
  // Event payloads can become stale even when both branch tips stay unchanged:
  // reread the PR before reporting acceptance (draft, retargeting or closure).
  const live = e?.livePr;
  if (!live || live.number !== e.prNumber || live.state !== 'open' ||
      live.draft !== false || live.base?.sha !== e.baseSha ||
      live.head?.sha !== e.headSha || live.base?.ref !== e.baseBranch ||
      live.head?.ref !== e.headBranch ||
      live.base?.repo?.full_name !== e.repository ||
      live.head?.repo?.full_name !== e.repository) {
    reasons.push('current PR metadata missing or changed since event');
  }
  if (!SHA.test(e?.baseSha ?? '') || !SHA.test(e?.headSha ?? '')) {
    reasons.push('missing exact Git SHA');
  }
  if (e?.liveBaseSha !== e?.baseSha || e?.liveHeadSha !== e?.headSha) {
    reasons.push('PR base/source changed since the event');
  }
  if (e?.mergeConflict || !SHA.test(e?.mergedTree ?? '')) {
    reasons.push('Git integration conflict or missing merge-tree result');
  } else if (e.mergedTree !== e.sourceTree) {
    reasons.push('integration tree differs from accepted source; new Preview acceptance needed');
  }
  const checks = e?.checkRuns;
  const canonical = Array.isArray(checks)
    ? checks.filter(check => check?.name === 'canonical-acceptance' &&
        check.head_sha === e.headSha && check.app?.slug === 'github-actions')
        .sort((a, b) => (b.id ?? 0) - (a.id ?? 0))[0]
    : null;
  if (!canonical || canonical.status !== 'completed' || canonical.conclusion !== 'success') {
    reasons.push('latest exact-source GitHub Actions canonical acceptance missing or failed');
  }
  const current = versionParts(e?.baseVersion);
  const proposed = versionParts(e?.headVersion);
  if (!current || !proposed) {
    reasons.push('invalid or missing application version');
  } else {
    const compare = proposed[0] - current[0] || proposed[1] - current[1] || proposed[2] - current[2];
    if (compare < 0) reasons.push('application version regression');
  }
  return { passed: reasons.length === 0, reasons };
}
