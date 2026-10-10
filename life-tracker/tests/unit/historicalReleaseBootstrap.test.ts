import { describe, expect, it } from 'vitest';
import {
  FIRST_PRODUCTION_RELEASE, FIRST_PRODUCTION_NOTES,
  historicalBootstrapDecision, assertHistoricalProof,
} from '../../scripts/lib/historical-release-bootstrap.mjs';

const h = FIRST_PRODUCTION_RELEASE;
const goodProof = {
  pr: {
    number: 505, merged: true,
    merge_commit_sha: h.sha, base: { ref: 'main' },
  },
  run: { check_runs: [{
    name: 'canonical-acceptance', conclusion: 'success',
    head_sha: h.sha, app: { slug: 'github-actions' },
  }] },
  statuses: [{ context: 'Vercel', state: 'success', target_url: h.deploymentStatusUrl }],
  oldVersion: '0.6.2',
  releasedVersion: '0.12.1',
};
const args = {
  currentVersion: '0.12.1', previousVersion: '0.12.1',
  mergeBaseSha: h.sha, taggedSha: null, existingRelease: null, publishedVersions: [],
};

describe('one-time exact-SHA v0.12.1 release bootstrap', () => {
  it('pins original production commit, PR and readable release notes', () => {
    expect(h.sha).toBe('95c8b25edeba5e2730252f6d265d392949890caa');
    expect(h.promotionPr).toBe(505);
    expect(FIRST_PRODUCTION_NOTES).toContain('**Release history:**');
    expect(FIRST_PRODUCTION_NOTES).toContain('**Task productivity:**');
    expect(FIRST_PRODUCTION_NOTES).not.toContain('list remains empty');
    expect(FIRST_PRODUCTION_NOTES.split('\n')).toHaveLength(5);
  });

  it('only backfills the exact historical version after a version-neutral main promotion', () => {
    expect(historicalBootstrapDecision(args)).toBe('publish');
    expect(historicalBootstrapDecision({ ...args, currentVersion: '0.13.0' })).toBe('not-applicable');
    expect(historicalBootstrapDecision({ ...args, previousVersion: '0.6.2' })).toBe('not-applicable');
    expect(historicalBootstrapDecision({ ...args, taggedSha: h.sha })).toBe('publish');
    const release = { tag_name: 'v0.12.1', draft: false, prerelease: false, published_at: '2026-10-11T00:00:00Z' };
    expect(historicalBootstrapDecision({ ...args, taggedSha: h.sha, existingRelease: release })).toBe('already-published');
  });

  it('fails closed on lineage gaps, conflicting tags, missing tag or newer already-published version', () => {
    expect(() => historicalBootstrapDecision({ ...args, mergeBaseSha: 'another' })).toThrow(/ancestor/);
    expect(() => historicalBootstrapDecision({ ...args, taggedSha: 'other' })).toThrow(/tag/);
    expect(() => historicalBootstrapDecision({
      ...args, existingRelease: { tag_name: 'v0.12.1', draft: false, prerelease: false, published_at: 'today' },
    })).toThrow(/no resolvable/);
    expect(() => historicalBootstrapDecision({ ...args, publishedVersions: ['0.13.0'] })).toThrow(/newer/);
    expect(() => historicalBootstrapDecision({
      ...args, taggedSha: h.sha,
      existingRelease: { tag_name: 'v0.12.1', draft: true, prerelease: false, published_at: null },
    })).toThrow(/stable/);
  });

  it('requires accepted historical main PR, canonical CI, exact production deployment and versions', () => {
    expect(() => assertHistoricalProof(goodProof)).not.toThrow();
    expect(() => assertHistoricalProof({ ...goodProof, pr: { ...goodProof.pr, number: 999 } })).toThrow();
    expect(() => assertHistoricalProof({ ...goodProof, pr: { ...goodProof.pr, merge_commit_sha: 'other' } })).toThrow();
    expect(() => assertHistoricalProof({ ...goodProof, pr: { ...goodProof.pr, base: { ref: 'dev' } } })).toThrow();
    expect(() => assertHistoricalProof({ ...goodProof, run: { check_runs: [] } })).toThrow();
    expect(() => assertHistoricalProof({ ...goodProof, statuses: [{
      context: 'Vercel', state: 'success', target_url: 'https://unrelated.example',
    }] })).toThrow();
    expect(() => assertHistoricalProof({ ...goodProof, statuses: [{
      context: 'Vercel', state: 'pending', target_url: h.deploymentStatusUrl,
    }] })).toThrow();
    expect(() => assertHistoricalProof({ ...goodProof, oldVersion: '0.12.1' })).toThrow();
    expect(() => assertHistoricalProof({ ...goodProof, releasedVersion: '0.13.0' })).toThrow();
  });
});
