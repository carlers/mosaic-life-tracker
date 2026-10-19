import { compareFeaturePresence } from './build-feature-parity.mjs';

// Read-only, fail-closed decision. The caller owns live GitHub/Vercel evidence and
// a non-mutating git merge-tree calculation. No token, secret value or API body is logged.
export function evaluatePromotionPreflight(e) {
  const reasons = [];
  const required = [e?.sourceBranch, e?.sourceSha, e?.sourceTree, e?.targetSha, e?.expectedTargetSha];
  if (required.some(value => typeof value !== 'string' || !value)) {
    return { outcome: 'blocked', reasons: ['missing exact branch/SHA/tree evidence'] };
  }
  if (!/^(feature|fix|perf|security|refactor)\//.test(e.sourceBranch)) {
    reasons.push('source is not a stable Preview branch');
  }
  if (e.sourceBranch === 'feature/dogfood') {
    reasons.push('dogfood is experimental and cannot be used as a dev promotion source');
  }
  if (e.targetSha !== e.expectedTargetSha) reasons.push('dev advanced since the requested base SHA');
  if (e.targetBranch !== 'dev') reasons.push('this preflight only handles dev promotions');
  if (e.latestSourceSha !== e.sourceSha) reasons.push('stable Preview source moved during preflight');
  if (e.latestTargetSha !== e.targetSha) reasons.push('dev moved during preflight');
  if (!Array.isArray(e.checkRuns) || !e.checkRuns.some(c =>
    c.name === 'canonical-acceptance' &&
    c.head_sha === e.sourceSha &&
    c.status === 'completed' && c.conclusion === 'success'
  )) reasons.push('exact stable Preview canonical acceptance missing');
  const deployment = e.deployment;
  if (!deployment || deployment.state !== 'READY' ||
    deployment.sha !== e.sourceSha || deployment.branch !== e.sourceBranch ||
    deployment.target === 'production') {
    reasons.push('matching exact-SHA Preview Vercel READY deployment missing');
  }
  if (!Array.isArray(e.sanitizedEnvScopes) || e.sanitizedEnvScopes.some(r => r && 'value' in r)) {
    reasons.push('missing sanitized, value-free Vercel feature scope evidence');
  } else {
    try {
      if (!compareFeaturePresence(e.sanitizedEnvScopes, e.sourceBranch, 'dev').passed) {
        reasons.push('Preview/dev build feature scopes diverge');
      }
    } catch {
      reasons.push('invalid Vercel feature scope evidence');
    }
  }
  const semver = version => /^\d+\.\d+\.\d+$/.test(version ?? '') ? version.split('.').map(Number) : null;
  const sourceVersion = semver(e.sourceVersion);
  const targetVersion = semver(e.targetVersion);
  if (!sourceVersion || !targetVersion) {
    reasons.push('missing valid version evidence');
  } else {
    const comparison = sourceVersion[0] - targetVersion[0] ||
      sourceVersion[1] - targetVersion[1] ||
      sourceVersion[2] - targetVersion[2];
    if (!['none', 'user-visible'].includes(e.versionImpact) ||
      (e.versionImpact === 'none' && comparison !== 0) ||
      (e.versionImpact === 'user-visible' && comparison <= 0)) {
      reasons.push('version impact/monotonicity contract does not match source and dev');
    }
  }
  if (e.backendDependent === true &&
    (!e.expectedScratchDeployment || !e.observedScratchDeployment ||
      e.expectedScratchDeployment !== e.observedScratchDeployment)) {
    reasons.push('backend-dependent acceptance has no matching live Scratch deployment');
  }
  if (e.backendDependent !== true && e.backendDependent !== false) {
    reasons.push('backend dependency classification is required');
  }
  if (e.mergeConflict === true) reasons.push('Git merge-tree reports a conflict');
  if (!e.mergedTree) reasons.push('Git merge-tree result is missing');
  if (reasons.length) return { outcome: 'blocked', reasons };
  if (e.mergedTree !== e.sourceTree) {
    return { outcome: 'requires-integration', reasons: ['merged tree differs from accepted Preview; build a new integrated Preview and reaccept'] };
  }
  return { outcome: 'safe-to-request-approval', reasons: [], targetSha: e.targetSha, sourceSha: e.sourceSha };
}
