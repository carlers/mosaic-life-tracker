import { describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  inventoryBuild,
  validateBuildEvidence,
} from '../../scripts/lib/preview-build-evidence.mjs';

const sha = 'a'.repeat(40);
const digest = 'b'.repeat(64);
const evidence = {
  schemaVersion: 1,
  kind: 'non-deployable-ci-build-evidence',
  deploymentAuthorized: false,
  source: { sha, ref: 'refs/heads/fix/accepted-preview' },
  buildProfile: {
    environment: 'untrusted-ci-diagnostic',
    giphy: 'disabled',
    nodeMajor: 24,
  },
  inventory: { digest, count: 3 },
  jsCssFingerprint: digest,
  metrics: { initialClosureGzipBytes: 42 },
};

describe('prebuilt CI evidence contract (#592)', () => {
  it('keeps Supabase artifacts explicit and rejects cross-provider or Production evidence', () => {
    const candidate = { ...evidence, buildProfile: {
      ...evidence.buildProfile, backend: 'supabase-cloud', featureProfile: 'core-only',
      appwriteBackend: 'none', vercelEnvironment: 'preview',
      supabaseOrigin: 'https://hcxtiifzxoaflhjgoglb.supabase.co', publishableKeySha256: digest,
    } };
    expect(validateBuildEvidence(candidate)).toEqual(candidate);
    for (const override of [
      { appwriteBackend: 'scratch' }, { vercelEnvironment: 'production' },
      { supabaseOrigin: 'https://other.supabase.co' }, { publishableKeySha256: undefined },
    ]) expect(() => validateBuildEvidence({ ...candidate,
      buildProfile: { ...candidate.buildProfile, ...override } })).toThrow(/Supabase Preview/);
  });
  it('accepts only explicit non-deployable, matched-source diagnostics', () => {
    expect(validateBuildEvidence(evidence, { sha, ref: evidence.source.ref })).toEqual(evidence);
    expect(() => validateBuildEvidence({ ...evidence, deploymentAuthorized: true }))
      .toThrow(/not a deployment authorization/);
    expect(() => validateBuildEvidence({ ...evidence, kind: 'approved-deployment' }))
      .toThrow(/not a deployment authorization/);
    expect(() => validateBuildEvidence(evidence, { sha: 'c'.repeat(40) }))
      .toThrow(/source SHA mismatch/);
    expect(() => validateBuildEvidence(evidence, { ref: 'refs/heads/fix/other' }))
      .toThrow(/source ref mismatch/);
    expect(() => validateBuildEvidence({ ...evidence, source: { sha, ref: 'refs/pull/3/merge' } }))
      .toThrow(/Untrusted source identity/);
  });

  it('rejects profile manipulation and missing bytes/provenance', () => {
    for (const value of [null, 17, '', 'unexpected']) {
      expect(() => validateBuildEvidence({
        ...evidence,
        buildProfile: { ...evidence.buildProfile, giphy: value },
      })).toThrow(/build profile/);
    }
    expect(() => validateBuildEvidence({
      ...evidence,
      inventory: { digest: 'bad', count: 3 },
    })).toThrow(/Incomplete CI build evidence/);
    expect(() => validateBuildEvidence({
      ...evidence,
      source: { sha: 'short', ref: evidence.source.ref },
    })).toThrow(/Untrusted source identity/);
  });

  it('inventories complete static PWA bytes and changes digest on mutation', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mosaic-ci-artifact-'));
    try {
      await mkdir(join(root, '.vite'), { recursive: true });
      await mkdir(join(root, 'assets'), { recursive: true });
      await writeFile(join(root, 'index.html'), '<html></html>');
      await writeFile(join(root, 'sw.js'), 'self.addEventListener("fetch", () => {});');
      await writeFile(join(root, '.vite', 'manifest.json'), '{}');
      await writeFile(join(root, 'assets', 'entry.js'), 'console.log("ok")');
      const original = await inventoryBuild(root);
      expect(original.files.map(file => file.name)).toEqual(
        ['.vite/manifest.json', 'assets/entry.js', 'index.html', 'sw.js'],
      );
      expect(original.files.every(file => /^[a-f0-9]{64}$/.test(file.sha256))).toBe(true);
      expect((await inventoryBuild(root)).digest).toBe(original.digest);
      await writeFile(join(root, 'assets', 'entry.js'), 'console.log("tampered")');
      expect((await inventoryBuild(root)).digest).not.toBe(original.digest);
      await rm(join(root, 'sw.js'));
      await expect(inventoryBuild(root)).rejects.toThrow(/incomplete/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects symlinked output instead of following out-of-root files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mosaic-ci-symlink-'));
    try {
      await mkdir(join(root, '.vite'));
      await writeFile(join(root, 'index.html'), 'test');
      await writeFile(join(root, 'sw.js'), 'test');
      await writeFile(join(root, '.vite', 'manifest.json'), '{}');
      await symlink(join(root, 'index.html'), join(root, 'exfiltrate.js'));
      await expect(inventoryBuild(root)).rejects.toThrow(/non-regular entry/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
