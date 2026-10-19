// Read-only GitHub-side PR premerge evidence. This is NOT Vercel, Scratch,
// version-impact, human acceptance, or explicit merge authorization.
const SHA = /^[a-f0-9]{40}$/;
const STABLE = /^(feature|fix|perf|security|refactor)\/[a-zA-Z0-9._/-]+$/;
const DOGFOOD = 'feature/dogfood';
const VERSION = /^(\d+)\.(\d+)\.(\d+)$/;
const CANONICAL_REASON = 'latest exact-source GitHub Actions canonical acceptance missing or failed';

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
  if (e?.baseBranch === 'dev' && e?.headBranch === DOGFOOD) {
    reasons.push('experimental dogfood cannot promote directly to dev');
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
  if (latestCanonicalState(e) !== 'success') {
    reasons.push(CANONICAL_REASON);
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

// Inspect only the newest exact-SHA GitHub Actions acceptance, never an older
// successful run or a similarly named check from another app/commit.
export function latestCanonicalState(e) {
  const checks = e?.checkRuns;
  const canonical = Array.isArray(checks)
    ? checks.filter(check => check?.name === 'canonical-acceptance' &&
        check.head_sha === e.headSha && check.app?.slug === 'github-actions')
        .sort((a, b) => (b.id ?? 0) - (a.id ?? 0))[0]
    : null;
  if (!canonical) return 'missing';
  if (canonical.status !== 'completed') return 'pending';
  return canonical.conclusion === 'success' ? 'success' : 'failed';
}

// A new dev push and its PR synchronize event may race the exact-SHA
// canonical job. Wait only while that is the *sole* reason for rejection.
// Reread PR/branch metadata on every attempt and stop immediately on drift,
// a terminal failure, or the bounded deadline. This is not an approval gate.
export async function waitForPromotionCanonicalEvidence({
  evidence, refresh, sleep, maxAttempts = 15, intervalMs = 10_000,
}) {
  for (let attempt = 1; attempt < maxAttempts; attempt += 1) {
    const result = evaluatePromotionPrEvidence(evidence);
    if (result.passed || result.reasons.length !== 1 ||
        result.reasons[0] !== CANONICAL_REASON ||
        latestCanonicalState(evidence) === 'failed') {
      return result;
    }
    await sleep(intervalMs);
    evidence = await refresh();
  }
  return evaluatePromotionPrEvidence(evidence);
}
