import { createHash } from 'node:crypto';
import { lstat, readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { readBuildAssetFingerprint } from './build-asset-fingerprint.mjs';
import { measureProductionBuild } from './build-size-guard.mjs';

const SHA = /^[a-f0-9]{40}$/i;
const FILENAME = /^[a-zA-Z0-9.][a-zA-Z0-9._/-]*$/;
const digest = data => createHash('sha256').update(data).digest('hex');

// This is a CI build-evidence contract, NOT deployment authorization.
// A green build job alone is not canonical acceptance; the future trusted
// default-main receiver must separately check exact source/workflow SHA,
// entire current canonical check suite and digest of the downloaded archive.
export async function inventoryBuild(directory) {
  const root = resolve(directory);
  const files = [];
  async function visit(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name, 'en'));
    for (const entry of entries) {
      const full = join(dir, entry.name);
      const stat = await lstat(full);
      if (stat.isSymbolicLink() || (!stat.isFile() && !stat.isDirectory())) {
        throw new Error('Build contains non-regular entry: ' + entry.name);
      }
      if (stat.isDirectory()) {
        await visit(full);
        continue;
      }
      const name = relative(root, full).split(sep).join('/');
      if (!FILENAME.test(name) || name.startsWith('/') ||
          name.split('/').some(part => part === '.' || part === '..' || (part.startsWith('.') && part !== '.vite'))) {
        throw new Error('Unsafe build artifact path: ' + name);
      }
      const data = await readFile(full);
      files.push({ name, bytes: data.length, sha256: digest(data) });
    }
  }
  await visit(root);
  files.sort((a, b) => a.name.localeCompare(b.name, 'en'));
  if (!files.some(file => file.name === 'index.html') ||
      !files.some(file => file.name === 'sw.js') ||
      !files.some(file => file.name === '.vite/manifest.json')) {
    throw new Error('Production Vite/PWA output is incomplete');
  }
  return {
    files,
    digest: digest(Buffer.from(JSON.stringify(files))),
  };
}

export function validateBuildEvidence(manifest, expected = {}) {
  if (manifest?.schemaVersion !== 1 ||
      manifest?.kind !== 'non-deployable-ci-build-evidence' ||
      manifest?.deploymentAuthorized !== false) {
    throw new Error('CI build evidence is not a deployment authorization');
  }
  if (!SHA.test(manifest.source?.sha ?? '') ||
      !/^refs\/heads\/(?:main|dev|(?:feature|fix|perf|security|refactor)\/[a-z0-9._/-]+)$/.test(
        manifest.source?.ref ?? '',
      )) throw new Error('Untrusted source identity in CI build evidence');
  if (expected.sha && manifest.source.sha !== expected.sha)
    throw new Error('CI build evidence source SHA mismatch');
  if (expected.ref && manifest.source.ref !== expected.ref)
    throw new Error('CI build evidence source ref mismatch');
  if (!/^[a-f0-9]{64}$/.test(manifest.inventory?.digest ?? '') ||
      !Number.isSafeInteger(manifest.inventory?.count) || manifest.inventory.count < 3 ||
      !/^[a-f0-9]{64}$/.test(manifest.jsCssFingerprint ?? '') ||
      !manifest.metrics || typeof manifest.metrics !== 'object') {
    throw new Error('Incomplete CI build evidence');
  }
  const profile = manifest.buildProfile;
  if (!profile || profile.environment !== 'untrusted-ci-diagnostic' ||
      profile.giphy !== 'enabled' && profile.giphy !== 'disabled' ||
      !Number.isSafeInteger(profile.nodeMajor) || profile.nodeMajor < 20) {
    throw new Error('Untrusted or incomplete CI build profile');
  }
  return manifest;
}

export async function createBuildEvidence({ directory, sha, ref, profile }) {
  const inventory = await inventoryBuild(directory);
  const fingerprint = await readBuildAssetFingerprint(directory);
  const metrics = await measureProductionBuild(directory);
  const evidence = {
    schemaVersion: 1,
    kind: 'non-deployable-ci-build-evidence',
    deploymentAuthorized: false,
    source: { sha, ref },
    buildProfile: {
      environment: 'untrusted-ci-diagnostic',
      nodeMajor: Number(process.versions.node.split('.')[0]),
      giphy: profile?.giphy === true ? 'enabled' : 'disabled',
    },
    inventory: { digest: inventory.digest, count: inventory.files.length },
    jsCssFingerprint: fingerprint.digest,
    metrics,
  };
  return { evidence: validateBuildEvidence(evidence), inventory };
}

export async function verifyBuildEvidence(directory, evidence, inventory, expected = {}) {
  validateBuildEvidence(evidence, expected);
  if (!Array.isArray(inventory?.files) ||
      !inventory.files.every(file => typeof file.name === 'string' &&
        /^[a-f0-9]{64}$/.test(file.sha256) &&
        Number.isSafeInteger(file.bytes) && file.bytes >= 0)) {
    throw new Error('Malformed inventory file rows');
  }
  const actual = await inventoryBuild(directory);
  if (actual.digest !== inventory.digest ||
      actual.digest !== evidence.inventory.digest ||
      inventory.files.length !== evidence.inventory.count ||
      JSON.stringify(actual.files) !== JSON.stringify(inventory.files)) {
    throw new Error('Downloaded build bytes differ from the source inventory');
  }
  const fingerprint = await readBuildAssetFingerprint(directory);
  if (fingerprint.digest !== evidence.jsCssFingerprint)
    throw new Error('JS/CSS fingerprint mismatch');
  const metrics = await measureProductionBuild(directory);
  if (JSON.stringify(metrics) !== JSON.stringify(evidence.metrics))
    throw new Error('Measured byte metrics changed after CI evidence creation');
  return evidence;
}
