import { useCallback } from 'react';
import { getDatabase } from '../db/database';
import { useAuth } from './useAuth';
import { useRxCollection } from './useRxCollection';
import { makeSettingsRowId, MAX_ROW_ID_LENGTH } from '../lib/settingsRowId';
import { useOwnerMutationGuard } from './useOwnerMutationGuard';
import type { SettingsDocument } from '../db/schema';

export { makeSettingsRowId };
const DEBUG = import.meta.env.DEV;
const legacyCleanupByUser = new Map<string, Promise<void>>();

async function cleanupLegacySettingsRows(userId: string, assertOwner: (owner: string) => void): Promise<void> {
  const existing = legacyCleanupByUser.get(userId);
  if (existing) return existing;

  const cleanup = (async () => {
    const all = await getDatabase()
      .settings.find({ selector: { userId } })
      .exec();
    for (const doc of all) {
      if (doc.id.length <= MAX_ROW_ID_LENGTH) continue;
      assertOwner(userId);
      if (doc.userId !== userId) throw new Error('Settings owner changed during cleanup');
      if (DEBUG) {
        console.warn(
          '[useSettings] Removing oversized legacy settings row:',
          doc.id
        );
      }
      await doc.remove();
    }
  })();

  legacyCleanupByUser.set(userId, cleanup);
  try {
    await cleanup;
  } catch (error) {
    if (legacyCleanupByUser.get(userId) === cleanup) {
      legacyCleanupByUser.delete(userId);
    }
    throw error;
  }
}

function mapSettingsDocs(docs: SettingsDocument[]): Record<string, unknown> {
  const settingsMap: Record<string, unknown> = {};
  for (const doc of docs) {
    try {
      settingsMap[doc.key] = JSON.parse(doc.value);
    } catch {
      settingsMap[doc.key] = doc.value;
    }
  }
  return settingsMap;
}

export function useSettings() {
  const { user } = useAuth();
  const assertOwner = useOwnerMutationGuard();
  const cleanupLegacy = useCallback((owner: string) =>
    cleanupLegacySettingsRows(owner, assertOwner), [assertOwner]);

  const { data: settings, isLoading } = useRxCollection<
    SettingsDocument,
    Record<string, unknown>
  >({
    collection: 'settings',
    selector: { userId: user?.$id ?? '', isDeleted: false },
    map: mapSettingsDocs,
    logPrefix: '[useSettings]',
    beforeSubscribe: cleanupLegacy,
    startupMark: 'home:settings-ready',
  });

  const setSetting = useCallback(
    async (key: string, value: unknown) => {
      const uid = user?.$id;
      if (!uid) {
        console.error('[useSettings] Cannot set setting: User not authenticated');
        return;
      }
      const id = makeSettingsRowId(uid, key);
      const stringValue =
        typeof value === 'string' ? value : JSON.stringify(value);
      const now = new Date().toISOString();
      const doc = await getDatabase().settings.findOne(id).exec();
      assertOwner(uid);
      if (doc) {
        if (doc.userId !== uid || doc.key !== key)
          throw new Error('Settings identity collision; nothing was changed.');
        await doc.incrementalPatch({
          value: stringValue,
          isDeleted: false,
          updatedAt: now,
        });
      } else {
        const newSetting: SettingsDocument = {
          id,
          userId: uid,
          key,
          value: stringValue,
          isDeleted: false,
          updatedAt: now,
        };
        try {
          await getDatabase().settings.insert(newSetting);
        } catch (error) {
          const raced = await getDatabase().settings.findOne(id).exec();
          assertOwner(uid);
          if (!raced || raced.userId !== uid || raced.key !== key) throw error;
          await raced.incrementalPatch({ value: stringValue, isDeleted: false, updatedAt: now });
        }
      }
    },
    [user?.$id, assertOwner]
  );

  const getSetting = useCallback(
    (key: string, defaultValue?: unknown) => {
      return settings[key] !== undefined ? settings[key] : defaultValue;
    },
    [settings]
  );

  return { settings, isLoading, setSetting, getSetting };
}
