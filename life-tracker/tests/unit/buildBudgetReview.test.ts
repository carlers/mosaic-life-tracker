import { describe, expect, it } from 'vitest';
import { assertAcceptedMainBudgetInheritance, assertReviewedBudgetChange } from '../../scripts/lib/build-budget-review.mjs';

const metrics = {
  entryRawBytes: 100, entryGzipBytes: 50, initialClosureGzipBytes: 60,
  homeClosureGzipBytes: 80, appAssetsRawBytes: 200, appAssetsGzipBytes: 90,
  precacheUniqueBytes: 240,
};
const budget = {
  schemaVersion: 2,
  baseline: { measuredAt: '2026-10-03', commit: 'reference', metrics },
  limits: Object.fromEntries(Object.entries(metrics).map(([key, value]) => [key, value + 10])),
};
const raised = { ...budget, limits: { ...budget.limits, homeClosureGzipBytes: 120 } };
const reviewed = {
  ...raised,
  review: {
    issue: '#592',
    reason: 'Measured and intentionally reviewed Home route dependency increase',
    evidence: 'https://github.com/example/repo/actions/runs/123',
    metrics: ['homeClosureGzipBytes'],
    previousLimits: { homeClosureGzipBytes: 90 },
  },
};
describe('reviewed build-size budget changes', () => {
  it('allows unchanged limits or tighter ceilings without paperwork', () => {
    expect(assertReviewedBudgetChange(budget, budget).changed).toEqual([]);
    expect(assertReviewedBudgetChange(budget, { ...budget, limits: { ...budget.limits, entryRawBytes: 105 } }).changed)
      .toEqual(['entryRawBytes']);
  });
  it('rejects silent inflation, stale justification and fabricated previous bounds', () => {
    expect(() => assertReviewedBudgetChange(budget, raised)).toThrow(/review record/);
    expect(() => assertReviewedBudgetChange(budget, { ...reviewed, review: { ...reviewed.review, previousLimits: { homeClosureGzipBytes: 1 } } })).toThrow(/review record/);
    expect(() => assertReviewedBudgetChange(reviewed, reviewed)).not.toThrow();
    expect(() => assertReviewedBudgetChange(reviewed, { ...reviewed, limits: { ...reviewed.limits, homeClosureGzipBytes: 121 } })).toThrow(/review record/);
  });
  it('rejects baseline resets even when numerical ceilings pass', () => {
    expect(() => assertReviewedBudgetChange(budget, {
      ...budget, baseline: { ...budget.baseline, measuredAt: '2026-10-11' },
    })).toThrow(/baseline changed/);
  });
  it('rejects a silent switch to nonblocking metrics and accepts fully reviewed policy changes', () => {
    const next = { ...budget, blockingMetrics: ['initialClosureGzipBytes', 'homeClosureGzipBytes'] };
    expect(() => assertReviewedBudgetChange(budget, next)).toThrow(/policyReview/);
    const policyReview = {
      issue: '#784',
      reason: 'The controlled Chromium regression established measurable eager dependency loading cost',
      evidence: 'https://github.com/carlers/mosaic-life-tracker/actions/runs/38426273139',
      previousBlockingMetrics: Object.keys(metrics),
      nextBlockingMetrics: next.blockingMetrics,
    };
    expect(assertReviewedBudgetChange(budget, { ...next, policyReview }).policyChanged).toBe(true);
    expect(() => assertReviewedBudgetChange(budget, {
      ...next, policyReview: { ...policyReview, previousBlockingMetrics: ['entryRawBytes'] },
    })).toThrow(/policyReview/);
    expect(() => assertReviewedBudgetChange(budget, {
      ...next, policyReview: { ...policyReview, evidence: 'not a link' },
    })).toThrow(/policyReview/);
    expect(() => assertReviewedBudgetChange({ ...next, policyReview }, {
      ...next, policyReview: { ...policyReview, reason: 'silent metadata tampering' },
    })).toThrow(/metadata/);
  });

  it('accepts explicitly documented reviewed growth without making the guard permissive', () => {
    expect(assertReviewedBudgetChange(budget, reviewed).increased).toEqual(['homeClosureGzipBytes']);
  });
});

describe('exact-tree accepted main budget inheritance (#592)', () => {
  it('accepts inherited source ceilings only after canonical acceptance and identical tree proof', () => {
    const inherited = { sourceAccepted: true, exactSourceTree: true, sourceBudget: raised, candidate: raised };
    expect(assertAcceptedMainBudgetInheritance(inherited).inherited).toBe(true);
    expect(() => assertAcceptedMainBudgetInheritance({ ...inherited, sourceAccepted: false })).toThrow(/accepted exact source tree/);
    expect(() => assertAcceptedMainBudgetInheritance({ ...inherited, exactSourceTree: false })).toThrow(/accepted exact source tree/);
    expect(() => assertAcceptedMainBudgetInheritance({ ...inherited, candidate: budget })).toThrow(/accepted exact source tree/);
  });

  it('does not silently approve the same increase without source proof', () => {
    expect(() => assertReviewedBudgetChange(budget, raised)).toThrow(/review record/);
  });
});
