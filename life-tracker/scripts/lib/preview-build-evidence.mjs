import { createHash } from 'node:crypto';
import { lstat, readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { readBuildAssetFingerprint } from './build-asset-fingerprint.mjs';
import { measureProductionBuild } from './build-size-guard.mjs';

import { validateBuildEvidence } from './preview-evidence-schema.mjs';
export { validateBuildEvidence } from './preview-evidence-schema.mjs';
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
      posthog: profile?.posthog === true ? 'enabled' : 'disabled',
      vercelEnvironment: profile?.vercelEnvironment === 'preview' ? 'preview' : 'production',
      appwriteBackend: profile?.backend === 'supabase-cloud' ? 'none' :
        profile?.appwriteBackend === 'scratch' ? 'scratch' : 'production',
      ...(profile?.backend === 'supabase-cloud' ? {
        backend: profile.backend, featureProfile: profile.featureProfile,
        supabaseOrigin: profile.supabaseOrigin, publishableKeySha256: profile.publishableKeySha256,
      } : {}),
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
