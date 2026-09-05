import { useState, useEffect, useCallback } from 'react';
import { getDatabase } from '../db/database';
import { CURRENT_USER_ID } from '../db/sync';
import type { SettingsDocument } from '../db/schema';

export function useSettings() {
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let subscription: any;
    
    async function init() {
      try {
        const db = getDatabase();
        const query = db.settings.find({
          selector: {
            userId: CURRENT_USER_ID,
            isDeleted: false,
          },
        });

        subscription = query.$.subscribe((docs) => {
          const settingsMap: Record<string, any> = {};
          docs.forEach(doc => {
            try {
              settingsMap[doc.key] = JSON.parse(doc.value);
            } catch {
              settingsMap[doc.key] = doc.value; // Fallback if not JSON
            }
          });
          setSettings(settingsMap);
          setIsLoading(false);
        });
      } catch (error) {
        console.error('[useSettings] Error loading settings:', error);
        setIsLoading(false);
      }
    }

    init();

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  const setSetting = useCallback(async (key: string, value: any) => {
    const db = getDatabase();
    const id = `${CURRENT_USER_ID}_${key}`;
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);

    const doc = await db.settings.findOne(id).exec();
    
    if (doc) {
      await doc.patch({ value: stringValue, isDeleted: false });
    } else {
      const newSetting: SettingsDocument = {
        id,
        userId: CURRENT_USER_ID,
        key,
        value: stringValue,
        isDeleted: false,
      };
      await db.settings.insert(newSetting);
    }
  }, []);

  const getSetting = useCallback((key: string, defaultValue?: any) => {
    return settings[key] !== undefined ? settings[key] : defaultValue;
  }, [settings]);

  return { settings, isLoading, setSetting, getSetting };
}