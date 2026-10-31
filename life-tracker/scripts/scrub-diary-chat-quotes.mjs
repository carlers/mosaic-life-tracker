#!/usr/bin/env node
// Privacy maintenance for disposable Scratch ONLY. No implicit Production path.
// Dry-run by default; no chat bodies, personal text or account IDs in output.
import {
  assertConfirmedProject,
  createAppwriteAdminRequest,
  flagValue, hasFlag, parseBackendTarget,
} from './lib/appwrite-backend.mjs';
import { assertScratchPreviewTarget } from './appwrite-preview-prepare.mjs';
import { MOSAIC_DATABASE } from '../infrastructure/mosaic-backend.mjs';

const TABLES = '/tablesdb/' + MOSAIC_DATABASE.id + '/tables';
const ROW_ID = /^[A-Za-z0-9][A-Za-z0-9_]{0,35}$/;
const QUERY = (method, attribute, values) => JSON.stringify({
  method, ...(attribute ? { attribute } : {}), values,
});

function pagePath(cursor) {
  const params = new URLSearchParams();
  params.append('queries[]', QUERY('orderAsc', '$id', []));
  params.append('queries[]', QUERY('limit', null, [50]));
  if (cursor) params.append('queries[]', QUERY('cursorAfter', null, [cursor]));
  return TABLES + '/messages/rows?' + params.toString();
}

async function getDiary(request, diaryId) {
  try {
    return await request('GET', TABLES + '/diary/rows/' + encodeURIComponent(diaryId));
  } catch (cause) {
    if (Number(cause?.status) === 404) return null;
    throw cause; // Unknown errors must not masquerade as a deleted entry.
  }
}

/**
 * Iterate a bounded, resumable snapshot of message references. All writes
 * are narrowly scoped to copied diary text/metadata and a server-owned epoch.
 * Run again from the returned cursor until complete; subsequent passes are
 * idempotent. Never change an independent authored message body or reactions.
 */
export async function scrubDiaryChatQuotes({
  request, apply = false, cursor = '', maxPages = 100, log = () => {},
}) {
  if ((cursor && !ROW_ID.test(cursor)) ||
      !Number.isInteger(maxPages) || maxPages < 1 || maxPages > 100)
    throw Error('Invalid cursor or page bound');
  let scanned = 0, wouldRedact = 0, redacted = 0;
  let wouldFence = 0, fenced = 0, pages = 0;
  let nextCursor = cursor;
  let completed = false;
  const diaries = new Map();
  const fencedIds = new Set();

  for (; pages < maxPages; pages++) {
    const page = await request('GET', pagePath(nextCursor));
    const rows = page?.rows;
    if (!Array.isArray(rows) || rows.length > 50)
      throw Error('Invalid message scan page');
    for (const row of rows) {
      if (!ROW_ID.test(row.$id || ''))
        throw Error('Unexpected message row identity');
      scanned++;
      const refId = row.diary_ref_id || '';
      let diary = null;
      if (refId && ROW_ID.test(refId)) {
        if (!diaries.has(refId)) diaries.set(refId, await getDiary(request, refId));
        diary = diaries.get(refId);
      }
      const readable = diary &&
        diary.user_id === row.diary_ref_owner_id &&
        diary.deleted !== true &&
        (diary.visibility === 'public' || diary.visibility === 'followers');
      const revoked = Boolean(refId && !readable);
      const needsRedaction = Boolean(row.diary_ref_excerpt ||
        (revoked && row.diary_ref_date));
      if (needsRedaction) {
        wouldRedact++;
        if (apply) {
          await request('PATCH', TABLES + '/messages/rows/' + encodeURIComponent(row.$id), {
            data: {
              diary_ref_excerpt: '',
              ...(revoked ? { diary_ref_date: '' } : {}),
              updated_at: new Date().toISOString(),
            },
          });
          redacted++;
        }
      }
      if (revoked && diary && diary.user_id === row.diary_ref_owner_id &&
          (diary.quote_epoch || 0) === 0 && !fencedIds.has(refId)) {
        fencedIds.add(refId);
        wouldFence++;
        if (apply) {
          // The first revocation version permanently invalidates historical
          // references if the owner makes this diary public again later.
          const result = await request('PATCH', TABLES + '/diary/rows', {
            queries: [
              QUERY('equal', '$id', [refId]),
              QUERY('equal', 'user_id', [diary.user_id]),
              QUERY('equal', '$updatedAt', [diary.$updatedAt]),
            ],
            data: { quote_epoch: 1 },
          });
          if (result?.total !== 1)
            throw Error('Concurrent diary update during quote backfill; restart scan');
          fenced++;
          diaries.set(refId, { ...diary, quote_epoch: 1 });
        }
      }
    }
    const last = rows.at(-1)?.$id;
    if (rows.length < 50) { completed = true; nextCursor = ''; break; }
    if (!last || last === nextCursor) throw Error('Message scan made no progress');
    nextCursor = last;
  }
  const summary = { apply, scanned, wouldRedact, redacted, wouldFence, fenced,
    pages: pages + (completed ? 1 : 0), completed, nextCursor };
  log(JSON.stringify(summary));
  return summary;
}

export async function runDiaryQuoteScrub({
  argv = process.argv.slice(2), env = process.env,
  fetchImpl = globalThis.fetch, log = console.log,
} = {}) {
  const target = parseBackendTarget(argv, env);
  // Explicit disposable project and region for *both* dry-run and writes.
  assertScratchPreviewTarget(argv, target);
  const apply = hasFlag(argv, '--apply');
  if (apply) assertConfirmedProject(argv, target.projectId);
  const cursor = flagValue(argv, '--cursor');
  const pagesRaw = flagValue(argv, '--max-pages');
  const maxPages = pagesRaw ? Number(pagesRaw) : 100;
  return scrubDiaryChatQuotes({
    request: createAppwriteAdminRequest({ ...target, fetchImpl }),
    apply, cursor, maxPages, log,
  });
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  runDiaryQuoteScrub().catch(cause => {
    console.error('Scratch diary quote scrub failed: ' + cause.message);
    process.exitCode = 1;
  });
}
