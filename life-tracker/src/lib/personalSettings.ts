import { CORE_BACKEND } from './coreBackendConfig';
import { MOSAIC_FEATURE_PROFILE } from './backendCapabilities';
import { classifyCandidateSettingKey } from '../../supabase-poc/candidateSettingsMapping';
import type { SettingsDocument } from '../db/schema';

export const USE_PORTABLE_SETTINGS = CORE_BACKEND.driver === 'supabase' && MOSAIC_FEATURE_PROFILE === 'personal';
export function settingsCollectionForKey(key: string): 'settings' | 'portableSettings' {
  return USE_PORTABLE_SETTINGS && classifyCandidateSettingKey(key) === 'personal'
    ? 'portableSettings' : 'settings';
}
/** Portable tombstones suppress old device values; excluded profile/social rows stay local. */
export function mergePersonalSettings(local: SettingsDocument[], portable: SettingsDocument[]): SettingsDocument[] {
  const values = new Map(local.map(row => [row.key, row]));
  for (const row of portable) {
    if (classifyCandidateSettingKey(row.key) !== 'personal')
      throw new Error('Nonportable setting found in private collection');
    values.set(row.key, row);
  }
  return [...values.values()];
}
