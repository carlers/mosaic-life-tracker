#!/usr/bin/env node
// Trusted default-branch data publisher. Never checkout or execute candidate
// source, never change Vercel aliases, application branches or Production tags.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import {
  appendVerifiedHistory, chooseLineage, parseHistoryManifest,
  releaseNotesFromCommit,
} from './lib/development-history-publisher.mjs';

const REPO = 'carlers/mosaic-life-tracker';
const ROOT = 'https://api.github.com/repos/' + REPO;
const HISTORY_REF = 'mosaic-release-history';
const PROJECT = 'prj_jysOLDbuO9c5rP8x6Q145DVIw0fc';
const TEAM = 'team_UbpudOr8jXyrDA5SdVUxVGOr';
const DEV_ALIAS = 'mosaic-life-tracker-git-dev-carls-projects-72516fde.vercel.app';
const STAGE = process.env.HISTORY_STAGE;
const SHA = process.env.HISTORY_SHA || '';
const BRANCH = process.env.HISTORY_BRANCH || '';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const shaPattern = /^[a-f0-9]{40}$/;
const branchPattern = /^(feature|fix|perf|security|refactor)\/[a-zA-Z0-9._/-]{1,160}$/;

async function request(url, token, { method = 'GET', body, allow404 = false } = {}) {
  const res = await fetch(url, {
    method, headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  if (allow404 && res.status === 404) return null;
  if (!res.ok) throw new Error('History provider ' + method + ' HTTP ' + res.status);
  return res.json();
}
const gh = (path, options) => request(ROOT + path, GITHUB_TOKEN, options);
const vercel = (path) => request('https://api.vercel.com' + path, VERCEL_TOKEN);
const branchRef = (name) => '/git/ref/heads/' + name.split('/').map(encodeURIComponent).join('/');

async function assertLiveBranch() {
  const ref = await gh(branchRef(BRANCH));
  if (ref?.object?.sha !== SHA) throw new Error('History source branch moved');
}

async function assertTrustedContext() {
  if (process.env.GITHUB_REPOSITORY !== REPO || !GITHUB_TOKEN ||
      !shaPattern.test(SHA) || !['dev', 'preview', 'production'].includes(STAGE) ||
      (STAGE === 'preview' ? !branchPattern.test(BRANCH) :
        BRANCH !== (STAGE === 'dev' ? 'dev' : 'main'))) {
    throw new Error('Untrusted history publisher context');
  }
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  if (STAGE === 'preview') {
    if (process.env.GITHUB_EVENT_NAME !== 'workflow_run' ||
        process.env.GITHUB_REF !== 'refs/heads/main' ||
        event.workflow_run?.name !== 'Quality Gate' ||
        event.workflow_run?.conclusion !== 'success' ||
        event.workflow_run?.event !== 'push' ||
        event.workflow_run?.head_repository?.full_name !== REPO ||
        event.workflow_run?.head_sha !== SHA ||
        event.workflow_run?.head_branch !== BRANCH) {
      throw new Error('Preview history requires accepted Quality Gate event');
    }
  } else if (STAGE === 'dev') {
    if (process.env.GITHUB_EVENT_NAME !== 'workflow_run' ||
        process.env.GITHUB_REF !== 'refs/heads/main' ||
        event.workflow_run?.name !== 'Dev Stable PWA Alias Delivery' ||
        event.workflow_run?.head_repository?.full_name !== REPO ||
        event.workflow_run?.head_branch !== 'dev' ||
        event.workflow_run?.head_sha !== SHA ||
        event.workflow_run?.event !== 'push' ||
        event.workflow_run?.conclusion !== 'success') {
      throw new Error('Dev history requires successful trusted alias delivery event');
    }
  } else if (process.env.GITHUB_REF !== 'refs/heads/main' ||
      !['workflow_run', 'workflow_dispatch', 'schedule'].includes(process.env.GITHUB_EVENT_NAME)) {
    throw new Error('Production history requires trusted main release publisher');
  }
  const checkedOut = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const currentMain = await gh(branchRef('main'));
  if (currentMain.object?.sha !== checkedOut && STAGE !== 'production') {
    throw new Error('History script is not from current trusted main');
  }
  if (STAGE === 'production' && checkedOut !== SHA) {
    throw new Error('Production history checkout does not match verified release');
  }
  await assertLiveBranch();
  const checks = await gh('/commits/' + SHA + '/check-runs?per_page=100');
  if (!Array.isArray(checks.check_runs) || checks.total_count > 100) {
    throw new Error('Incomplete history acceptance evidence');
  }
  const latest = checks.check_runs.filter(c => c.name === 'canonical-acceptance')
    .sort((a, b) => b.id - a.id)[0];
  if (!latest || latest.head_sha !== SHA || latest.status !== 'completed' ||
      latest.conclusion !== 'success' || latest.app?.slug !== 'github-actions') {
    throw new Error('History source lacks exact canonical acceptance');
  }
}

async function assertDeployment() {
  if (STAGE === 'production') return; // Official Release publishing validates Production.
  if (!VERCEL_TOKEN) throw new Error('Missing read-only Vercel evidence credential');
  if (STAGE === 'dev') {
    const alias = await vercel('/v4/aliases/' + encodeURIComponent(DEV_ALIAS) + '?teamId=' + TEAM);
    if (alias.alias !== DEV_ALIAS || alias.projectId !== PROJECT ||
        !alias.deploymentId || alias.redirect != null) {
      throw new Error('Dev alias identity mismatch');
    }
    const dep = await vercel('/v13/deployments/' + alias.deploymentId + '?teamId=' + TEAM);
    if ((dep.readyState ?? dep.state) !== 'READY' ||
        (dep.projectId ?? dep.project?.id) !== PROJECT ||
        ![null, undefined, 'preview'].includes(dep.target) ||
        dep.meta?.githubCommitSha !== SHA ||
        dep.meta?.githubCommitRef !== 'dev') {
      throw new Error('Dev alias is not at verified READY SHA');
    }
    return;
  }
  // A successful trusted-prebuilt-deploy job is also required as a job
  // dependency. Re-read exact project/commit/branch before recording it.
  const commit = await gh('/commits/' + SHA);
  const since = Date.parse(commit.commit?.committer?.date ?? '') - 86400000;
  if (!Number.isFinite(since)) throw new Error('Preview commit date unavailable');
  let until;
  for (let page = 0; page < 5; page++) {
    const query = new URLSearchParams({
      teamId: TEAM, projectId: PROJECT, since: String(since), limit: '100',
    });
    if (until) query.set('until', String(until));
    const response = await vercel('/v6/deployments?' + query);
    if (!Array.isArray(response.deployments) || !response.pagination) {
      throw new Error('Incomplete Preview provider history');
    }
    for (const item of response.deployments) {
      const meta = item?.meta || {};
      const identityMatch = (meta.mosaicPrebuiltSha === SHA &&
        meta.mosaicPrebuiltBranch === BRANCH) ||
        (meta.githubCommitSha === SHA && meta.githubCommitRef === BRANCH);
      if (!identityMatch || !item.uid && !item.id) continue;
      const id = item.uid || item.id;
      const dep = await vercel('/v13/deployments/' + encodeURIComponent(id) + '?teamId=' + TEAM);
      const full = dep.meta || {};
      if ((dep.readyState ?? dep.state) === 'READY' &&
          (dep.projectId ?? dep.project?.id) === PROJECT &&
          [null, undefined, 'preview'].includes(dep.target) &&
          ((full.mosaicPrebuiltSha === SHA && full.mosaicPrebuiltBranch === BRANCH) ||
            (full.githubCommitSha === SHA && full.githubCommitRef === BRANCH))) return;
    }
    if (response.pagination.next == null) break;
    if (!Number.isSafeInteger(response.pagination.next) || response.pagination.next <= 0 ||
        (until && response.pagination.next >= until)) {
      throw new Error('Invalid Preview pagination');
    }
    until = response.pagination.next;
  }
  throw new Error('Verified READY Preview deployment not found');
}

async function versionAt(sha) {
  const file = await gh('/contents/life-tracker/package.json?ref=' + encodeURIComponent(sha));
  if (file.encoding !== 'base64' || typeof file.content !== 'string') {
    throw new Error('Invalid version file evidence');
  }
  const version = JSON.parse(Buffer.from(file.content, 'base64').toString('utf8')).version;
  if (!/^0\.\d+\.\d+$/.test(version)) throw new Error('Unsupported product version');
  return 'v' + version;
}

async function hasPublishedRelease(tag) {
  const [release, ref] = await Promise.all([
    gh('/releases/tags/' + tag, { allow404: true }),
    gh('/git/ref/tags/' + tag, { allow404: true }),
  ]);
  if (!release && !ref) return false;
  // A later main-only maintenance commit can carry an earlier version.
  // Only that exact published release SHA is a Production event.
  if (!release || release.tag_name !== tag || release.draft || release.prerelease ||
      !release.published_at || ref?.object?.sha !== SHA) return false;
  return true;
}

async function loadManifest() {
  const ref = await gh(branchRef(HISTORY_REF), { allow404: true });
  if (!ref) return { head: null, tree: null, value: { schema: 1, events: [] } };
  const commit = await gh('/git/commits/' + ref.object.sha);
  if (!shaPattern.test(commit.tree?.sha ?? '')) throw new Error('Invalid history branch tree');
  const file = await gh('/contents/history.json?ref=' + HISTORY_REF);
  if (file.encoding !== 'base64' || typeof file.content !== 'string' ||
      file.size > 2000000) throw new Error('Invalid public history file');
  return {
    head: ref.object.sha, tree: commit.tree.sha,
    value: parseHistoryManifest(JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'))),
  };
}

async function publishManifest(current, next, event) {
  await assertLiveBranch();
  const tree = await gh('/git/trees', { method: 'POST', body: {
    ...(current.tree ? { base_tree: current.tree } : {}),
    tree: [{ path: 'history.json', mode: '100644', type: 'blob',
      content: JSON.stringify(next, null, 2) + '\n' }],
  } });
  const commit = await gh('/git/commits', { method: 'POST', body: {
    message: 'docs(history): record verified ' + event.stage + ' ' + event.tag +
      ' ' + event.sha.slice(0, 8),
    tree: tree.sha,
    parents: current.head ? [current.head] : [],
  } });
  await assertLiveBranch();
  if (current.head) {
    await gh('/git/refs/heads/' + HISTORY_REF, {
      method: 'PATCH', body: { sha: commit.sha, force: false },
    });
  } else {
    await gh('/git/refs', { method: 'POST', body: {
      ref: 'refs/heads/' + HISTORY_REF, sha: commit.sha,
    } });
  }
  const updated = await gh(branchRef(HISTORY_REF));
  if (updated.object?.sha !== commit.sha) throw new Error('History write readback mismatch');
}

async function main() {
  await assertTrustedContext();
  const tag = await versionAt(SHA);
  const source = await gh('/commits/' + SHA);
  if (source.sha !== SHA || !Array.isArray(source.parents)) throw new Error('Invalid source commit');
  // History includes user-testable version changes, not same-version
  // metadata-only commits which should not appear as new app releases.
  if (STAGE !== 'preview' && source.parents.length) {
    const previous = await versionAt(source.parents[0].sha);
    if (previous === tag && STAGE === 'dev') {
      console.log('Same-version Dev update; no new release-history event');
      return;
    }
  }
  if (STAGE === 'production' && !(await hasPublishedRelease(tag))) {
    console.log('No new verified Production Release at current SHA; history unchanged');
    return;
  }
  await assertDeployment();
  const current = await loadManifest();
  const existing = current.value.events.find(e => e.id === STAGE + ':' + SHA);
  if (existing) {
    if (existing.tag !== tag || existing.stage !== STAGE || existing.branch !== BRANCH) {
      throw new Error('Existing immutable event conflicts with verified source');
    }
    console.log('Verified history event already published: ' + existing.id);
    return;
  }
  const notes = releaseNotesFromCommit(source.commit?.message);
  const event = {
    id: STAGE + ':' + SHA, tag, stage: STAGE, branch: BRANCH, sha: SHA,
    lineageId: chooseLineage(current.value.events, STAGE, SHA, source.parents, tag),
    recordedAt: new Date().toISOString(),
    title: notes.title, notes: notes.notes,
    url: 'https://github.com/' + REPO + '/commit/' + SHA,
  };
  const updated = appendVerifiedHistory(current.value, event);
  if (!updated.changed) return;
  await publishManifest(current, updated.value, event);
  console.log('Recorded verified ' + STAGE + ' history for ' + tag + ' @' + SHA);
}
main().catch(error => {
  console.error(error instanceof Error ? error.message : 'History publisher blocked');
  process.exitCode = 1;
});
