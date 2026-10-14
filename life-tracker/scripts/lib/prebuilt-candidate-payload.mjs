import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { readVerifiedActionsZip } from './prebuilt-zip-artifact.mjs';
import { inspectGzipTar, verifyArchivedBuild } from './preview-artifact-trust.mjs';
import { assessPrebuiltManifest, PREBUILT_ROUTING_SHA256 } from './prebuilt-receiver-gate.mjs';

// Reviewed fingerprint of Mosaic's existing Vercel high-level routing policy.
// Any routing/header change must be independently reviewed in trusted main.
export const TRUSTED_HIGH_LEVEL_CONFIG_SHA256 =
  '23a7d4a9dd3a2a5e4fff40cdb147656bf2c6a2e60958dd10f514d8ab2eb73986';
const EXPECTED_HEADER_NAMES = ['X-Content-Type-Options', 'X-Frame-Options',
  'Referrer-Policy', 'Permissions-Policy'];
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export function approvedHighLevelConfigHashes() {
  // Keep a review-pinned copy of the exact stable canary's original Vercel
  // configuration in trusted main. The only future candidate change allowed
  // by this exception is disabling Git auto creation for fix/* on THAT branch.
  const original = readFileSync(new URL('./trusted-prebuilt-vercel.json', import.meta.url));
  if (sha256(original) !== TRUSTED_HIGH_LEVEL_CONFIG_SHA256)
    throw new Error('Reviewed source configuration fixture was modified');
  const current = original.toString('utf8');
  const enabled = '"fix/*": true,';
  if (current.split(enabled).length !== 2)
    throw new Error('Ambiguous Vercel canary rollout policy');
  const disabled = current.replace(enabled, '"fix/*": false,');
  const policy = JSON.parse(disabled).git?.deploymentEnabled;
  if (policy?.['fix/*'] !== false || policy?.main !== true || policy?.dev !== true)
    throw new Error('Rollout disabled a protected branch or kept fix auto enabled');
  return new Set([sha256(original), sha256(Buffer.from(disabled))]);
}


function parseJson(bytes, name) {
  try { return JSON.parse(bytes.toString('utf8')); }
  catch { throw new Error('Malformed ' + name + ' in accepted CI artifact'); }
}

// The Actions ZIP is untrusted candidate data even when its filename and
// metadata match. Require canonical GitHub acceptance separately and first.
export function verifyPrebuiltCandidateBytes(zipBytes, { sha, branch, digest }) {
  if (!/^sha256:[a-f0-9]{64}$/.test(digest ?? '') ||
      'sha256:' + sha256(zipBytes) !== digest)
    throw new Error('GitHub Actions artifact ZIP digest mismatch');
  const data = readVerifiedActionsZip(zipBytes);
  const evidence = parseJson(data['evidence.json'], 'build evidence');
  const inventory = parseJson(data['inventory.json'], 'file inventory');
  const routing = parseJson(data['routing-evidence.json'], 'routing evidence');
  const manifest = assessPrebuiltManifest(evidence, {
    sha, branch, routingSha256: PREBUILT_ROUTING_SHA256,
  });
  if (!manifest.eligible)
    throw new Error('Unacceptable prebuilt Preview build profile or budgets: ' +
      manifest.reasons.join('; '));
  const check = data['dist.tar.gz.sha256'].toString('utf8').trim();
  const match = /^([a-f0-9]{64})\s+\S*dist\.tar\.gz$/.exec(check);
  if (!match) throw new Error('Malformed archived static file checksum');
  const files = verifyArchivedBuild({ archive: data['dist.tar.gz'],
    archiveSha256: match[1], evidence, inventory,
    expected: { sha, ref: 'refs/heads/' + branch },
  });
  if (routing?.schemaVersion !== 1 ||
      routing.kind !== 'non-deployable-preview-routing-evidence' ||
      routing.deploymentAuthorized !== false ||
      !approvedHighLevelConfigHashes().has(routing.vercelConfigSha256) ||
      routing.generatedConfigSha256 !== PREBUILT_ROUTING_SHA256 ||
      sha256(data['config.json']) !== PREBUILT_ROUTING_SHA256 ||
      routing.rewrites !== 15 ||
      JSON.stringify(routing.headerNames) !== JSON.stringify(EXPECTED_HEADER_NAMES))
    throw new Error('Untrusted Vercel routing contract in accepted artifact');
  const output = parseJson(data['config.json'], 'Vercel output configuration');
  if (output?.version !== 3 || !Array.isArray(output.routes) ||
      Object.keys(output).some(key => !['version', 'routes'].includes(key)) ||
      output.routes.filter(route =>
        route?.dest === '/index.html' || route?.dest === '/index.html?path=$1').length !== 15 ||
      !output.routes.some(route => route?.handle === 'filesystem') ||
      !output.routes.some(route => route?.headers?.['X-Frame-Options'] === 'DENY'))
    throw new Error('Missing trusted static routing semantics');
  return {
    archive: data['dist.tar.gz'], inventory, configBytes: data['config.json'],
    evidence, fileCount: files.files,
    routingSha256: PREBUILT_ROUTING_SHA256, deploymentAuthorized: false,
  };
}

export async function assembleVerifiedCandidateStatic(candidate, outputRoot) {
  if (candidate?.deploymentAuthorized !== false ||
      candidate?.routingSha256 !== PREBUILT_ROUTING_SHA256)
    throw new Error('Cannot assemble unverified candidate');
  const { files, data } = inspectGzipTar(candidate.archive, undefined, true);
  if (JSON.stringify(files) !== JSON.stringify(candidate.inventory.files))
    throw new Error('Candidate files changed after archive verification');
  const root = resolve(outputRoot);
  await mkdir(root); // Exclusive: no previously created path/symlink allowed.
  const staticRoot = join(root, '.vercel', 'output', 'static');
  await mkdir(staticRoot, { recursive: true });
  for (const row of files) {
    const bytes = data.get(row.name);
    if (!bytes || bytes.length !== row.bytes || sha256(bytes) !== row.sha256)
      throw new Error('Unsafe static file modification');
    const dest = join(staticRoot, row.name);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, bytes, { flag: 'wx' });
    const actual = await readFile(dest);
    if (sha256(actual) !== row.sha256) throw new Error('Written static file hash mismatch');
  }
  await writeFile(join(root, '.vercel', 'output', 'config.json'), candidate.configBytes,
    { flag: 'wx' });
  return { outputRoot: root, files: files.length, deploymentAuthorized: false };
}