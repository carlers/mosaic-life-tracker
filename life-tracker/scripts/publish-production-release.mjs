// Runs only on the trusted default-branch workflow after main CI. Never executes PR code.
import { readFileSync, appendFileSync } from 'node:fs';
import { collectProductionMilestones, formatVersionMilestones, MILESTONE_START } from './lib/release-milestones.mjs';
import { execFileSync } from 'node:child_process';
import { validateVersionFiles, compareVersions } from './lib/versioning.mjs';
import {
  PRODUCTION_DOMAIN, assertProductionEvidence, decidePublication, extractReleaseNotes,
  parseProductionBuild, releaseTag, isNewProductionVersion,
} from './lib/production-release.mjs';
import {
  FIRST_PRODUCTION_RELEASE, FIRST_PRODUCTION_NOTES, historicalBootstrapDecision, assertHistoricalProof,
} from './lib/historical-release-bootstrap.mjs';

const repo = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;
const candidate = process.env.RELEASE_SHA?.trim();
if (repo !== 'carlers/mosaic-life-tracker' || !token ||
  !/^[0-9a-f]{40}$/.test(candidate || '') || process.env.GITHUB_REF !== 'refs/heads/main') {
  throw new Error('Production publisher requires trusted main workflow, GitHub token and exact release SHA');
}

async function api(path, { method = 'GET', body, allow404 = false } = {}) {
  const response = await fetch('https://api.github.com/repos/' + repo + path, {
    method, headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000),
  });
  if (allow404 && response.status === 404) return null;
  if (!response.ok) throw new Error('GitHub ' + method + ' ' + path + ': ' + response.status +
    ' ' + (await response.text()).slice(0, 500));
  return response.json();
}
const shaPattern = /^[0-9a-f]{40}$/;
async function mainSha() {
  const branch = await api('/branches/main');
  return branch.commit.sha;
}


/**
 * Single-authorized bootstrap of v0.12.1 on the *original* accepted production merge.
 * Uses the trusted publisher Actions token, not the GitHub chat connector; future
 * same-version runs are idempotent, and newer versions never enter this path.
 */
