import { useCallback } from 'react';
import { getDatabase } from '../db/database';
import { useAuth } from './useAuth';
import { useRxCollection } from './useRxCollection';
import { makeSettingsRowId, MAX_ROW_ID_LENGTH } from '../lib/settingsRowId';
import { upsertLocalDoc } from '../lib/localUpsert';
import type { SettingsDocument } from '../db/schema';

export { makeSettingsRowId };
const DEBUG = import.meta.env.DEV;
const legacyCleanupByUser = new Map<string, Promise<void>>();

async function cleanupLegacySettingsRows(userId: string): Promise<void> {
  const existing = legacyCleanupByUser.get(userId);
  if (existing) return existing;

  const cleanup = (async () => {
    const all = await getDatabase()
      .settings.find({ selector: { userId } })
      .exec();
    for (const doc of all) {
      if (doc.id.length <= MAX_ROW_ID_LENGTH) continue;
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

  const { data: settings, isLoading } = useRxCollection<
    SettingsDocument,
    Record<string, unknown>
  >({
    collection: 'settings',
    selector: { userId: user?.$id ?? '', isDeleted: false },
    map: mapSettingsDocs,
    logPrefix: '[useSettings]',
    beforeSubscribe: cleanupLegacySettingsRows,
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
      if (doc) {
        await upsertLocalDoc('settings', id, {
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
        await upsertLocalDoc('settings', id, newSetting);
      }
    },
    [user?.$id]
  );

  const getSetting = useCallback(
    (key: string, defaultValue?: unknown) => {
      return settings[key] !== undefined ? settings[key] : defaultValue;
    },
    [settings]
  );

  return { settings, isLoading, setSetting, getSetting };
}
