#!/usr/bin/env node
// Default-main, credential-bearing, always-OFF-until-approved prebuilt writer.
// Imports ONLY fixed main-reviewed Node source. Never executes candidate code.
import { readFileSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { admitVerifiedArtifact, recheckTrustedAdmission } from './lib/prebuilt-admission-runner.mjs';
import { assembleVerifiedCandidateStatic } from './lib/prebuilt-candidate-payload.mjs';
import {
  VERCEL_TEAM_ID, VERCEL_PROJECT_ID, CANARY_BRANCH, CANARY_ALIAS,
  assertPrebuiltProject, assertCanaryGitDisabled, findPrebuiltCandidate,
  assertPrebuiltReady, prebuiltCliArgs, assertAliasTarget,
} from './lib/prebuilt-provider-policy.mjs';

const GH = 'https://api.github.com/repos/carlers/mosaic-life-tracker';
const TOKEN = process.env.VERCEL_TOKEN ?? '';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? '';
const createEnabled = process.env.MOSAIC_TRUSTED_PREVIEW_CREATE_ENABLED === 'true';
const aliasEnabled = process.env.MOSAIC_TRUSTED_PREVIEW_ALIAS_ENABLED === 'true';
const binary = process.env.MOSAIC_TRUSTED_VERCEL_BIN ?? '';
const github = path => json(GH + path, GITHUB_TOKEN, 'Trusted source');

async function json(url, bearer, name, extra = {}) {
  if (!bearer) throw new Error(name + ' credentials unavailable');
  const { headers: moreHeaders, ...rest } = extra;
  const res = await fetch(url, {
    ...rest,
    headers: { Authorization: 'Bearer ' + bearer,
      Accept: 'application/json', ...(moreHeaders ?? {}) },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(name + ' HTTP ' + res.status);
  return res.json();
}
const vercel = (path, extra) => json('https://api.vercel.com' + path,
  TOKEN, 'Vercel protected Preview readback', extra);

async function canaryGitAutoDeploymentDisabled(sha) {
  const file = await github('/contents/life-tracker/vercel.json?ref=' + encodeURIComponent(sha));
  if (file?.encoding !== 'base64' || typeof file.content !== 'string' ||
      file.size > 65536) throw new Error('Cannot authenticate candidate Vercel config');
  let config;
  try { config = JSON.parse(Buffer.from(file.content, 'base64').toString('utf8')); }
  catch { throw new Error('Malformed candidate Vercel config'); }
  assertCanaryGitDisabled(config);
}

async function findAlreadyDeployed(acceptedRun, timestamp) {
  const since = Date.parse(timestamp ?? '');
  if (!Number.isFinite(since) || since <= 0 || since > Date.now() + 300000)
    throw new Error('Invalid canonical source commit timestamp');
  let until = null;
  for (let page = 0; page < 8; page++) {
    const q = new URLSearchParams({ teamId: VERCEL_TEAM_ID,
      projectId: VERCEL_PROJECT_ID,
      limit: '100', since: String(Math.max(0, since - 3600000)) });
    if (until !== null) q.set('until', String(until));
    const list = await vercel('/v6/deployments?' + q);
    if (!Array.isArray(list.deployments) || !list.pagination)
      throw new Error('Incomplete provider deployment history');
    // A Git deployment at this SHA proves the old path still raced the writer.
    if (list.deployments.some(item =>
      item?.source === 'git' &&
      item?.meta?.githubCommitSha === acceptedRun.sha &&
      item?.meta?.githubCommitRef === CANARY_BRANCH))
      throw new Error('Git auto-deployment still active for accepted canary: no duplicate POST');
    const match = findPrebuiltCandidate(list.deployments, acceptedRun);
    if (match) return match;
    const next = list.pagination.next;
    if (next == null) return null;
    if (!Number.isSafeInteger(next) || next <= 0 ||
        (until !== null && next >= until))
      throw new Error('Untrusted provider history pagination');
    until = next;
  }
  throw new Error('Provider deployment history exceeded bounded scan');
}

async function fullDeployment(id, run) {
  const name = encodeURIComponent(id);
  for (let attempt = 0; attempt < 24; attempt++) {
    const x = await vercel('/v13/deployments/' + name +
      '?teamId=' + encodeURIComponent(VERCEL_TEAM_ID));
    const state = x.readyState ?? x.state;
    if (state === 'READY') return assertPrebuiltReady(x, run);
    if (['ERROR','CANCELED','DELETED'].includes(state))
      throw new Error('Prebuilt Preview failed to become READY');
    if (attempt < 23) await new Promise(resolve => setTimeout(resolve, 12000));
  }
  throw new Error('Prebuilt Preview exceeded READY polling budget');
}

async function aliasesFor(id) {
  const a = await vercel('/v2/deployments/' + encodeURIComponent(id) +
    '/aliases?teamId=' + encodeURIComponent(VERCEL_TEAM_ID));
  if (!Array.isArray(a.aliases)) throw new Error('Missing complete provider alias readback');
  return a.aliases;
}

async function main() {
  // The writer never runs as a development shortcut: it must be explicitly
  // enabled only on main, after the exact CI artifact and project review.
  if (!createEnabled || process.env.MOSAIC_PREBUILT_WRITER_ENABLED !== 'true' ||
      process.env.GITHUB_REF !== 'refs/heads/main')
    throw new Error('Prebuilt provider writer is not explicitly enabled on trusted main');
  if (!TOKEN || !GITHUB_TOKEN || !binary.startsWith(process.env.RUNNER_TEMP + '/'))
    throw new Error('Untrusted/missing protected provider credentials or pinned CLI path');
  const { event, acceptedRun, verified } = await admitVerifiedArtifact();
  if (acceptedRun.branch !== CANARY_BRANCH)
    throw new Error('Prebuilt writer limited to approved canary');
  await canaryGitAutoDeploymentDisabled(acceptedRun.sha);
  const project = await vercel('/v9/projects/' +
    encodeURIComponent(VERCEL_PROJECT_ID) +
    '?teamId=' + encodeURIComponent(VERCEL_TEAM_ID));
  assertPrebuiltProject(project);
  const commit = await github('/commits/' + acceptedRun.sha);
  const prior = await findAlreadyDeployed(acceptedRun, commit.commit?.committer?.date);
  if (!prior) await recheckTrustedAdmission(event, acceptedRun);
  let id = prior?.id;
  let tmp;
  try {
    if (!id) {
      tmp = await mkdtemp(join(tmpdir(), 'mosaic-592-accepted-preview-'));
      const root = join(tmp, 'output');
      await assembleVerifiedCandidateStatic(verified, root);
      await writeFile(join(root, '.vercel', 'project.json'),
        JSON.stringify({orgId:VERCEL_TEAM_ID, projectId:VERCEL_PROJECT_ID})+'\n',
        {flag:'wx'});
      await recheckTrustedAdmission(event, acceptedRun);
      // Prebuilt: NO vite/npm/project scripts run here. The pinned official
      // Vercel CLI uploads already-verified static files only.
      let output;
      try {
        output = execFileSync(binary, prebuiltCliArgs(acceptedRun), {
          cwd: root, encoding:'utf8', timeout:180000,
          env: {...process.env, VERCEL_ORG_ID:VERCEL_TEAM_ID,
            VERCEL_PROJECT_ID, VERCEL_TOKEN:TOKEN,
            CI:'1', VERCEL_TELEMETRY_DISABLED:'1'},
          stdio:['ignore','pipe','pipe'], maxBuffer:1024*1024,
        }).trim();
      } catch {
        throw new Error('Pinned Preview CLI failed; no automatic retry may consume another quota slot');
      }
      // Treat CLI output as untrusted: require a host-only returned identity.
      const match = /^https:\/\/([a-z0-9-]+\.vercel\.app)\/?$/.exec(output);
      if (!match) throw new Error('Untrusted prebuilt CLI deployment URL');
      id = match[1];
    }
    const ready = await fullDeployment(id, acceptedRun);
    console.log('Trusted prebuilt Preview READY, exact SHA ' + acceptedRun.sha +
      ', run ' + acceptedRun.runId + '/' + acceptedRun.attempt +
      ', deployment ' + ready.id + ', reused=' + Boolean(prior));
    if (!aliasEnabled) {
      console.log('Provider alias remains OFF; manual URL testing may proceed.');
      return;
    }
    await recheckTrustedAdmission(event, acceptedRun);
    if (!(await aliasesFor(ready.id)).some(x => x?.alias === CANARY_ALIAS)) {
      await vercel('/v2/deployments/' + encodeURIComponent(ready.id) +
        '/aliases?teamId=' + encodeURIComponent(VERCEL_TEAM_ID), {
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({alias:CANARY_ALIAS}),
        });
    }
    assertAliasTarget(await aliasesFor(ready.id), ready.id);
    console.log('Reviewed stable Preview alias is verified at accepted SHA');
  } finally {
    if (tmp) await rm(tmp,{recursive:true,force:true});
  }
}

main().catch(error => {
  // Never print API tokens, CLI stdout or raw build artifacts.
  console.error(error instanceof Error ? error.message : 'Trusted prebuilt writer blocked');
  process.exitCode = 1;
});
