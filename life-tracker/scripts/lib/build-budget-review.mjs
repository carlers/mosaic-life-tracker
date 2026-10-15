import { BUILD_SIZE_METRICS, validateBuildSizeBudget } from './build-size-guard.mjs';

const unchanged = (left, right) => JSON.stringify(left) === JSON.stringify(right);

export function assertReviewedBudgetChange(previous, candidate) {
  validateBuildSizeBudget(previous);
  validateBuildSizeBudget(candidate);
  if (unchanged(previous, candidate)) return { changed: [] };
  // A new performance baseline is a separate, explicitly measured governance task.
  if (!unchanged(previous.baseline, candidate.baseline)) {
    throw new Error('Build-size baseline changed; preserve the pinned measured baseline and review separately');
  }
  const changed = BUILD_SIZE_METRICS.filter(metric => previous.limits[metric] !== candidate.limits[metric]);
  const oldBlocking = previous.blockingMetrics ?? BUILD_SIZE_METRICS;
  const newBlocking = candidate.blockingMetrics ?? BUILD_SIZE_METRICS;
  const policyChanged = !unchanged(oldBlocking, newBlocking);
  if (policyChanged) {
    const record = candidate.policyReview;
    if (!record || unchanged(previous.policyReview, record) ||
        !/^#[1-9]\d*$/.test(record.issue ?? '') ||
        typeof record.reason !== 'string' || record.reason.trim().length < 30 ||
        typeof record.evidence !== 'string' || !/^https:\/\//.test(record.evidence) ||
        !unchanged(record.previousBlockingMetrics, oldBlocking) ||
        !unchanged(record.nextBlockingMetrics, newBlocking)) {
      throw new Error('Changing blocking size metrics requires a new policyReview with issue, reason, evidence and exact previous/next metric sets');
    }
  } else if (!unchanged(previous.policyReview, candidate.policyReview)) {
    throw new Error('Policy review metadata changed without a blocking policy change');
  }
  if (!changed.length && !policyChanged) throw new Error('Budget changed without a limit or reviewed policy change; review unexpected metadata edits');
  const increased = changed.filter(metric => candidate.limits[metric] > previous.limits[metric]);
  if (increased.length) {
    const review = candidate.review;
    const error = 'Raising build-size ceilings requires a new, metric-specific review record (issue, reason, evidence, previous limits)';
    if (!review || typeof review !== 'object' || unchanged(previous.review, review) ||
      !/^#[1-9]\d*$/.test(review.issue ?? '') ||
      typeof review.reason !== 'string' || review.reason.trim().length < 30 ||
      typeof review.evidence !== 'string' || !/^https:\/\//.test(review.evidence) ||
      !Array.isArray(review.metrics) ||
      [...review.metrics].sort().join('|') !== [...increased].sort().join('|') ||
      !review.previousLimits || typeof review.previousLimits !== 'object' ||
      increased.some(metric => review.previousLimits[metric] !== previous.limits[metric])) {
      throw new Error(error);
    }
  }
  return { changed, increased, policyChanged };
}


/**
 * A production promotion may inherit ceilings already accepted by the exact
 * second-parent dev tree. This is NOT permission to raise caps in a merge.
 * Its caller must first verify the source's canonical GitHub acceptance and
 * the identity of both Git trees; any mismatch fails closed.
 */
export function assertAcceptedMainBudgetInheritance({
  sourceAccepted, exactSourceTree, sourceBudget, candidate,
}) {
  if (sourceAccepted !== true || exactSourceTree !== true ||
      !unchanged(sourceBudget, candidate)) {
    throw new Error('Main release budget differs from an accepted exact source tree');
  }
  validateBuildSizeBudget(sourceBudget);
  return { inherited: true };
}
