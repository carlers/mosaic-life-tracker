import { useState, useEffect, useCallback } from 'react';
import { getDatabase } from '../db/database';
import { useAuth } from './useAuth';
import type { SettingsDocument } from '../db/schema';

const DEBUG = import.meta.env.DEV;
const MAX_ROW_ID_LENGTH = 36;

/**
 * Deterministic 64-bit-ish hash (two djb2 variants) → base36.
 * Output is ~12-14 chars, safe for Appwrite row IDs.
 */
function hashString(str: string): string {
  let h1 = 5381;
  let h2 = 52711;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = ((h1 << 5) + h1 + c) | 0;
    h2 = ((h2 << 5) + h2 + c * 31) | 0;
  }
  return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36);
}

/**
 * Appwrite row IDs must be ≤36 chars, a-z/A-Z/0-9/underscore, no leading underscore.
 * Prefer `${userId}_${key}` when it fits (keeps legacy IDs stable), otherwise
 * fall back to a deterministic `s_${hash}`.
 */
function makeSettingsRowId(userId: string, key: string): string {
  const raw = `${userId}_${key}`;
  if (raw.length <= MAX_ROW_ID_LENGTH) return raw;
  return `s_${hashString(raw)}`;
}

export function useSettings() {
  const { user } = useAuth();
  const userId = user?.$id;
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    const uid = userId;
    let subscription: { unsubscribe: () => void } | undefined;
    let isMounted = true;

    async function init() {
      try {
        const db = getDatabase();

        // Clean up legacy rows whose IDs are too long to ever sync.
        try {
          const all = await db.settings
            .find({ selector: { userId: uid } })
            .exec();
          for (const doc of all) {
            if (doc.id.length > MAX_ROW_ID_LENGTH) {
              if (DEBUG) {
                console.warn(
                  '[useSettings] Removing oversized legacy settings row:',
                  doc.id
                );
              }
              await doc.remove();
            }
          }
        } catch (cleanupErr) {
          if (DEBUG) {
            console.warn('[useSettings] Legacy cleanup failed:', cleanupErr);
          }
        }

        const query = db.settings.find({
          selector: {
            userId: uid,
            isDeleted: false,
          },
        });
        const sub = query.$.subscribe((docs) => {
          if (!isMounted) return;
          const settingsMap: Record<string, unknown> = {};
          docs.forEach((doc) => {
            try {
              settingsMap[doc.key] = JSON.parse(doc.value);
            } catch {
              settingsMap[doc.key] = doc.value;
            }
          });
          setSettings(settingsMap);
          setLoadedUserId(uid);
        });
        if (!isMounted) {
          sub.unsubscribe();
        } else {
          subscription = sub;
        }
      } catch (error) {
        console.error('[useSettings] Error loading settings:', error);
        if (isMounted) setLoadedUserId(uid);
      }
    }
    init();
    return () => {
      isMounted = false;
      if (subscription) subscription.unsubscribe();
    };
  }, [userId]);

  const setSetting = useCallback(
    async (key: string, value: unknown) => {
      const uid = user?.$id;
      if (!uid) {
        console.error('[useSettings] Cannot set setting: User not authenticated');
        return;
      }
      const db = getDatabase();
      const id = makeSettingsRowId(uid, key);
      const stringValue =
        typeof value === 'string' ? value : JSON.stringify(value);

      const doc = await db.settings.findOne(id).exec();
      if (doc) {
        await doc.patch({ value: stringValue, isDeleted: false });
      } else {
        const newSetting: SettingsDocument = {
          id,
          userId: uid,
          key,
          value: stringValue,
          isDeleted: false,
        };
        await db.settings.insert(newSetting);
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

  const visibleSettings = userId && loadedUserId === userId ? settings : {};
  const isLoading = !!userId && loadedUserId !== userId;

  return { settings: visibleSettings, isLoading, setSetting, getSetting };
}