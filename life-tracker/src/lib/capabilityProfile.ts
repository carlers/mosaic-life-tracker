/**
 * Immutable build/provider capability ceiling. Remote flags and preferences
 * can only reduce it. This does not replace backend authorization.
 */
export const CAPABILITY_KEYS = [
  'core.tasks', 'core.categories', 'core.calendar', 'core.backlogs',
  'core.diary', 'core.bucketList', 'core.account', 'core.sync',
  'social.friends', 'social.friendCalendar', 'social.chat',
  'social.notifications', 'social.sharedTasks', 'social.reactions',
] as const;
export type CapabilityKey = typeof CAPABILITY_KEYS[number];
export type CapabilityProfile = 'full' | 'core-only';
const raw = import.meta.env.VITE_MOSAIC_CAPABILITY_PROFILE;
export const BUILD_CAPABILITY_PROFILE: CapabilityProfile =
  raw === undefined || raw === '' || raw === 'full' ? 'full' : 'core-only';
export const BUILD_PROVIDER = 'appwrite' as const;
export const BUILD_CAPABILITIES: Readonly<Record<CapabilityKey, boolean>> =
  Object.freeze(Object.fromEntries(
    CAPABILITY_KEYS.map(key => [
      key, BUILD_CAPABILITY_PROFILE === 'full' || key.startsWith('core.'),
    ])
  ) as Record<CapabilityKey, boolean>);
export function isBuildCapabilityAvailable(key: CapabilityKey): boolean {
  return BUILD_CAPABILITIES[key];
}
