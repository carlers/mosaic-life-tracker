import { getDatabase } from '../db/database';
import { isAppwriteCompatibleRowId, makeSettingsRowId } from './settingsRowId';
import { upsertLocalDoc } from './localUpsert';

/**
 * Older builds could create settings IDs that were too long or contained
 * unsupported characters (for example, `uiColor:icons`). Copy their values to the supported ID
 * before local-only deletion; the replication push ignores only these
 * impossible-to-store legacy deletions.
 */
export async function migrateOversizedSettingsRows(userId: string): Promise<void> {
  const collection = getDatabase().settings;
  const rows = await collection.find({ selector: { userId } }).exec();

  for (const row of rows) {
    if (isAppwriteCompatibleRowId(row.id)) continue;
    if (row.userId !== userId) {
      throw new Error('Legacy settings owner mismatch');
    }

    const id = makeSettingsRowId(userId, row.key);
    const current = await collection.findOne(id).exec();
    if (current && (current.userId !== userId || current.key !== row.key)) {
      throw new Error('Legacy settings ID collision');
    }

    const legacyTime = Date.parse(row.updatedAt);
    const currentTime = current ? Date.parse(current.updatedAt) : Number.NaN;
    if (
      !current ||
      (Number.isFinite(legacyTime) && Number.isFinite(currentTime) && legacyTime > currentTime)
    ) {
      await upsertLocalDoc('settings', id, {
        id,
        userId,
        key: row.key,
        value: row.value,
        isDeleted: row.isDeleted,
        updatedAt: row.updatedAt,
      });
    }

    // This cleanup is local-only. The cloud cannot contain this oversized ID.
    // Once the canonical value is safe, the orphaned local record may be removed.
    await row.remove();
  }
}

/**
 * Startup replication and React subscriptions must share the same owner-scoped
 * migration. An existing invalid, not-yet-removed row is otherwise eligible
 * for the first RxDB upstream scan and cannot be stored in Appwrite.
 */
const migrationsInFlight = new Map<string, Promise<void>>();

export function ensureOversizedSettingsRowsMigrated(userId: string): Promise<void> {
  const existing = migrationsInFlight.get(userId);
  if (existing) return existing;

  const work = migrateOversizedSettingsRows(userId).finally(() => {
    if (migrationsInFlight.get(userId) === work) {
      migrationsInFlight.delete(userId);
    }
  });
  migrationsInFlight.set(userId, work);
  return work;
}
