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

// An uninitialized feed may seed the current verified Dev version once, even
// if previous commits reused its version. Later same-version commits are not releases.
export function shouldRecordDevHistoryEvent(tag, previousTag, events) {
  return previousTag !== tag || !events.some(event => event.stage === 'dev' && event.tag === tag);
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

// A user-facing section takes priority; ordinary commit body prose is a
// conservative fallback for existing squash/merge messages without bullets.
const SENSITIVE_VALUE = /(?:ghp_[a-z0-9]{15,}|github_pat_[a-z0-9_]+|sk-[a-z0-9]{15,}|-----BEGIN [^-]*PRIVATE KEY|(?:password|token|secret|credential|api[_ -]?key)\s*[:=]\s*[^\s]+)/i;
const PROVENANCE = /^(?:refs?\b|(?:closes|fixes)\s+#\d+|(?:accepted|verified|trusted|protected|canonical|quality gate|ci|preview source|preview url|deployment|deployed|pr preflight|run #|build #|no (?:appwrite|backend|production|product|runtime)|version none|signed-off-by|co-authored-by|task[→-]|squash[- ]merged)\b)/i;
function notesLines(lines) {
  return lines.map(line => line.trim())
    .filter(line => line && !/^#{1,6}\s/.test(line) &&
      !SENSITIVE_VALUE.test(line) && !PROVENANCE.test(line.replace(/^[-*]\s*/, '')))
    .map(line => line.replace(/^(?:[-*]|\d+[.)])\s+/, '').trim())
    .filter(line => line.length >= 10 && line.length <= 450)
    .slice(0, 6).map(line => '- ' + line).join('\n').slice(0, 2400);
}
function explicitSection(message) {
  if (typeof message !== 'string') return '';
  const lines = message.replace(/\r/g, '').split('\n');
  const start = lines.findIndex(line => /^#{1,3}\s+user-facing release notes\s*:?[ \t]*$/i.test(line.trim()));
  if (start < 0) return '';
  const end = lines.findIndex((line, i) => i > start && /^#{1,3}\s+\S/.test(line.trim()));
  return notesLines(lines.slice(start + 1, end < 0 ? undefined : end));
}
export function releaseNotesFromPullRequest(body) {
  return explicitSection(body);
}
export function releaseNotesFromCommit(message) {
  if (typeof message !== 'string') throw new Error('No release commit message');
  const lines = message.replace(/\r/g, '').split('\n');
  const title = (lines[0] || '').trim().slice(0, 180);
  if (!title) throw new Error('Missing release subject');
  const explicit = explicitSection(message);
  if (explicit) return { title, notes: explicit };
  const text = lines.slice(1).map(line => line.trim());
  const bullets = text.filter(line => /^(?:[-*]|\d+[.)])\s+/.test(line));
  const notes = notesLines(bullets.length ? bullets : text.filter(line =>
    // Never use raw multiline logs, code blocks, or generic Git metadata.
    !/^(`{3}|https?:\/\/|[>#]|[A-Za-z_]+: `)/.test(line)));
  return { title, notes };
}

const NOTE_ID = /^(preview|dev):([a-f0-9]{40})$/;
const NOTE_SOURCE = 'https://github.com/carlers/mosaic-life-tracker/commit/';
export function validateNoteAnnotation(entry) {
  const match = typeof entry?.id === 'string' ? entry.id.match(NOTE_ID) : null;
  if (!match || typeof entry.notes !== 'string' || !entry.notes.trim() ||
      entry.notes.length > 2400 || SENSITIVE_VALUE.test(entry.notes) ||
      entry.source !== NOTE_SOURCE + match[2]) {
    throw new Error('Invalid historical note annotation');
  }
  return entry;
}
export function parseNoteAnnotationManifest(value) {
  if (!value || value.schema !== 1 || !Array.isArray(value.annotations) ||
      value.annotations.length > MAX_HISTORY_EVENTS) {
    throw new Error('Invalid historical note manifest');
  }
  const ids = new Set();
  for (const annotation of value.annotations) {
    validateNoteAnnotation(annotation);
    if (ids.has(annotation.id)) throw new Error('Duplicate historical annotation');
    ids.add(annotation.id);
  }
  return value;
}
export function appendNoteAnnotation(manifest, annotation) {
  parseNoteAnnotationManifest(manifest);
  validateNoteAnnotation(annotation);
  const original = manifest.annotations.find(value => value.id === annotation.id);
  if (original) {
    if (JSON.stringify(original) !== JSON.stringify(annotation)) {
      throw new Error('Historical note is immutable');
    }
    return { changed: false, value: manifest };
  }
  if (manifest.annotations.length >= MAX_HISTORY_EVENTS) {
    throw new Error('Historical note capacity reached');
  }
  return { changed: true, value: {
    schema: 1, annotations: [...manifest.annotations, annotation],
  } };
}
