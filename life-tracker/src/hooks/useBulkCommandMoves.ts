import { useCallback, useEffect, useRef } from 'react';
import { getDatabase } from '../db/database';
import { getSyncStatus } from '../lib/syncStatus';
import {
  executeMovePlan, freezeMovePlan, undoMovePlan,
  type BulkMovePlan, type BulkMoveOutcome, type BulkMoveStore, type FrozenMoveRow,
  type MovePatch,
} from '../lib/taskBulkCommandExecution';
import type { BulkMoveDraft } from '../lib/taskBulkCommandPreview';
import type { TaskDocument } from '../db/schema';
import { useAuth } from './useAuth';

const JOURNAL_PREFIX = 'mosaic_1441_bulk_move_';
const EXPIRATION_MS = 15 * 60 * 1000;
const MAX_UI_BATCH = 20;

export type BulkMoveReceipt = { ownerId: string; expiresAt: number;
  plan: BulkMovePlan; outcome: BulkMoveOutcome };

function journalKey(ownerId: string) { return JOURNAL_PREFIX + ownerId; }

function saveReceipt(receipt: BulkMoveReceipt) {
  try {
    sessionStorage.setItem(journalKey(receipt.ownerId), JSON.stringify(receipt));
  } catch {
    // The immediate in-memory undo still works when storage is unavailable.
  }
}

function readReceipt(ownerId: string): BulkMoveReceipt | null {
  try {
    const raw = sessionStorage.getItem(journalKey(ownerId));
    if (!raw) return null;
    const receipt = JSON.parse(raw) as BulkMoveReceipt;
    if (receipt.ownerId !== ownerId || receipt.plan?.ownerId !== ownerId ||
        !receipt.expiresAt ||
        receipt.expiresAt < Date.now() ||
        !Array.isArray(receipt.outcome?.applied)) {
      sessionStorage.removeItem(journalKey(ownerId));
      return null;
    }
    return receipt;
  } catch { return null; }
}

/** Full local-sync verification is still optimistic across other devices. */
function checkReady(ownerId: string) {
  const status = getSyncStatus();
  if (!ownerId || typeof navigator === 'undefined' || !navigator.onLine ||
      status.isSyncing || status.errors.length || !status.lastSync ||
      Date.now() - Date.parse(status.lastSync) > 5 * 60 * 1000 ||
      Date.now() < Date.parse(status.lastSync)) {
    throw new Error('Run a successful Sync Now within five minutes while online, then review again.');
  }
}

export function useBulkCommandMoves() {
  const { user } = useAuth();
  const currentOwner = useRef<string | null>(user?.$id ?? null);
  useEffect(() => { currentOwner.current = user?.$id ?? null; }, [user?.$id]);

  const makeStore = useCallback((): BulkMoveStore => {
    const db = getDatabase();
    return {
      currentOwner: () => currentOwner.current,
      readTask: async id => {
        const doc = await db.tasks.findOne(id).exec();
        return doc ? doc.toJSON() : null;
      },
      readCategory: async id => {
        const doc = await db.categories.findOne(id).exec();
        return doc ? doc.toJSON() : null;
      },
      comparePatch: async (before: FrozenMoveRow, patch: MovePatch) => {
        const doc = await db.tasks.findOne(before.id).exec();
        if (!doc) return false;
        let changed = false;
        try {
          await doc.incrementalModify((state: TaskDocument) => {
            if (currentOwner.current !== before.userId || state.userId !== before.userId ||
                state.id !== before.id || state.isDeleted !== before.isDeleted ||
                state.categoryId !== before.categoryId || state.date !== before.date ||
                state.completed !== before.completed || state.updatedAt !== before.updatedAt ||
                state.visibility !== before.visibility) {
              throw new Error('STALE_BULK_PREIMAGE');
            }
            changed = true;
            return { ...state, ...patch };
          });
          return changed;
        } catch (error) {
          if (error instanceof Error && error.message.includes('STALE_BULK_PREIMAGE')) return false;
          throw error;
        }
      },
    };
  }, []);

  const runMove = useCallback(async (
    draft: BulkMoveDraft,
    selectedIds: readonly string[],
    options: { cancelled?: () => boolean; onProgress?: (done: number, total: number) => void } = {},
  ) => {
    if (draft.status !== 'preview') throw Error('Review a supported bulk move first.');
    const owner = currentOwner.current;
    if (!owner || owner !== draft.ownerId) throw Error('Account changed.');
    checkReady(owner);
    const selected = new Set(selectedIds);
    if (selected.size !== selectedIds.length ||
        selected.size === 0 || selected.size > MAX_UI_BATCH ||
        selectedIds.some(id => !draft.matches.some(t => t.id === id))) {
      throw Error('Select between 1 and 20 reviewed owner tasks.');
    }
    const frozenDraft = { ...draft, matches: draft.matches.filter(t => selected.has(t.id)) };
    const plan = freezeMovePlan(frozenDraft);
    if (plan.rows.length > MAX_UI_BATCH) throw Error('Select at most 20 changed tasks per confirmation.');
    const db = getDatabase();
    const live = await db.tasks.find({ selector: {
      userId: owner, isDeleted: false, categoryId: plan.sourceCategoryId,
    } }).exec();
    const expected = new Set(draft.matches.map(t => t.id));
    const actual = new Set(live.filter(t => draft.completionFilter === null ||
      t.completed === draft.completionFilter).map(t => t.id));
    if (actual.size !== expected.size || [...actual].some(id => !expected.has(id))) {
      throw Error('Task selection changed after preview. Sync and review again.');
    }
    const store = makeStore();
    const outcome = await executeMovePlan(plan, store, {
      ...options,
      cancelled: () => options.cancelled?.() === true || currentOwner.current !== owner ||
        typeof navigator !== 'undefined' && !navigator.onLine,
    });
    const receipt: BulkMoveReceipt = { ownerId: owner, plan, outcome,
      expiresAt: Date.now() + EXPIRATION_MS };
    if (outcome.applied.length) saveReceipt(receipt);
    return receipt;
  }, [makeStore]);

  const undoMove = useCallback(async (receipt?: BulkMoveReceipt | null) => {
    const owner = currentOwner.current;
    if (!owner) throw Error('Sign in first.');
    if (typeof navigator !== 'undefined' && !navigator.onLine)
      throw Error('Connect to the internet before undoing this move.');
    const saved = receipt?.ownerId === owner && receipt.expiresAt > Date.now() ?
      receipt : readReceipt(owner);
    if (!saved) throw Error('No recent owner-scoped bulk move to undo.');
    const outcome = await undoMovePlan(saved.plan, saved.outcome, makeStore());
    if (!outcome.cancelled && outcome.conflicts.length === 0 && outcome.failures.length === 0) {
      try { sessionStorage.removeItem(journalKey(owner)); } catch { /* no storage */ }
    } else {
      // Preserve only rows still eligible for future compensation; never
      // replay a previously restored write as though its post-state were live.
      const unresolved = new Set([...outcome.conflicts, ...outcome.failures]);
      saveReceipt({ ...saved, outcome: { ...saved.outcome,
        applied: saved.outcome.applied.filter(item => unresolved.has(item.before.id)) } });
    }
    return outcome;
  }, [makeStore]);

  const readRecent = useCallback(() => currentOwner.current ?
    readReceipt(currentOwner.current) : null, []);
  return { runMove, undoMove, readRecent };
}
