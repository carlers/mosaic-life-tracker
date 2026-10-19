/**
 * #1026 / #1027 -- deterministic frontend capability defaults.
 *
 * A browser flag is NEVER an authorization decision. Provider support is an
 * upper bound; remote rollout flags may only further disable capabilities.
 * The core-only profile is intentionally not activated on the shipped app:
 * Supabase Auth + single-writer sync integration still require acceptance.
 */
export type MosaicFeatureProfile = 'full' | 'core-only';
export type MosaicCapability =
  | 'core' | 'diary' | 'bucketList' | 'social' | 'alerts' | 'chat'
  | 'sharedTasks' | 'taskImages';

export const CORE_MVP_SYNC_COLLECTIONS = ['tasks', 'categories'] as const;

const PROFILE_CAPABILITIES: Record<MosaicFeatureProfile, Readonly<Record<MosaicCapability, boolean>>> = {
  full: Object.freeze({
    core: true, diary: true, bucketList: true, social: true,
    alerts: true, chat: true, sharedTasks: true, taskImages: true,
  }),
  'core-only': Object.freeze({
    core: true, diary: false, bucketList: false, social: false,
    alerts: false, chat: false, sharedTasks: false, taskImages: false,
  }),
};

export function resolveFeatureProfile(value: unknown): MosaicFeatureProfile {
  // Treat an unknown or missing profile as the existing Appwrite app, not
  // as consent to switch providers or erase data.
  return value === 'core-only' ? 'core-only' : 'full';
}

export const MOSAIC_FEATURE_PROFILE: MosaicFeatureProfile =
  resolveFeatureProfile(import.meta.env.VITE_MOSAIC_FEATURE_PROFILE);

export function hasCapability(
  capability: MosaicCapability,
  profile: MosaicFeatureProfile = MOSAIC_FEATURE_PROFILE,
  remoteEnabled: boolean | undefined = undefined,
): boolean {
  const supported = PROFILE_CAPABILITIES[profile][capability];
  // Unknown/unavailable remote flags cannot disable the essential core or
  // enable a missing backend. Remote gate, if supplied, is *disable only*.
  return supported && (capability === 'core' || remoteEnabled !== false);
}

export function requiredCapabilityForPage(pageId: string): MosaicCapability {
  if (pageId === 'bucketList' || pageId === 'bucketListDetail') return 'bucketList';
  if (pageId === 'explore' || pageId === 'friendCalendar') return 'social';
  if (pageId === 'messages' || pageId === 'chat') return 'chat';
  if (pageId === 'notifications' || pageId === 'notificationSettings') return 'alerts';
  return 'core';
}

export function isPageAvailable(
  pageId: string,
  profile: MosaicFeatureProfile = MOSAIC_FEATURE_PROFILE,
): boolean {
  return hasCapability(requiredCapabilityForPage(pageId), profile);
}

/**
 * One owner/domain -> one cloud authority. Offline cache is not a second
 * authority. Switching backend requires *settling and verifying* pending
 * writes; selecting another provider in the UI is never enough.
 */
export type CloudProvider = 'appwrite' | 'supabase';
export interface DomainWriter {
  domain: string;
  ownerId: string;
  provider: CloudProvider;
}
export function assertSingleCloudWriter(writers: readonly DomainWriter[]): void {
  const seen = new Map<string, CloudProvider>();
  for (const writer of writers) {
    if (!writer.ownerId || !writer.domain)
      throw new Error('Cloud writer must have an explicit owner and domain');
    const key = JSON.stringify([writer.ownerId, writer.domain]);
    const previous = seen.get(key);
    if (previous && previous !== writer.provider)
      throw new Error('Two authoritative cloud writers for the same owner/domain');
    seen.set(key, writer.provider);
  }
}

export type CutoverPhase = 'planning' | 'frozen' | 'verified' | 'active';
export interface ProviderReturnGate {
  from: CloudProvider;
  to: CloudProvider;
  phase: CutoverPhase;
  sourceSnapshotVerified: boolean;
  unsyncedDraftsSettled: boolean;
  destinationReplayVerified: boolean;
  destinationRestoreVerified: boolean;
  oldClientWritersFenced: boolean;
  identityMappingVerified: boolean;
}
export function assertSafeProviderSwitch(gate: ProviderReturnGate): void {
  if (gate.from === gate.to) throw new Error('Provider must actually change');
  if (gate.phase !== 'verified')
    throw new Error('Cutover requires a frozen and verified source, not a direct toggle');
  if (!gate.sourceSnapshotVerified ||
      !gate.unsyncedDraftsSettled ||
      !gate.destinationReplayVerified ||
      !gate.destinationRestoreVerified ||
      !gate.oldClientWritersFenced ||
      !gate.identityMappingVerified)
    throw new Error('Provider return prerequisites incomplete: do not switch cloud writer');
}
