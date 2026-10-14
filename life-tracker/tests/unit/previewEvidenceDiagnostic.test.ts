import { describe, expect, it } from 'vitest';
import { validateBuildEvidence } from '../../scripts/lib/preview-evidence-schema.mjs';

const sha = 'a'.repeat(40);
const fixture = (ref: string) => ({
  schemaVersion: 1, kind: 'non-deployable-ci-build-evidence',
  deploymentAuthorized: false, source: { sha, ref },
  buildProfile: { environment: 'untrusted-ci-diagnostic', nodeMajor: 24,
    giphy: 'enabled', posthog: 'enabled' },
  inventory: { digest: 'b'.repeat(64), count: 161 },
  jsCssFingerprint: 'c'.repeat(64),
  metrics: { initialClosureGzipBytes: 146064 },
});

describe('read-only AI diagnostics never authorize provider deployment (#592)', () => {
  it('allows non-deployable full CI diagnostic evidence for quiet task branches', () => {
    for (const branch of ['chatgpt/592-dev-ci-producer-20261014',
      'codex/feature-repair', 'fix/reviewed-stable', 'feature/other', 'dev', 'main']) {
      const ref = 'refs/heads/' + branch;
      expect(validateBuildEvidence(fixture(ref), { sha, ref }))
        .toMatchObject({ deploymentAuthorized: false });
    }
  });
  it('rejects malicious or unapproved source identities', () => {
    for (const ref of ['refs/heads/chatgpt/', 'refs/heads/codex/',
      'refs/heads/chatgpt/a//b', 'refs/heads/chatgpt/../wrong',
      'refs/heads/chatgpt/Bad', 'refs/heads/random/task',
      'refs/tags/v0.17.4', 'refs/heads/chatgpt/bad/']) {
      expect(() => validateBuildEvidence(fixture(ref))).toThrow(/Untrusted source/);
    }
  });
  it('still refuses authorization, source SHA substitution and stable ref spoofing', () => {
    const ref = 'refs/heads/chatgpt/quiet-probe';
    expect(() => validateBuildEvidence({
      ...fixture(ref), deploymentAuthorized: true,
    })).toThrow(/not a deployment authorization/);
    expect(() => validateBuildEvidence(fixture(ref),
      { sha, ref: 'refs/heads/feature/trusted' })).toThrow(/source ref mismatch/);
    expect(() => validateBuildEvidence(fixture(ref),
      { sha: 'f'.repeat(40), ref })).toThrow(/source SHA mismatch/);
  });
});
