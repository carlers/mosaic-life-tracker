const OFFICIAL_REPOSITORY = 'carlers/mosaic-life-tracker';
const CANONICAL_WORKFLOW = '.github/workflows/quality-gate.yml';
const COMMIT = /^[a-f0-9]{40}$/i;
const PREVIEW_BRANCH = /^(?:feature|fix|perf|security|refactor)\/[a-z0-9][a-z0-9._/-]*$/;

export function isStablePreviewBranch(branch) {
  return typeof branch === 'string' && PREVIEW_BRANCH.test(branch) &&
    !branch.includes('//') && !branch.includes('..') && !branch.endsWith('/');
}

// All inputs are data collected from GitHub's read-only API; no YAML-controlled
// boolean, caller-supplied "passed" flag, or standalone build job can substitute
// for the accepted exact-SHA canonical check suite.
export function assessPreviewDeployGate({ repository, branch, sha, headSha, workflowRuns, checkRuns, currentRunId }) {
  const reasons = [];
  if (repository !== OFFICIAL_REPOSITORY) reasons.push('untrusted repository');
  if (!isStablePreviewBranch(branch)) reasons.push('not a stable Preview branch');
  if (!COMMIT.test(sha ?? '')) reasons.push('invalid requested SHA');
  if (!COMMIT.test(headSha ?? '') || headSha !== sha) reasons.push('branch head advanced or could not be verified');
  if (!Array.isArray(workflowRuns) || !Array.isArray(checkRuns)) {
    reasons.push('missing authoritative GitHub checks');
    return { eligible: false, reasons, acceptedRunId: null };
  }
  const matching = workflowRuns.filter(run =>
    run && run.name === 'Quality Gate' && run.path === CANONICAL_WORKFLOW &&
    run.head_sha === sha && run.head_branch === branch && run.event === 'push' &&
    Number.isSafeInteger(run.id) && Number.isSafeInteger(run.check_suite_id)
  ).sort((left, right) => right.id - left.id);
  const latest = matching[0];
  if (!latest) reasons.push('no exact-SHA canonical Quality Gate run');
  else {
    // A trusted same-workflow auto Preview job runs *after* canonical-acceptance
    // has completed but *before* its own parent Quality Gate run can become
    // completed. This exceptional in-flight mode still requires the exact
    // same check suite's successful canonical-acceptance and branch HEAD.
    const inFlightAccepted = Number.isSafeInteger(currentRunId) &&
      latest.id === currentRunId && latest.status === 'in_progress' &&
      latest.conclusion == null;
    if (!inFlightAccepted &&
        (latest.status !== 'completed' || latest.conclusion !== 'success')) {
      reasons.push('latest exact-SHA canonical Quality Gate is not successful');
    }
    if (!checkRuns.some(check => check && check.name === 'canonical-acceptance' &&
      check.head_sha === sha && check.status === 'completed' &&
      check.conclusion === 'success' && check.app?.slug === 'github-actions' &&
      check.check_suite?.id === latest.check_suite_id)) {
      reasons.push('missing passing canonical-acceptance in the same check suite');
    }
  }
  return { eligible: reasons.length === 0, reasons, acceptedRunId: latest?.id ?? null };
}

export function assertPreviewDeployGate(evidence) {
  const result = assessPreviewDeployGate(evidence);
  if (!result.eligible) {
    throw new Error('Preview deployment blocked: ' + result.reasons.join('; '));
  }
  return result;
}
