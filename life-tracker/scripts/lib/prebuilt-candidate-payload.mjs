import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { readVerifiedActionsZip } from './prebuilt-zip-artifact.mjs';
import { inspectGzipTar, verifyArchivedBuild } from './preview-artifact-trust.mjs';
import { assessPrebuiltManifest, PREBUILT_ROUTING_SHA256, PREBUILT_CANARY_BRANCH,
  isApprovedPrebuiltBranch } from './prebuilt-receiver-gate.mjs';

// Reviewed fingerprint of Mosaic's existing Vercel high-level routing policy.
// Any routing/header change must be independently reviewed in trusted main.
export const TRUSTED_HIGH_LEVEL_CONFIG_SHA256 =
  'c81a0d1ea05dc90f597361982375517a10bc6681e5a49c4b37bdab29a59ab07e';
const EXPECTED_HEADER_NAMES = ['X-Content-Type-Options', 'X-Frame-Options',
  'Referrer-Policy', 'Permissions-Policy'];
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

function reviewedVercelBase() {
  const original = readFileSync(new URL('./trusted-prebuilt-vercel.json', import.meta.url));
  if (sha256(original) !== TRUSTED_HIGH_LEVEL_CONFIG_SHA256)
    throw new Error('Reviewed source configuration fixture was modified');
  return original;
}

// An exact, source-committed opt-in for one stable branch at a time.
// The writer only uses this for generic branches after the separate main
// rollout switch, canonical acceptance and provider-suppression proof.
// Vercel treats any matching true as enabled; keeping `prefix/*: true`
// would silently create a Git build even with exact `prefix/name: false`.
export function expectedIsolatedGitConfig(branch) {
  if (!isApprovedPrebuiltBranch(branch))
    throw new Error('Unapproved trusted Preview branch');
  const [category, leaf] = branch.split('/');
  if (!/^(feature|fix|perf|security|refactor)$/.test(category) ||
      !/^[a-z0-9][a-z0-9-]{0,72}$/.test(leaf))
    throw new Error('Unsafe trusted Preview Git branch pattern');
  const source = reviewedVercelBase().toString('utf8');
  const old = '"' + category + '/*": true,';
  if (source.split(old).length !== 2)
    throw new Error('Ambiguous Vercel Git deployment rule');
  const replacement = '"' + category + '/!(' + leaf + ')": true,\n      "' +
    branch + '": false,';
  const disabled = Buffer.from(source.replace(old, replacement));
  const rules = JSON.parse(disabled.toString('utf8'))?.git?.deploymentEnabled;
  if (rules?.[category + '/*'] !== undefined ||
      rules?.[category + '/!(' + leaf + ')'] !== true ||
      rules?.[branch] !== false || rules?.main !== true || rules?.dev !== true ||
      rules?.['*'] !== false || rules?.['chatgpt/*'] !== false ||
      rules?.['codex/*'] !== false)
    throw new Error('Rollout must disable only the approved stable branch');
  return disabled;
}

// The inherited policy for newly created stable branches: exact explicit
// category/leaf matches are FALSE, while main and dev remain Git deployed.
// "*" does not match slash-containing names and is not a safe fallback.
export function expectedDefaultCiFirstGitConfig() {
  let source = reviewedVercelBase().toString('utf8');
  for (const category of ['feature', 'fix', 'perf', 'security', 'refactor']) {
    const rule = '"' + category + '/*": true,';
    if (source.split(rule).length !== 2)
      throw new Error('Ambiguous default CI-first suppression policy');
    source = source.replace(rule, '"' + category + '/*": false,');
  }
  return Buffer.from(source);
}

export function approvedHighLevelConfigHashes(branch = PREBUILT_CANARY_BRANCH) {
  return new Set([TRUSTED_HIGH_LEVEL_CONFIG_SHA256,
    sha256(expectedIsolatedGitConfig(branch))]);
}


function parseJson(bytes, name) {
  try { return JSON.parse(bytes.toString('utf8')); }
  catch { throw new Error('Malformed ' + name + ' in accepted CI artifact'); }
}

// The Actions ZIP is untrusted candidate data even when its filename and
// metadata match. Require canonical GitHub acceptance separately and first.
export function verifyPrebuiltCandidateBytes(zipBytes, { sha, branch, digest, sourceConfigBytes }) {
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
  if (!isExactPrebuiltSourceOptIn(sourceConfigBytes, branch))
    throw new Error('Unapproved source Git suppression in accepted artifact');
  if (routing?.schemaVersion !== 1 ||
      routing.kind !== 'non-deployable-preview-routing-evidence' ||
      routing.deploymentAuthorized !== false ||
      !/^([a-f0-9]{64})$/.test(routing.vercelConfigSha256 ?? '') ||
      routing.vercelConfigSha256 !== sha256(sourceConfigBytes) ||
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
// Never trust a candidate-supplied marker or a permissive subset. Only the
// exact reviewed one-branch suppression bytes are an opt-in; ordinary Git
// Preview configurations must be ignored without a privileged job.
export function isExactPrebuiltSourceOptIn(raw, branch) {
  if (!Buffer.isBuffer(raw) || !isApprovedPrebuiltBranch(branch)) return false;
  const expected = expectedIsolatedGitConfig(branch);
  if (raw.length === expected.length && raw.equals(expected)) return true;
  // Existing canary branches still require their own reviewed one-branch
  // policy. Only future generic stable branches may inherit the default.
  if (branch === PREBUILT_CANARY_BRANCH ||
      branch === 'feature/592-prebuilt-pilot-20261014') return false;
  const general = expectedDefaultCiFirstGitConfig();
  return raw.length === general.length && raw.equals(general);
}
