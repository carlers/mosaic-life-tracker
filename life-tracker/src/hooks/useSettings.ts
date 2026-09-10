import { useState, useEffect, useCallback } from 'react';
import { getDatabase } from '../db/database';
import { useAuth } from './useAuth';
import type { SettingsDocument } from '../db/schema';

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
        const query = db.settings.find({
          selector: {
            userId: uid,
            isDeleted: false,
          },
        });

        const sub = query.$.subscribe((docs) => {
          if (!isMounted) return;
          const settingsMap: Record<string, unknown> = {};
          docs.forEach(doc => {
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

  const setSetting = useCallback(async (key: string, value: unknown) => {
    const uid = user?.$id;
    if (!uid) {
      console.error('[useSettings] Cannot set setting: User not authenticated');
      return;
    }
    const db = getDatabase();
    const id = `${uid}_${key}`;
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
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
  }, [user?.$id]);

  const getSetting = useCallback((key: string, defaultValue?: unknown) => {
    return settings[key] !== undefined ? settings[key] : defaultValue;
  }, [settings]);

  const visibleSettings = userId && loadedUserId === userId ? settings : {};
  const isLoading = !!userId && loadedUserId !== userId;

  return { settings: visibleSettings, isLoading, setSetting, getSetting };
}