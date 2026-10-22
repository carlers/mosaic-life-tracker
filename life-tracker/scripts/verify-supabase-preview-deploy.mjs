#!/usr/bin/env node
/**
 * Exact-SHA protected Supabase Preview prebuilt deployment gate.
 * No Vercel credentials required until AFTER all GitHub provenance and
 * artifact hashes have passed. Never selects latest-success from another SHA.
 */
import { createHash } from 'node:crypto';
import { writeFile, appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { CORE_BRANCH, CORE_VERCEL_PROJECT, CORE_VERCEL_TEAM } from './lib/supabase-core-artifact-stage.mjs';

const REPOSITORY = 'carlers/mosaic-life-tracker';
const SHA = /^[0-9a-f]{40}$/;
const DIGEST = /^sha256:([0-9a-f]{64})$/;
const ARTIFACT_PREFIX = 'mosaic-supabase-core-';
const sha256 = data => createHash('sha256').update(data).digest('hex');

export function assertSourceContext({ repository, ref, sha, branchSha, run }) {
  if (repository !== REPOSITORY || ref !== 'refs/heads/' + CORE_BRANCH ||
      !SHA.test(sha ?? '') || branchSha !== sha ||
      run?.head_sha !== sha || run?.head_branch !== CORE_BRANCH ||
      run?.event !== 'push' ||
      !(run?.path === '.github/workflows/supabase-core-app.yml' || run?.path?.endsWith('/.github/workflows/supabase-core-app.yml'))) {
    throw Error('Supabase Preview source/branch or running CI provenance mismatch');
  }
}

export function qualityRunStatus(runs, sha) {
  const matching = (runs || []).filter(run =>
    run?.name === 'Quality Gate' && run?.head_sha === sha &&
    run?.head_branch === CORE_BRANCH && run?.event === 'push' &&
    (run?.path === '.github/workflows/quality-gate.yml' || run?.path?.endsWith('/.github/workflows/quality-gate.yml'))
  );
  // Never fall back to an older successful rerun when a newer attempt failed.
  matching.sort((a, b) => b.id - a.id || b.run_attempt - a.run_attempt);
  const run = matching[0];
  if (!run || run.status !== 'completed') return 'pending';
  if (run.conclusion !== 'success') throw Error('Exact-SHA canonical Quality Gate failed');
  return 'success';
}

export function assertCoreArtifact(artifacts, { sha, runId, attempt }) {
  // GitHub may rerun only a failed job without re-uploading artifacts. Accept
  // the newest authenticated artifact for THIS exact run and SHA, from the
  // current or an earlier attempt. Never accept a foreign or later run.
  if (!SHA.test(sha ?? '') || !Number.isSafeInteger(runId) || runId <= 0 ||
      !Number.isSafeInteger(attempt) || attempt <= 0)
    throw Error('Invalid exact-SHA CI artifact source');
  const prefix = ARTIFACT_PREFIX + sha + '-' + runId + '-';
  const items = (artifacts || []).map(item => {
    const match = typeof item?.name === 'string' &&
      item.name.startsWith(prefix) &&
      /^([1-9][0-9]*)$/.exec(item.name.slice(prefix.length));
    return match ? { item, attempt: Number(match[1]) } : null;
  }).filter(Boolean).filter(candidate =>
    Number.isSafeInteger(candidate.attempt) && candidate.attempt <= attempt
  ).sort((a, b) => b.attempt - a.attempt);
  const chosen = items[0];
  const duplicates = chosen && items.filter(x => x.attempt === chosen.attempt);
  const item = chosen?.item;
  if (!chosen || duplicates.length !== 1 || item.expired ||
      !Number.isSafeInteger(item.id) || item.id <= 0 ||
      !Number.isSafeInteger(item.size_in_bytes) || item.size_in_bytes < 1_000 ||
      item.size_in_bytes > 40 * 1024 * 1024 ||
      !DIGEST.test(item.digest ?? '')) {
    throw Error('Exact-SHA Supabase CI artifact or authenticated ZIP digest missing');
  }
  return { id: item.id, name: item.name,
    digest: item.digest.slice('sha256:'.length) };
}

export function assertVercelDeployment(deployment, { sha, zipDigest }) {
  // Vercel's deployment endpoint may return either a root projectId or a
  // nested project.id; if both are present, require BOTH to match exactly.
  const projectIds = [deployment?.projectId, deployment?.project?.id]
    .filter(value => value != null);
  const projectVerified = projectIds.length > 0 &&
    projectIds.every(id => id === CORE_VERCEL_PROJECT);
  if (deployment?.readyState !== 'READY' ||
      !(deployment?.target === null || deployment?.target === 'preview') ||
      !projectVerified ||
      deployment?.meta?.mosaicSourceSha !== sha ||
      deployment?.meta?.mosaicBackend !== 'supabase-cloud' ||
      deployment?.meta?.mosaicArtifactSha256 !== zipDigest) {
    throw Error('Vercel READY target, project or immutable Supabase build identity mismatch');
  }
}

async function api(url, token, host = 'https://api.github.com') {
  if (!url.startsWith('/repos/' + REPOSITORY + '/')) throw Error('GitHub API resource outside repository');
  const response = await fetch(host + url, { headers: {
    Accept: 'application/vnd.github+json',
    Authorization: 'Bearer ' + token,
    'X-GitHub-Api-Version': '2022-11-28',
  } });
  if (!response.ok) throw Error('GitHub read rejected (' + response.status + ')');
  return response.json();
}

async function prepare() {
  const env = process.env;
  const { GITHUB_TOKEN: token, GITHUB_REPOSITORY: repository,
    GITHUB_REF: ref, GITHUB_SHA: sha, GITHUB_RUN_ID: runIdText,
    GITHUB_RUN_ATTEMPT: attemptText, RUNNER_TEMP: temp, GITHUB_OUTPUT: output } = env;
  const runId = Number(runIdText), attempt = Number(attemptText);
  if (!token || !temp || !output || !Number.isSafeInteger(runId) ||
      !Number.isSafeInteger(attempt) || runId <= 0 || attempt <= 0) {
    throw Error('Expected authenticated running GitHub Actions execution');
  }
  const [branch, run] = await Promise.all([
    api('/repos/' + REPOSITORY + '/branches/' + CORE_BRANCH, token),
    api('/repos/' + REPOSITORY + '/actions/runs/' + runId, token),
  ]);
  assertSourceContext({ repository, ref, sha, branchSha: branch.commit?.sha, run });

  // The core-app + hosted-preview-artifact jobs are prerequisites in the
  // caller workflow. Wait for the separately run canonical Quality Gate.
  let quality = 'pending';
  for (let i = 0; i < 100 && quality === 'pending'; i++) {
    const runs = await api('/repos/' + REPOSITORY +
      '/actions/workflows/quality-gate.yml/runs?head_sha=' + sha + '&per_page=30', token);
    quality = qualityRunStatus(runs.workflow_runs, sha);
    if (quality === 'pending' && i < 99)
      await new Promise(resolve => setTimeout(resolve, 15_000));
  }
  if (quality !== 'success') throw Error('Canonical exact-SHA Quality Gate was not accepted');

  const list = await api('/repos/' + REPOSITORY + '/actions/runs/' + runId + '/artifacts', token);
  const artifact = assertCoreArtifact(list.artifacts, { sha, runId, attempt });
  const zipEndpoint = '/repos/' + REPOSITORY + '/actions/artifacts/' + artifact.id + '/zip';
  const response = await fetch('https://api.github.com' + zipEndpoint, { headers: {
    Authorization: 'Bearer ' + token,
    Accept: 'application/vnd.github+json',
  } });
  if (!response.ok) throw Error('Cannot retrieve exact CI artifact ZIP (' + response.status + ')');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 1000 || bytes.length > 40 * 1024 * 1024 ||
      sha256(bytes) !== artifact.digest) {
    throw Error('GitHub CI artifact ZIP bytes differ from published SHA-256 digest');
  }
  const path = join(temp, 'mosaic-supabase-accepted.zip');
  await writeFile(path, bytes, { flag: 'wx', mode: 0o600 });
  await appendFile(output, [
    'archive=' + path,
    'digest=' + artifact.digest,
    'source_sha=' + sha,
    'artifact_id=' + artifact.id,
  ].join('\n') + '\n');
  console.log('Exact source, canonical Quality Gate and encrypted-free public CI artifact verified.');
}

