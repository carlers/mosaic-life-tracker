import { describe, expect, it } from 'vitest';
import { CORE_BRANCH, CORE_VERCEL_PROJECT } from '../../scripts/lib/supabase-core-artifact-stage.mjs';
import {
  assertSourceContext, qualityRunStatus, assertCoreArtifact, assertVercelDeployment
} from '../../scripts/verify-supabase-preview-deploy.mjs';

const sha = 'a'.repeat(40);
const run = { head_sha: sha, head_branch: CORE_BRANCH, event: 'push',
  path: 'carlers/mosaic-life-tracker/.github/workflows/supabase-core-app.yml' };
const qrun = { name: 'Quality Gate', head_sha: sha, head_branch: CORE_BRANCH,
  event: 'push', path: 'carlers/mosaic-life-tracker/.github/workflows/quality-gate.yml',
  status: 'completed', conclusion: 'success', id: 100, run_attempt: 1 };
const digest = 'b'.repeat(64);

describe('protected exact-SHA Supabase Preview deployment preflight', () => {
  it('allows only the live isolated feature branch and running workflow identity', () => {
    expect(() => assertSourceContext({ repository: 'carlers/mosaic-life-tracker',
      ref: 'refs/heads/' + CORE_BRANCH, sha, branchSha: sha, run })).not.toThrow();
    for (const changed of [
      { branchSha: 'c'.repeat(40) },
      { ref: 'refs/heads/main' },
      { repository: 'attacker/fork' },
      { run: { ...run, head_sha: 'd'.repeat(40) } },
      { run: { ...run, path: 'repo/.github/workflows/evil.yml' } },
    ]) expect(() => assertSourceContext({
      repository: 'carlers/mosaic-life-tracker', ref: 'refs/heads/' + CORE_BRANCH,
      sha, branchSha: sha, run, ...changed,
    })).toThrow(/provenance mismatch/);
  });

  it('requires the canonical Quality Gate on this SHA and rejects failed/latest reruns', () => {
    expect(qualityRunStatus([qrun], sha)).toBe('success');
    expect(qualityRunStatus([{ ...qrun, head_sha: 'd'.repeat(40) }], sha)).toBe('pending');
    expect(qualityRunStatus([{ ...qrun, status: 'in_progress' }], sha)).toBe('pending');
    expect(() => qualityRunStatus([
      qrun, { ...qrun, id: 101, conclusion: 'failure' },
    ], sha)).toThrow(/Quality Gate failed/);
  });

  it('accepts only the exact run/attempt CI archive with GitHub-published SHA-256', () => {
    const name = 'mosaic-supabase-core-' + sha + '-100-2';
    const good = { id: 981, name, size_in_bytes: 800000, digest: 'sha256:' + digest, expired: false };
    expect(assertCoreArtifact([good], { sha, runId: 100, attempt: 2 }))
      .toEqual({ id: 981, name, digest });
    for (const bad of [
      { ...good, expired: true },
      { ...good, name: name.replace('-100-2', '-99-1') },
      { ...good, digest: 'sha256:' + 'c'.repeat(63) },
    ]) expect(() => assertCoreArtifact([bad], { sha, runId: 100, attempt: 2 }))
      .toThrow(/artifact or authenticated ZIP digest missing/);
  });

  it('requires immutable Vercel Preview READY in exactly the intended project/profile', () => {
    const original = { readyState: 'READY', target: 'preview',
      projectId: CORE_VERCEL_PROJECT, meta: {
        mosaicSourceSha: sha, mosaicBackend: 'supabase-cloud', mosaicArtifactSha256: digest
      },
    };
    expect(() => assertVercelDeployment(original, { sha, zipDigest: digest })).not.toThrow();
    // The Vercel deployment API also surfaces project.id rather than a
    // root projectId. Require exact matching in either/both representations.
    expect(() => assertVercelDeployment({
      ...original, projectId: undefined, project: { id: CORE_VERCEL_PROJECT },
    }, { sha, zipDigest: digest })).not.toThrow();
    expect(() => assertVercelDeployment({
      ...original, project: { id: CORE_VERCEL_PROJECT },
    }, { sha, zipDigest: digest })).not.toThrow();
    for (const invalid of [
      { projectId: undefined, project: undefined },
      { projectId: undefined, project: { id: 'foreign' } },
      { projectId: CORE_VERCEL_PROJECT, project: { id: 'foreign' } },
    ]) expect(() => assertVercelDeployment({
      ...original, ...invalid,
    }, { sha, zipDigest: digest })).toThrow(/identity mismatch/);

    // Vercel's REST API represents normal Preview deployments with target:null.
    expect(() => assertVercelDeployment({ ...original, target: null },
      { sha, zipDigest: digest })).not.toThrow();
    for (const changed of [
      { readyState: 'BUILDING' }, { target: 'production' }, { projectId: 'foreign' },
      { meta: { ...original.meta, mosaicSourceSha: 'd'.repeat(40) } },
      { meta: { ...original.meta, mosaicBackend: 'appwrite-cloud' } },
    ]) expect(() => assertVercelDeployment({ ...original, ...changed },
      { sha, zipDigest: digest })).toThrow(/identity mismatch/);
  });
});
