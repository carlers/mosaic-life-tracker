#!/usr/bin/env node
// Trusted Main-only, bounded enrichment of ALREADY verified Preview/Dev events.
// No branch/deployment proof is invented or changed; history.json is read-only.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import {
  appendNoteAnnotation, parseHistoryManifest, parseNoteAnnotationManifest,
  releaseNotesFromCatalog, releaseNotesFromCommit, releaseNotesFromPullRequest,
} from './lib/development-history-publisher.mjs';

const REPO = 'carlers/mosaic-life-tracker';
const ROOT = 'https://api.github.com/repos/' + REPO;
const HISTORY = 'mosaic-release-history';
const TOKEN = process.env.GITHUB_TOKEN;
const COMMIT_URL = 'https://github.com/' + REPO + '/commit/';
const SHA = /^[a-f0-9]{40}$/;
async function gh(path, options = {}) {
  const res = await fetch(ROOT + path, {
    method: options.method ?? 'GET',
    headers: {
      Authorization: 'Bearer ' + TOKEN,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  if (options.allow404 && res.status === 404) return null;
  if (!res.ok) throw new Error('History annotation provider HTTP ' + res.status);
  return res.json();
}
function decodeFile(file, max) {
  if (!file || file.encoding !== 'base64' ||
      typeof file.content !== 'string' || file.size > max) {
    throw new Error('Invalid history annotation input file');
  }
  return JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'));
}
async function liveMain() {
  const main = await gh('/git/ref/heads/main');
  const checkedOut = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (!SHA.test(checkedOut) || main.object?.sha !== checkedOut) {
    throw new Error('Historical notes must execute from current trusted Main');
  }
  return checkedOut;
}
async function sourceNotes(event) {
  const source = await gh('/commits/' + event.sha);
  if (source.sha !== event.sha || !source.commit?.message ||
      source.html_url !== COMMIT_URL + event.sha) {
    throw new Error('Source commit identity mismatch');
  }
  // First recover human-reviewed notes from the exact recorded source tree.
  // Older commits without a matching catalog continue through conservative
  // commit/merged-PR extraction; no version-only cross-branch attribution.
  const file = await gh('/contents/life-tracker/src/data/pwaUpdateNotes.json?ref=' +
    encodeURIComponent(event.sha), { allow404: true });
  if (file) {
    if (file.encoding !== 'base64' || typeof file.content !== 'string' ||
        file.size > 20000) throw new Error('Invalid historical exact-source PWA catalog');
    const catalog = JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'));
    const curated = releaseNotesFromCatalog(event.tag, catalog);
    if (curated) return curated.notes;
  }
  const fromCommit = releaseNotesFromCommit(source.commit.message).notes;
  if (fromCommit) return fromCommit;
  // PR notes are only accepted when merged into this exact verified
  // deployment SHA and branch and they use an explicit reviewed section.
  const prs = await gh('/commits/' + event.sha + '/pulls?per_page=30');
  if (!Array.isArray(prs)) throw new Error('Invalid source PR evidence');
  const accepted = prs.find(pr => pr.merge_commit_sha === event.sha &&
    pr.merged_at && pr.base?.repo?.full_name === REPO &&
    pr.base?.ref === event.branch);
  return accepted ? releaseNotesFromPullRequest(accepted.body) : '';
}
async function main() {
  if (process.env.GITHUB_REPOSITORY !== REPO ||
      process.env.GITHUB_REF !== 'refs/heads/main' || !TOKEN ||
      !['workflow_dispatch', 'schedule', 'workflow_run'].includes(process.env.GITHUB_EVENT_NAME)) {
    throw new Error('Untrusted historical annotation context');
  }
  const sourceMain = await liveMain();
  if (process.env.GITHUB_EVENT_NAME === 'workflow_run') {
    // The workflow's exact-Main success gate is duplicated inside the script,
    // so an accidental broadening of YAML cannot run untrusted note writes.
    if (!process.env.GITHUB_EVENT_PATH) throw new Error('Missing canonical event context');
    const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
    const run = event.workflow_run;
    if (run?.name !== 'Quality Gate' ||
        run?.head_repository?.full_name !== REPO ||
        run?.head_branch !== 'main' ||
        run?.head_sha !== sourceMain ||
        run?.event !== 'push' ||
        run?.conclusion !== 'success') {
      throw new Error('Historical notes require exact successful Main Quality Gate');
    }
  }
  const head = await gh('/git/ref/heads/' + HISTORY);
  if (!SHA.test(head?.object?.sha ?? '')) throw new Error('History ref missing');
  const parent = head.object.sha;
  const commit = await gh('/git/commits/' + parent);
  if (!SHA.test(commit.tree?.sha ?? '')) throw new Error('History tree missing');
  const manifest = parseHistoryManifest(decodeFile(
    await gh('/contents/history.json?ref=' + HISTORY), 2000000));
  const oldNotes = await gh('/contents/notes.json?ref=' + HISTORY, { allow404: true });
  let next = parseNoteAnnotationManifest(oldNotes
    ? decodeFile(oldNotes, 3200000) : { schema: 1, annotations: [] });
  const known = new Set(next.annotations.map(note => note.id));
  const missing = manifest.events.filter(event =>
    (event.stage === 'dev' || event.stage === 'preview') &&
    !event.notes.trim() && !known.has(event.id));
  if (missing.length > 400) throw new Error('Too many missing notes; review backfill budget');
  let recovered = 0, unverified = 0;
  // Small bounded batches avoid bursty GitHub requests.
  for (let i = 0; i < missing.length; i += 4) {
    const batch = await Promise.all(missing.slice(i, i + 4).map(async event => ({
      event, notes: await sourceNotes(event),
    })));
    for (const { event, notes } of batch) {
      if (!notes) { unverified++; continue; }
      next = appendNoteAnnotation(next, {
        id: event.id, notes, source: COMMIT_URL + event.sha,
      }).value;
      recovered++;
    }
  }
  if (!recovered) {
    console.log('Historical notes unchanged; missing=' + missing.length +
      ' unverified=' + unverified);
    return;
  }
  if (await liveMain() !== sourceMain ||
      (await gh('/git/ref/heads/' + HISTORY)).object?.sha !== parent) {
    throw new Error('History or trusted Main moved during annotation recovery');
  }
  const tree = await gh('/git/trees', { method: 'POST', body: {
    base_tree: commit.tree.sha,
    tree: [{ path: 'notes.json', mode: '100644', type: 'blob',
      content: JSON.stringify(next, null, 2) + '\n' }],
  } });
  const update = await gh('/git/commits', { method: 'POST', body: {
    message: 'docs(history): append ' + recovered + ' verified release-note annotations',
    tree: tree.sha, parents: [parent],
  } });
  if (await liveMain() !== sourceMain ||
      (await gh('/git/ref/heads/' + HISTORY)).object?.sha !== parent) {
    throw new Error('History ref changed before non-force annotation write');
  }
  await gh('/git/refs/heads/' + HISTORY, {
    method: 'PATCH', body: { sha: update.sha, force: false },
  });
  const recorded = await gh('/git/ref/heads/' + HISTORY);
  if (recorded.object?.sha !== update.sha) {
    throw new Error('Historical note write readback mismatch');
  }
  const written = parseNoteAnnotationManifest(decodeFile(
    await gh('/contents/notes.json?ref=' + HISTORY), 3200000));
  if (written.annotations.length !== next.annotations.length) {
    throw new Error('Historical note manifest readback mismatch');
  }
  console.log('Historical notes recovered=' + recovered +
    ' unverified=' + unverified + ' total=' + written.annotations.length);
}
main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Historical notes blocked');
  process.exitCode = 1;
});
