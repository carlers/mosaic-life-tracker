import { describe, expect, it } from 'vitest';
import { assessBranch, branchKind, encodedBranchName, encodedRefPath, RETENTION_MS } from '../../scripts/lib/branch-hygiene.mjs';

const repo = 'carlers/mosaic-life-tracker';
const now = Date.parse('2026-10-11T12:00:00Z');
const branch = (name = 'chatgpt/example', sha = 'abc') => ({
  name, protected: false, commit: { sha },
});
const pr = (name = 'chatgpt/example', options: {
  sha?: string;
  base?: string;
  merged?: string | null;
  state?: string;
  number?: number;
} = {}) => ({
  number: options.number ?? 12,
  state: options.state ?? 'closed',
  merged_at: options.merged === undefined ?
    new Date(now - RETENTION_MS - 1000).toISOString() : options.merged,
  head: { ref: name, sha: options.sha ?? 'abc', repo: { full_name: repo } },
  base: { ref: options.base ?? 'feature/example', repo: { full_name: repo } },
});

describe('Mosaic branch hygiene (docs/DELIVERY.md)', () => {
  it('encodes GitHub branch path parameters without changing git-ref slash semantics', () => {
    expect(encodedBranchName('chatgpt/example')).toBe('chatgpt%2Fexample');
    expect(encodedBranchName('feature/two words')).toBe('feature%2Ftwo%20words');
    expect(encodedRefPath('chatgpt/example')).toBe('chatgpt/example');
    expect(encodedRefPath('feature/two words')).toBe('feature/two%20words');
  });

  it('always preserves permanent, protected, and unmanaged branches', () => {
    for (const name of ['main', 'dev', 'experimental']) {
      expect(assessBranch(branch(name), [pr(name)], repo, now).eligible).toBe(false);
    }
    expect(assessBranch({ ...branch(), protected: true }, [pr()], repo, now).reason)
      .toBe('protected');
    expect(branchKind('feature/example')).toBe('preview');
    expect(branchKind('codex/example')).toBe('task');
    expect(branchKind('task/example')).toBe('task');
    expect(branchKind('security/example')).toBe('preview');
  });

  it('deletes only a 72-hour-old merged task PR with the exact branch head', () => {
    const result = assessBranch(branch(), [pr()], repo, now);
    expect(result).toMatchObject({ eligible: true, pr: 12, sha: 'abc', kind: 'task' });
    expect(assessBranch(branch(), [pr('chatgpt/example', { sha: 'old' })], repo, now).eligible)
      .toBe(false);
  });

  it('requires Preview promotion to dev before the 72-hour countdown', () => {
    const name = 'feature/example';
    expect(assessBranch(branch(name), [pr(name, { base: 'dev' })], repo, now).eligible)
      .toBe(true);
    expect(assessBranch(branch(name), [pr(name, { base: 'main' })], repo, now).eligible)
      .toBe(false);
    expect(assessBranch(branch(name), [pr(name, { base: 'feature/other' })], repo, now).eligible)
      .toBe(false);
  });

  it('does not delete active source or target branches', () => {
    const merged = pr();
    const openHead = pr('chatgpt/example', { state: 'open', merged: null });
    const openBase = pr('some-other', { state: 'open', merged: null, base: 'chatgpt/example' });
    expect(assessBranch(branch(), [merged, openHead], repo, now).reason).toBe('open-pr');
    expect(assessBranch(branch(), [merged, openBase], repo, now).reason).toBe('open-pr');
  });

  it('waits a full three days after the latest qualifying merge', () => {
    const older = pr();
    const recent = pr('chatgpt/example', {
      merged: new Date(now - RETENTION_MS + 1000).toISOString(), number: 13,
    });
    expect(assessBranch(branch(), [older, recent], repo, now).reason)
      .toBe('within-72-hours');
    const exact = pr('chatgpt/example', {
      merged: new Date(now - RETENTION_MS).toISOString(),
    });
    expect(assessBranch(branch(), [exact], repo, now).eligible).toBe(true);
  });

  it('preserves missing, unmerged, wrong-target, foreign and future evidence', () => {
    const cases = [
      [],
      [pr('chatgpt/example', { merged: null })],
      [pr('chatgpt/example', { base: 'dev' })],
      [pr('chatgpt/example', { merged: new Date(now + 1000).toISOString() })],
      [{ ...pr(), head: { ref: 'chatgpt/example', sha: 'abc',
        repo: { full_name: 'someone/fork' } } }],
    ];
    for (const prs of cases) {
      expect(assessBranch(branch(), prs, repo, now).eligible).toBe(false);
    }
  });

  it('preserves a branch if its merged PR was not for its current SHA', () => {
    const changedBranch = branch('feature/example', 'new');
    expect(assessBranch(changedBranch, [pr('feature/example', {
      base: 'dev', sha: 'old',
    })], repo, now).reason).toBe('no-merged-pr-for-head');
  });
});