async function bootstrapFirstProductionRelease() {
  const historical = FIRST_PRODUCTION_RELEASE;
  const suffix = '/contents/life-tracker/package.json?ref=';
  const [comparison, historicCommit, historicPr, historicChecks, historicStatus,
    historicPkg, currentChecks, currentStatus] = await Promise.all([
    api('/compare/' + historical.sha + '...' + candidate),
    api('/commits/' + historical.sha),
    api('/pulls/' + historical.promotionPr),
    api('/commits/' + historical.sha + '/check-runs?per_page=100'),
    api('/commits/' + historical.sha + '/status'),
    api(suffix + historical.sha),
    api('/commits/' + candidate + '/check-runs?per_page=100'),
    api('/commits/' + candidate + '/status'),
  ]);
  if (historicCommit.sha !== historical.sha || historicCommit.parents?.length !== 2) {
    throw new Error('Historical version was not promoted through a merge commit');
  }
  const oldPkg = await api(suffix + historicCommit.parents[0].sha);
  const fromGitHub = source => JSON.parse(Buffer.from(source.content, 'base64').toString('utf8')).version;
  assertHistoricalProof({
    pr: historicPr,
    run: historicChecks,
    statuses: historicStatus.statuses,
    oldVersion: fromGitHub(oldPkg),
    releasedVersion: fromGitHub(historicPkg),
  });
  extractReleaseNotes(historicPr.body); // Must have a genuine user-facing summary in the accepted PR.
  if (comparison.merge_base_commit?.sha !== historical.sha ||
      !['ahead', 'identical'].includes(comparison.status)) {
    throw new Error('Historical production commit is not in the current main history');
  }
  if (!currentChecks.check_runs?.some(x =>
    x.name === 'canonical-acceptance' && x.conclusion === 'success' &&
    x.head_sha === candidate && x.app?.slug === 'github-actions')) {
    throw new Error('Current main acceptance must finish before bootstrapping a Release');
  }
  if (!currentStatus.statuses?.some(x =>
    x.context === 'Vercel' && x.state === 'success' &&
    typeof x.target_url === 'string' &&
    x.target_url.startsWith('https://vercel.com/carls-projects-72516fde/mosaic-life-tracker/'))) {
    throw new Error('Current production deployment has not been verified successful');
  }

  const existingTag = await tagSha();
  const existingRelease = await api('/releases/tags/' + tag, { allow404: true });
  const published = await api('/releases?per_page=100');
  const versions = published.filter(x => !x.draft && !x.prerelease &&
    typeof x.tag_name === 'string' &&
    /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(x.tag_name)
  ).map(x => x.tag_name.slice(1));
  const decision = historicalBootstrapDecision({
    currentVersion: version, previousVersion: oldVersion,
    mergeBaseSha: comparison.merge_base_commit?.sha,
    taggedSha: existingTag, existingRelease, publishedVersions: versions,
  });
  if (decision === 'already-published') {
    console.log('Historical ' + tag + ' already published: ' + existingRelease.html_url);
    return;
  }
  if (decision !== 'publish') throw new Error('Historical bootstrap unexpectedly not eligible');
  if (await mainSha() !== candidate) throw new Error('Main changed before historical tag creation');
  if (!existingTag) {
    await api('/git/refs', {
      method: 'POST', body: { ref: 'refs/tags/' + tag, sha: historical.sha },
    });
  }
  if (await tagSha() !== historical.sha) throw new Error('Historical tag points to another commit');
  if (await mainSha() !== candidate) throw new Error('Main changed before publishing historical notes');
  const created = await api('/releases', { method: 'POST', body: {
    tag_name: tag,
    target_commitish: historical.sha,
    name: 'Mosaic ' + tag + ' — Release history, navigation and everyday polish',
    body: FIRST_PRODUCTION_NOTES +
      '\n\nProduction promotion: https://github.com/' + repo + '/pull/' + historical.promotionPr,
    draft: false, prerelease: false, generate_release_notes: false,
  } });
  const confirmed = await api('/releases/tags/' + tag);
  if (!created.id || created.id !== confirmed.id || !confirmed.published_at ||
      confirmed.draft || confirmed.prerelease || await tagSha() !== historical.sha) {
    throw new Error('Historical release publication readback failed');
  }
  console.log('Published verified historical ' + tag + ': ' + confirmed.html_url);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    'Published verified historical ' + tag + ': ' + confirmed.html_url + '\n');
}

const checkoutSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (checkoutSha !== candidate) throw new Error('Checkout SHA differs from approved publication candidate');
const version = validateVersionFiles(
  JSON.parse(readFileSync('package.json', 'utf8')),
  JSON.parse(readFileSync('package-lock.json', 'utf8')),
  readFileSync('src/lib/appVersion.ts', 'utf8'),
);

const tag = releaseTag(version);
const firstMain = await mainSha();
if (firstMain !== candidate) throw new Error('Current main moved before release verification');
const commit = await api('/commits/' + candidate);
if (commit.sha !== candidate || !Array.isArray(commit.parents) || commit.parents.length !== 2) {
  console.log('Not a production promotion merge; no release.');
  process.exit(0);
}
const previous = await api('/contents/life-tracker/package.json?ref=' + commit.parents[0].sha);
const oldVersion = JSON.parse(Buffer.from(previous.content, 'base64').toString('utf8')).version;
if (!isNewProductionVersion(version, oldVersion)) {
  if (version === FIRST_PRODUCTION_RELEASE.version && oldVersion === version) {
    await bootstrapFirstProductionRelease();
  } else {
    console.log('No product version increment (' + oldVersion + ' -> ' + version + '); no release.');
  }
  process.exit(0);
}

const runs = await api('/commits/' + candidate + '/check-runs?per_page=100');
if (!runs.check_runs?.some(x =>
  x.name === 'canonical-acceptance' && x.conclusion === 'success' &&
  x.head_sha === candidate && x.app?.slug === 'github-actions')) {
  throw new Error('Exact main SHA has no successful canonical-acceptance check');
}
const prs = await api('/commits/' + candidate + '/pulls?per_page=100');
const pr = prs.find(x => x.merge_commit_sha === candidate &&
  x.base?.ref === 'main' && x.merged_at && x.state === 'closed');
