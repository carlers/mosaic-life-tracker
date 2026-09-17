import type { RxDatabase } from 'rxdb';
import { getDatabase, type AppDatabaseCollections } from '../db/database';
import { makeRecipientRowId } from './threads';
import { deliverPendingMessages, reactOnRemote } from './messageDelivery';
import {
  parseReactions,
  stringifyReactions,
  applyReactionDelta,
  hasUserReacted,
} from './reactionUtils';

const DEBUG = import.meta.env.DEV;
const DELIVERY_WAIT_MS = 5000;

export type ToggleReactionResult = 'ok' | 'timeout';

/**
 * Toggle a reaction on one of the caller's own messages (HB-2).
 *
 * Extracted from `useMessages.toggleReaction` — the original mixed
 * seven concerns in ~110 lines: offline bail, doc lookup, peer-row-id
 * derivation, delta math, optimistic patch, CONFLICT retry,
 * delivery-wait + revert, remote call + backfill. Each concern is now
 * a named step in this module; the hook calls one function.
 *
 * The function never throws. It returns `'timeout'` only when the
 * optimistic patch was applied and then reverted because the message
 * stayed pending past the delivery wait.
 */
export async function toggleReactionOnMessage(
  userId: string,
  messageId: string,
  emoji: string
): Promise<ToggleReactionResult> {
  // OFF-13: reacting requires a round-trip to the server (and, for a
  // pending outgoing message, delivery first). There is nothing to gain
  // from an optimistic patch that is guaranteed to revert, so bail
  // early when the device is offline and let the caller show the
  // standard "Couldn't send reaction. Try again." toast.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'timeout';
  }

  const db: RxDatabase<AppDatabaseCollections> = getDatabase();
  const doc = await db.messages.findOne(messageId).exec();
  if (!doc) return 'ok';
  if (doc.isUnsent) return 'ok';

  const peerUserId =
    doc.direction === 'outgoing' ? doc.recipientId : doc.senderId;
  const myRowId = doc.id;
  const peerRowId =
    doc.direction === 'outgoing'
      ? await makeRecipientRowId(doc.id)
      : doc.originalMessageId || '';

  const originalReactions = doc.reactions;
  const current = parseReactions(doc.reactions);
  const op: 'add' | 'remove' = hasUserReacted(current, emoji, userId)
    ? 'remove'
    : 'add';
  const next = applyReactionDelta(current, emoji, userId, op);
  const nextStr = stringifyReactions(next);
  const now = new Date().toISOString();

  const patched = await applyOptimisticPatch(db, messageId, nextStr, now, emoji, userId, op);
  if (!patched) return 'ok';

  if (doc.direction === 'outgoing' && doc.deliveryStatus === 'pending') {
    const stillPending = await waitForDelivery(db, messageId);
    if (stillPending) {
      const didRevert = await revertIfUnchanged(
        db,
        messageId,
        nextStr,
        originalReactions
      );
      if (DEBUG) {
        console.warn(
          '[messageReactions] react skipped: message still pending after delivery wait'
        );
      }
      return didRevert ? 'timeout' : 'ok';
    }
  }

  reactOnRemote(myRowId, peerRowId, peerUserId, emoji, op)
    .then(async (resolvedPeerRowId) => {
      if (!resolvedPeerRowId) return;
      try {
        const fresh = await db.messages.findOne(messageId).exec();
        if (!fresh) return;
        if (fresh.originalMessageId) return;
        await fresh.patch({ originalMessageId: resolvedPeerRowId });
      } catch (err) {
        console.error('[messageReactions] react backfill failed:', err);
      }
    })
    .catch(async (err) => {
      await revertIfUnchanged(db, messageId, nextStr, originalReactions);
      console.error('[messageReactions] react delivery failed:', err);
    });

  return 'ok';
}

async function applyOptimisticPatch(
  db: RxDatabase<AppDatabaseCollections>,
  messageId: string,
  nextStr: string,
  now: string,
  emoji: string,
  userId: string,
  op: 'add' | 'remove'
): Promise<boolean> {
  try {
    const doc = await db.messages.findOne(messageId).exec();
    if (!doc) return false;
    await doc.patch({ reactions: nextStr, updatedAt: now });
    return true;
  } catch (patchErr) {
    const code = (patchErr as { code?: string })?.code;
    if (code === 'CONFLICT') {
      const fresh = await db.messages.findOne(messageId).exec();
      if (fresh && !fresh.isUnsent) {
        const freshCurrent = parseReactions(fresh.reactions);
        const freshNext = applyReactionDelta(freshCurrent, emoji, userId, op);
        await fresh.patch({
          reactions: stringifyReactions(freshNext),
          updatedAt: now,
        });
        return true;
      }
      return true;
    }
    console.error('[messageReactions] react patch failed:', patchErr);
    return false;
  }
}

/**
 * Waits up to `DELIVERY_WAIT_MS` for the pending message to be delivered.
 * Returns `true` if the message is still pending (or gone) after the
 * wait — i.e. the reaction should be reverted.
 */
async function waitForDelivery(
  db: RxDatabase<AppDatabaseCollections>,
  messageId: string
): Promise<boolean> {
  try {
    await Promise.race([
      deliverPendingMessages(
        (await db.messages.findOne(messageId).exec())?.userId ?? ''
      ),
      new Promise<void>((resolve) => setTimeout(resolve, DELIVERY_WAIT_MS)),
    ]);
  } catch (err) {
    if (DEBUG) {
      console.warn('[messageReactions] delivery wait before react failed:', err);
    }
  }
  try {
    const fresh = await db.messages.findOne(messageId).exec();
    return !fresh || fresh.deliveryStatus === 'pending';
  } catch (err) {
    if (DEBUG) {
      console.warn('[messageReactions] react delivery re-check failed:', err);
    }
    return true;
  }
}

/**
 * Reverts a reaction if the row still carries the optimistic value.
 * Returns `true` if a revert actually happened.
 */
async function revertIfUnchanged(
  db: RxDatabase<AppDatabaseCollections>,
  messageId: string,
  expectedCurrent: string,
  original: string
): Promise<boolean> {
  try {
    const fresh = await db.messages.findOne(messageId).exec();
    if (fresh && !fresh.isUnsent && fresh.reactions === expectedCurrent) {
      await fresh.patch({
        reactions: original,
        updatedAt: new Date().toISOString(),
      });
      return true;
    }
    return false;
  } catch (revertErr) {
    const code = (revertErr as { code?: string })?.code;
    if (code !== 'CONFLICT') {
      console.error('[messageReactions] react revert failed:', revertErr);
    }
    return false;
  }
}
