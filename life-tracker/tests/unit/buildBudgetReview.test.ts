import { describe, expect, it } from 'vitest';
import { assertReviewedBudgetChange } from '../../scripts/lib/build-budget-review.mjs';

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
  it('accepts explicitly documented reviewed growth without making the guard permissive', () => {
    expect(assertReviewedBudgetChange(budget, reviewed).increased).toEqual(['homeClosureGzipBytes']);
  });
});
