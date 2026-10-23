import { describe, expect, it } from 'vitest';
import { assertExactCoreArtifact, CORE_ARTIFACT_ENTRIES, CORE_BRANCH,
  CORE_SUPABASE_ORIGIN } from '../../scripts/lib/supabase-core-artifact-stage.mjs';

const sha = 'a'.repeat(40);
const zipDigest = 'b'.repeat(64);
const evidence = {
  schemaVersion: 1, kind: 'non-deployable-ci-build-evidence', deploymentAuthorized: false,
  source: { sha, ref: 'refs/heads/' + CORE_BRANCH },
  buildProfile: {
    environment: 'untrusted-ci-diagnostic', vercelEnvironment: 'preview',
    backend: 'supabase-cloud', featureProfile: 'core-diary', appwriteBackend: 'none',
    supabaseOrigin: CORE_SUPABASE_ORIGIN, publishableKeySha256: 'c'.repeat(64),
    giphy: 'disabled', posthog: 'disabled',
  },
};
const valid = () => ({ sha, zipDigest, entries: [...CORE_ARTIFACT_ENTRIES],
  evidence: structuredClone(evidence) });

describe('isolated Supabase exact CI artifact stage boundary (#1027)', () => {
  it('accepts only the fixed branch, source SHA, public core provider profile and exact artifact names', () => {
    expect(assertExactCoreArtifact(valid())).toEqual({
      sha, ref: 'refs/heads/' + CORE_BRANCH,
    });
  });
  it('refuses a different accepted SHA, branch, tampered artifact member or unbound ZIP digest', () => {
    expect(() => assertExactCoreArtifact({ ...valid(), sha: 'd'.repeat(40) }))
      .toThrow('provenance mismatch');
    expect(() => assertExactCoreArtifact({ ...valid(), zipDigest: 'invalid' }))
      .toThrow('digest required');
    expect(() => assertExactCoreArtifact({ ...valid(), entries: [...CORE_ARTIFACT_ENTRIES, 'extra'] }))
      .toThrow('ZIP entry');
    expect(() => assertExactCoreArtifact({ ...valid(),
      evidence: { ...evidence, source: { sha, ref: 'refs/heads/dev' } } }))
      .toThrow('provenance mismatch');
  });
  it('refuses ordinary Appwrite, production, social and credentials accidentally bundled in profile', () => {
    const f = valid();
    for (const patch of [
      { backend: 'appwrite-cloud' }, { appwriteBackend: 'production' },
      { featureProfile: 'full' }, { featureProfile: 'core-only' }, { vercelEnvironment: 'production' },
      { supabaseOrigin: 'https://example.supabase.co' },
      { posthog: 'enabled' }, { giphy: 'enabled' },
    ]) {
      expect(() => assertExactCoreArtifact({ ...f, evidence: {
        ...f.evidence, buildProfile: { ...f.evidence.buildProfile, ...patch },
      } })).toThrow('provider/feature profile');
    }
  });
  it('requires nondeployable CI artifact evidence: never treats source bytes as release authorization', () => {
    const f = valid();
    for (const update of [{ deploymentAuthorized: true }, { kind: 'deployable' },
      { schemaVersion: 3 }]) {
      expect(() => assertExactCoreArtifact({ ...f, evidence: { ...f.evidence, ...update } }))
        .toThrow('provenance mismatch');
    }
  });
});
