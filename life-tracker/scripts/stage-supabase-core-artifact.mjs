#!/usr/bin/env node
/**
 * Stage EXACT verified Supabase CI bytes into Vercel Build Output API v3.
 *
 * This performs NO deployment, alias assignment, Supabase policy mutation,
 * remote request, rebuild or environment secret read. The operator must
 * independently prove both GitHub acceptance runs at the exact source SHA,
 * project/Preview target, email template safety, SSO and artifact provenance
 * BEFORE making any separate remote deployment or alias change.
 *
 * Usage (from life-tracker):
 *   node scripts/stage-supabase-core-artifact.mjs
 *     <GitHub-artifact.zip> <accepted-40-character-sha>
 *     <GitHub-reported-zip-sha256> <NEW-empty-output-directory>
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, stat, writeFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assembleVerifiedStaticOutput, verifyStaticOutputFiles } from './lib/preview-static-output.mjs';
import { assertExactCoreArtifact, CORE_ARTIFACT_ENTRIES, CORE_BRANCH,
  CORE_VERCEL_PROJECT, CORE_VERCEL_TEAM } from './lib/supabase-core-artifact-stage.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const digest = value => createHash('sha256').update(value).digest('hex');
const [zipArg, sha, expectedZipDigest, outputArg] = process.argv.slice(2);

function acceptedGitCheckout() {
  const run = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8',
    maxBuffer: 256 * 1024 }).trim();
  if (run('rev-parse', 'HEAD') !== sha)
    throw Error('CI artifact source must equal the checked-out accepted commit');
  const branch = run('branch', '--show-current');
  if (branch !== CORE_BRANCH &&
      !(branch === '' && process.env.GITHUB_SHA === sha &&
        process.env.GITHUB_REF === 'refs/heads/' + CORE_BRANCH))
    throw Error('Expected isolated Supabase Preview branch, not an arbitrary checkout');
  if (run('status', '--porcelain'))
    throw Error('Stage only from clean accepted source; uncommitted changes found');
}

function member(zip, name) {
  const data = execFileSync('unzip', ['-p', zip, name], {
    maxBuffer: name === 'dist.tar.gz' ? 32 * 1024 * 1024 : 4 * 1024 * 1024,
    timeout: 30_000,
  });
  if (!data.length) throw Error('Empty CI artifact member: ' + name);
  return data;
}

async function main() {
  if (process.argv.length !== 6 || !zipArg || !sha || !expectedZipDigest || !outputArg)
    throw Error('Usage: stage-supabase-core-artifact.mjs <zip> <sha> <zip-sha256> <new-output-root>');
  const zip = resolve(zipArg), outputRoot = resolve(outputArg);
  const inputStat = await stat(zip);
  if (!inputStat.isFile() || inputStat.size < 1000 || inputStat.size > 40 * 1024 * 1024)
    throw Error('Refuse missing or oversized CI ZIP');
  const zipBytes = await readFile(zip);
  if (digest(zipBytes) !== expectedZipDigest)
    throw Error('CI ZIP bytes do not match independently accepted GitHub artifact digest');
  const members = execFileSync('unzip', ['-Z1', zip], {
    encoding: 'utf8', maxBuffer: 100 * 1024, timeout: 30_000,
  }).trim().split('\n').sort();
  // Reject unknown/duplicate entries before reading any archive member.
  if (JSON.stringify(members) !== JSON.stringify([...CORE_ARTIFACT_ENTRIES].sort()))
    throw Error('Unexpected CI ZIP members or duplicate member names');
  const values = Object.fromEntries(CORE_ARTIFACT_ENTRIES.map(name =>
    [name, member(zip, name)]));
  const evidence = JSON.parse(values['evidence.json'].toString('utf8'));
  const inventory = JSON.parse(values['inventory.json'].toString('utf8'));
  const routingEvidence = JSON.parse(values['routing-evidence.json'].toString('utf8'));
  const expected = assertExactCoreArtifact({
    sha, zipDigest: expectedZipDigest, entries: members, evidence,
  });
  acceptedGitCheckout();
  const checksumLine = values['dist.tar.gz.sha256'].toString('utf8').trim();
  const archiveSha256 = /^([a-f0-9]{64})\s+dist\.tar\.gz$/.exec(checksumLine)?.[1];
  if (!archiveSha256 || digest(values['dist.tar.gz']) !== archiveSha256)
    throw Error('CI static archive does not match its published SHA256');

  let created = false;
  try {
    const result = await assembleVerifiedStaticOutput({
      archive: values['dist.tar.gz'], archiveSha256, evidence, inventory,
      expected, configBytes: values['config.json'], routingEvidence,
      trustedVercelConfigBytes: await readFile(join(root, 'vercel.json')),
      outputRoot,
    });
    created = true;
    await verifyStaticOutputFiles(outputRoot, inventory);
    await writeFile(join(outputRoot, '.vercel', 'project.json'), JSON.stringify({
      projectId: CORE_VERCEL_PROJECT, orgId: CORE_VERCEL_TEAM,
    }) + '\n', { flag: 'wx' });
    // Non-authorizing snapshot. These bytes do not grant release permission.
    await writeFile(join(outputRoot, '.mosaic-staged-evidence.json'), JSON.stringify({
      status: 'STAGED_NOT_DEPLOYED', deploymentAuthorized: false,
      acceptedSha: sha, githubArtifactZipSha256: expectedZipDigest,
      archiveSha256, inventoryDigest: inventory.digest, files: result.files,
      projectId: CORE_VERCEL_PROJECT, teamId: CORE_VERCEL_TEAM,
      target: 'preview', backend: 'supabase-cloud',
    }, null, 2) + '\n', { flag: 'wx' });
    console.log('Exact source and ' + result.files +
      ' CI file bytes staged; Preview artifact NOT deployed or authorized.');
  } catch (error) {
    if (created) await rm(outputRoot, { recursive: true, force: true });
    throw error;
  }
}

main().catch(error => {
  console.error('Supabase Preview staging refused: ' +
    (error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
});
