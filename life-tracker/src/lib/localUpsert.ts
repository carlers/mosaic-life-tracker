import { getDatabase } from '../db/database';

/**
 * Upsert helper for RxDB collections keyed by a primary key that the
 * caller already computed (not a random client id).
 *
 * Semantics:
 *   - existing row → `incrementalPatch(doc)` (merges, never throws
 *     CONFLICT on a stale local revision — §10 treats CONFLICT as a
 *     non-error in every other path; HB-6 closes the last `patch()`
 *     call site that could still surface it).
 *   - missing row  → `insert(doc)`.
 *
 * The `doc` argument must be the *full* document on insert, or the
 * partial patch on update. Callers derive the primary key first
 * (settings, diary) and pass it here. Casts at the RxDB boundary are
 * unavoidable: RxDB's `RxCollection<T>` typing is not expressible
 * through the union of collection names.
 */
export async function upsertLocalDoc(
  collectionName: 'tasks' | 'categories' | 'diary' | 'settings' | 'friendships' | 'messages',
  id: string,
  doc: object
): Promise<void> {
  const db = getDatabase();
  const collection = db[collectionName] as unknown as {
    findOne: (id: string) => { exec: () => Promise<{ incrementalPatch: (u: object) => Promise<unknown> } | null> };
    insert: (d: object) => Promise<unknown>;
  };
  const existing = await collection.findOne(id).exec();
  if (existing) {
    await existing.incrementalPatch(doc);
    return;
  }
  await collection.insert(doc);
}
