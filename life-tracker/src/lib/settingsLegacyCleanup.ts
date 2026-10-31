import { getDatabase } from '../db/database';
import { MAX_ROW_ID_LENGTH, makeSettingsRowId } from './settingsRowId';
import { upsertLocalDoc } from './localUpsert';

/**
 * Older builds used unbounded composite IDs for some settings. Appwrite
 * rejects IDs over 36 characters. Copy their values to the supported ID
 * before local-only deletion; the replication push ignores only these
 * impossible-to-store legacy deletions.
 */
export async function migrateOversizedSettingsRows(userId: string): Promise<void> {
  const collection = getDatabase().settings;
  const rows = await collection.find({ selector: { userId } }).exec();

  for (const row of rows) {
    if (row.id.length <= MAX_ROW_ID_LENGTH) continue;
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