async function readback() {
  const { VERCEL_TOKEN: token, DEPLOYMENT_URL: url, GITHUB_SHA: sha,
    ARTIFACT_DIGEST: zipDigest } = process.env;
  if (!token || !SHA.test(sha ?? '') || !/^[a-f0-9]{64}$/.test(zipDigest ?? ''))
    throw Error('Missing protected Vercel deployment verification inputs');
  const uri = new URL(url);
  if (uri.protocol !== 'https:' || !/^[a-z0-9-]+\.vercel\.app$/.test(uri.hostname) ||
      uri.pathname !== '/' || uri.search || uri.hash)
    throw Error('Unexpected immutable Vercel deployment origin');
  const response = await fetch(
    'https://api.vercel.com/v13/deployments/' + uri.hostname +
    '?teamId=' + CORE_VERCEL_TEAM,
    { headers: { Authorization: 'Bearer ' + token } },
  );
  if (!response.ok) throw Error('Protected Vercel deployment readback denied (' + response.status + ')');
  const deployment = await response.json();
  assertVercelDeployment(deployment, { sha, zipDigest });
  console.log('Immutable Supabase Preview READY, provider and exact CI source verified: ' + uri.origin);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mode = process.argv[2];
  const fn = mode === '--prepare' ? prepare : mode === '--readback' ? readback : null;
  if (!fn) {
    console.error('Usage: verify-supabase-preview-deploy.mjs --prepare|--readback');
    process.exitCode = 1;
  } else {
    fn().catch(err => {
      // Never log tokens, signed URLs, artifact bytes, or provider responses.
      console.error(err instanceof Error ? err.message : 'Preview verification refused');
      process.exitCode = 1;
    });
  }
}
