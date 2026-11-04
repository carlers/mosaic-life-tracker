// Trusted default-branch release-history publishing primitives. No provider I/O.
const SHA = /^[a-f0-9]{40}$/;
const VERSION = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const BRANCH = /^(feature|fix|perf|security|refactor)\/[a-zA-Z0-9._/-]{1,160}$/;
const STAGES = new Set(['preview', 'dev', 'production']);
export const MAX_HISTORY_EVENTS = 1200;

export function validateHistoryEvent(entry) {
  if (!entry || !STAGES.has(entry.stage) ||
      !SHA.test(entry.sha ?? '') || !SHA.test(entry.lineageId ?? '') ||
      !VERSION.test(entry.tag ?? '') ||
      entry.id !== entry.stage + ':' + entry.sha ||
      !(entry.stage === 'preview' ? BRANCH.test(entry.branch ?? '') :
        entry.branch === (entry.stage === 'dev' ? 'dev' : 'main')) ||
      !Number.isFinite(Date.parse(entry.recordedAt ?? '')) ||
      typeof entry.title !== 'string' || entry.title.length > 180 ||
      typeof entry.notes !== 'string' || entry.notes.length > 2400 ||
      entry.url !== 'https://github.com/carlers/mosaic-life-tracker/commit/' + entry.sha) {
    throw new Error('Invalid verified history event');
  }
  return entry;
}

export function parseHistoryManifest(value) {
  if (!value || value.schema !== 1 || !Array.isArray(value.events) ||
      value.events.length > MAX_HISTORY_EVENTS) throw new Error('Invalid history manifest');
  const seen = new Set();
  for (const event of value.events) {
    validateHistoryEvent(event);
    if (seen.has(event.id)) throw new Error('Duplicate history event ID');
    seen.add(event.id);
  }
  return value;
}

export function chooseLineage(events, stage, sha, parents, tag) {
  if (stage === 'preview') return sha;
  // A verified merge's second parent is the promoted Preview/Dev commit.
  // Version equality alone is never evidence of shared release lineage.
  const promoted = Array.isArray(parents) && parents.length === 2 ? parents[1]?.sha : null;
  const expectedStage = stage === 'dev' ? 'preview' : 'dev';
  const matched = events.find(event =>
    event.stage === expectedStage && event.sha === promoted && event.tag === tag);
  return matched?.lineageId || sha;
}

export function appendVerifiedHistory(manifest, event) {
  parseHistoryManifest(manifest);
  validateHistoryEvent(event);
  const old = manifest.events.find(item => item.id === event.id);
  if (old) {
    if (JSON.stringify(old) !== JSON.stringify(event)) {
      throw new Error('Immutable history event conflict');
    }
    return { changed: false, value: manifest };
  }
  if (manifest.events.length >= MAX_HISTORY_EVENTS) {
    throw new Error('History capacity reached; archival schema expansion required');
  }
  return {
    changed: true,
    value: { schema: 1, events: [...manifest.events, event].sort((a, b) =>
      Date.parse(a.recordedAt) - Date.parse(b.recordedAt)) },
  };
}

export function releaseNotesFromCommit(message) {
  if (typeof message !== 'string') throw new Error('No release commit message');
  const lines = message.split(/\r?\n/);
  const title = (lines[0] || '').trim().slice(0, 180);
  if (!title) throw new Error('Missing release subject');
  // Git-owned, already-public human-facing notes. No raw logs, secrets, or
  // unreviewed GitHub API bodies are included.
  const bullets = lines.slice(1).map(line => line.trim())
    .filter(line => /^-\s+/.test(line) && line.length <= 190)
    .filter(line => !/(?:token|secret|credential|password|private key|api key)/i.test(line))
    .slice(0, 5);
  return { title, notes: bullets.join('\n').slice(0, 2400) };
}