if (!pr) throw new Error('No merged production promotion PR for exact main SHA');
const notes = extractReleaseNotes(pr.body);
const milestoneNotes = formatVersionMilestones(collectProductionMilestones({
  devHead: commit.parents[1].sha, previousVersion: oldVersion, version,
}));
const releaseBody = notes + '\n\nProduction promotion: ' + pr.html_url +
  (milestoneNotes ? '\n\n' + milestoneNotes : '');

let statuses;
async function readyProduction() {
  const result = await api('/commits/' + candidate + '/status');
  statuses = result.statuses;
  const response = await fetch(PRODUCTION_DOMAIN + '/?mosaic_release_verification=' + candidate, {
    headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('Production origin returned ' + response.status);
  const html = await response.text();
  assertProductionEvidence({ build: parseProductionBuild(html), sha: candidate, statuses });
}

let ready = false;
for (let attempt = 1; attempt <= 12; attempt++) {
  try { await readyProduction(); ready = true; break; }
  catch (error) {
    if (attempt === 12) throw new Error('Production was not verified after bounded retries: ' + error.message);
    console.log('Production not yet at expected SHA (' + attempt + '/12): ' + error.message);
    await new Promise(resolve => setTimeout(resolve, 15000));
  }
}
if (!ready) throw new Error('Production not READY');

// Notes-only reconstruction for the three already-published production merges.
// Verified first-parent version bounds and exact direct tag SHAs prevent invented
// releases and prevent a backfill from silently rewriting any Git history.
async function reconcileHistoricalMilestones() {
  const historical = [
    { tag: 'v0.12.1', sha: '95c8b25edeba5e2730252f6d265d392949890caa',
      previousVersion: '0.6.2', version: '0.12.1' },
    { tag: 'v0.12.2', sha: 'dbc19acd901e545511255553ed5d8b9b4deda4c1',
      previousVersion: '0.12.1', version: '0.12.2' },
    { tag: 'v0.16.6', sha: '614cd1dccbd01bf70493874496559720b320151a',
      previousVersion: '0.12.2', version: '0.16.6' },
  ];
  for (const item of historical) {
    if (compareVersions(version, item.version) < 0) continue;
    const release = await api('/releases/tags/' + item.tag, { allow404: true });
    if (!release) continue;
    if (typeof release.body !== 'string' || release.body.includes(MILESTONE_START)) continue;
    const [ref, archived, ancestry] = await Promise.all([
      api('/git/ref/tags/' + item.tag, { allow404: true }),
      api('/commits/' + item.sha),
      api('/compare/' + item.sha + '...' + candidate),
    ]);
    const prior = archived.parents?.[0]?.sha;
    let priorVersion;
    try {
      priorVersion = JSON.parse(execFileSync('git', [
        'show', prior + ':life-tracker/package.json',
      ], { encoding: 'utf8' })).version;
    } catch { throw new Error('Missing historical parent version for ' + item.tag); }
    if (ref?.object?.sha !== item.sha || ref.object.type !== 'commit' ||
        archived.parents?.length !== 2 || priorVersion !== item.previousVersion ||
        ancestry.merge_base_commit?.sha !== item.sha ||
        !['identical', 'ahead'].includes(ancestry.status) ||
        release.tag_name !== item.tag || release.target_commitish !== item.sha ||
        release.draft || release.prerelease || !release.published_at) {
      throw new Error('Historical publication proof mismatched for ' + item.tag);
    }
    const records = collectProductionMilestones({
      devHead: archived.parents[1].sha,
      previousVersion: item.previousVersion, version: item.version,
    });
    // Dev merges can squash several previously accepted stable Preview patches
    // into one later production version. Use the reviewed PR-backed archive to
    // restore those intermediate shipped versions without inventing tags.
    const archivedVersions = JSON.parse(readFileSync('src/data/releaseVersionArchive.json', 'utf8'))
      .filter(entry => entry.productionTag === item.tag);
    const proven = await Promise.all(archivedVersions.map(async entry => {
      if (!/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(entry.tag) ||
          compareVersions(entry.tag.slice(1), item.previousVersion) <= 0 ||
          compareVersions(entry.tag.slice(1), item.version) > 0 ||
          !Number.isSafeInteger(entry.pr) ||
          !/^[a-f0-9]{40}$/.test(entry.commit)) {
        throw new Error('Invalid archived milestone ' + entry.tag);
      }
      const pr = await api('/pulls/' + entry.pr);
      if (pr.merge_commit_sha !== entry.commit || !pr.merged_at ||
          typeof pr.base?.ref !== 'string' ||
          !pr.base.ref.startsWith('feature/')) {
        throw new Error('Archived milestone PR provenance mismatch for ' + entry.tag);
      }
      // The original stable Preview merge tree must carry the actual version,
      // not merely a version-looking title.
      const source = await api('/contents/life-tracker/package.json?ref=' + entry.commit);
      const actualVersion = JSON.parse(Buffer.from(source.content, 'base64').toString('utf8')).version;
      if (actualVersion !== entry.tag.slice(1)) {
        throw new Error('Archived milestone tree version mismatch for ' + entry.tag);
      }
      return { tag: entry.tag, title: entry.title, notes: entry.notes };
    }));
    const known = new Set(records.map(entry => entry.tag));
    for (const entry of proven) if (!known.has(entry.tag)) {
      records.push(entry);
      known.add(entry.tag);
    }
    records.sort((a, b) => compareVersions(b.tag.slice(1), a.tag.slice(1)));
    const details = formatVersionMilestones(records);
    if (!details) continue;
    if (await mainSha() !== candidate) throw new Error('Main changed before historical notes backfill');
    const updated = await api('/releases/' + release.id, {
      method: 'PATCH', body: { body: release.body.trim() + '\n\n' + details },
    });
    if (updated.id !== release.id || !updated.body?.includes(MILESTONE_START)) {
      throw new Error('Historical release notes backfill failed for ' + item.tag);
    }
  }
}
await reconcileHistoricalMilestones();

async function tagSha() {
  const ref = await api('/git/ref/tags/' + tag, { allow404: true });
  if (!ref) return null;
  if (ref.object?.type !== 'commit' || !shaPattern.test(ref.object.sha)) {
    throw new Error('Existing tag is not a direct immutable commit ref');
  }
  return ref.object.sha;
}
let existingTag = await tagSha();
const existingRelease = await api('/releases/tags/' + tag, { allow404: true });
const published = await api('/releases?per_page=100');
const versions = published.filter(x =>
  !x.draft && !x.prerelease && typeof x.tag_name === 'string' &&
  /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(x.tag_name)
).map(x => x.tag_name.slice(1)).sort((a, b) => compareVersions(b, a));
const decision = decidePublication({
  version, priorVersion: versions[0] || null, currentSha: candidate,
  mainSha: await mainSha(), taggedSha: existingTag, existingRelease,
});

if (decision === 'already-published') {
  const url = existingRelease.html_url;
  console.log('Already published: ' + url);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, 'Already published: ' + url + '\n');
} else {
  if (!existingTag) {
    await api('/git/refs', { method: 'POST', body: { ref: 'refs/tags/' + tag, sha: candidate } });
    existingTag = await tagSha();
  }
  if (existingTag !== candidate) throw new Error('Tag SHA differs from exact approved production merge');
  if (await mainSha() !== candidate) throw new Error('Main advanced before publication');
  // Re-check live origin before making a published record; no Preview-only history.
  await readyProduction();
  const created = await api('/releases', { method: 'POST', body: {
    tag_name: tag, target_commitish: candidate, name: 'Mosaic ' + tag,
    body: releaseBody, draft: false, prerelease: false, generate_release_notes: false,
  } });
  const confirmed = await api('/releases/tags/' + tag);
  if (!created.id || confirmed.id !== created.id || confirmed.draft || confirmed.prerelease ||
      !confirmed.published_at || await tagSha() !== candidate) {
    throw new Error('Published release readback failed');
  }
  console.log('Published ' + tag + ': ' + confirmed.html_url);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    'Published ' + tag + ': ' + confirmed.html_url + '\n');
}
