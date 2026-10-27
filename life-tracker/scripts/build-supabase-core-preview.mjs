#!/usr/bin/env node
// Public configuration only. Produces immutable CI evidence, never deploys.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('../', import.meta.url));
const config = JSON.parse(await readFile(new URL('../supabase-poc/core-preview-public.json', import.meta.url)));
const sha = process.env.GITHUB_SHA;
const ref = process.env.GITHUB_REF;
if (!/^[a-f0-9]{40}$/.test(sha ?? '') ||
    !/^refs\/heads\/(?:codex|feature)\/1027-supabase-(?:recovery|preview)-[a-z0-9-]+$/.test(ref ?? '') ||
    config.project !== 'hcxtiifzxoaflhjgoglb' ||
    config.origin !== 'https://hcxtiifzxoaflhjgoglb.supabase.co' ||
    !/^sb_publishable_[A-Za-z0-9_-]+$/.test(config.publishableKey ?? ''))
  throw new Error('Explicit isolated Preview source and public configuration required');

// No management/deployment credentials or inherited feature overrides reach
// npm/Vite. In particular, never load shared Vercel project environment files.
const env = Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'TEMP', 'TZ', 'CI',
  'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY', 'NODE_USE_ENV_PROXY',
  'NODE_EXTRA_CA_CERTS', 'SSL_CERT_FILE', 'NPM_CONFIG_CACHE']
  .filter(key => process.env[key] !== undefined).map(key => [key, process.env[key]]));
Object.assign(env, {
  GITHUB_SHA: sha, GITHUB_REF: ref, GITHUB_REPOSITORY: 'carlers/mosaic-life-tracker',
  VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_SHA: sha,
  VERCEL_GIT_COMMIT_REF: ref.replace('refs/heads/', ''),
  VERCEL_PROJECT_ID: 'prj_jysOLDbuO9c5rP8x6Q145DVIw0fc',
  MOSAIC_SUPABASE_CORE_PREVIEW: 'true',
  VITE_MOSAIC_BACKEND: 'supabase-cloud', VITE_MOSAIC_FEATURE_PROFILE: 'personal',
  VITE_SUPABASE_URL: config.origin, VITE_SUPABASE_PUBLISHABLE_KEY: config.publishableKey,
});
function run(command, args) {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit' });
  if (result.error || result.status !== 0) throw new Error('Supabase Preview build step failed: ' + command);
}
const output = '.mosaic/supabase-core-preview';
run('npm', ['run', 'build']);
run(process.execPath, ['scripts/preview-build-evidence.mjs', 'create', 'dist', output]);
run(process.execPath, ['scripts/prepare-preview-routes.mjs', 'vercel.json', output]);
run('tar', ['-czf', output + '/dist.tar.gz', '-C', 'dist', '.']);
const archive = await readFile(new URL('../' + output + '/dist.tar.gz', import.meta.url));
await writeFile(new URL('../' + output + '/dist.tar.gz.sha256', import.meta.url),
  createHash('sha256').update(archive).digest('hex') + '  dist.tar.gz\n');
run(process.execPath, ['scripts/verify-preview-static-output.mjs', output]);
console.log('Isolated Supabase artifact verified; no deployment performed.');
