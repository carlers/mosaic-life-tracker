import { useCallback, useContext } from 'react';
import { OwnerSettingsContext } from './calendarDiaryContext';
import { getDatabase } from '../db/database';
import { useAuth } from './useAuth';
import { useRxCollection } from './useRxCollection';
import { makeSettingsRowId } from '../lib/settingsRowId';
import { ensureOversizedSettingsRowsMigrated } from '../lib/settingsLegacyCleanup';
import { upsertLocalDoc } from '../lib/localUpsert';
import type { SettingsDocument } from '../db/schema';

export { makeSettingsRowId };
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
  const parentSettings = useContext(OwnerSettingsContext);
  // A locally subscribed parent is authoritative only for the same owner.
  // Nested Day View components skip their otherwise asynchronous RxDB reads.
  const warmed = user?.$id && parentSettings?.ownerId === user.$id
    ? parentSettings : null;

  const { data: localSettings, isLoading: localLoading } = useRxCollection<
    SettingsDocument,
    Record<string, unknown>
  >({
    collection: 'settings',
    selector: { userId: user?.$id ?? '', isDeleted: false },
    map: mapSettingsDocs,
    logPrefix: '[useSettings]',
    beforeSubscribe: ensureOversizedSettingsRowsMigrated,
    startupMark: 'home:settings-ready',
    enabled: !warmed,
  });
  const settings = warmed?.settings ?? localSettings;
  const isLoading = warmed?.isLoading ?? localLoading;

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
