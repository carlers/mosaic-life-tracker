/**
 * #1026 / #1027 -- deterministic frontend capability defaults.
 *
 * A browser flag is NEVER an authorization decision. Provider support is an
 * upper bound; remote rollout flags may only further disable capabilities.
 * The core-only profile is intentionally not activated on the shipped app:
 * Supabase Auth + single-writer sync integration still require acceptance.
 */
export type MosaicFeatureProfile = 'full' | 'core-only' | 'core-diary';
export type MosaicCapability =
  | 'core' | 'diary' | 'bucketList' | 'social' | 'alerts' | 'chat'
  | 'sharedTasks' | 'taskImages';

export const CORE_MVP_SYNC_COLLECTIONS = ['tasks', 'categories'] as const;
export const PERSONAL_MVP_SYNC_COLLECTIONS = ['tasks', 'categories', 'diary'] as const;

const PROFILE_CAPABILITIES: Record<MosaicFeatureProfile, Readonly<Record<MosaicCapability, boolean>>> = {
  full: Object.freeze({
    core: true, diary: true, bucketList: true, social: true,
    alerts: true, chat: true, sharedTasks: true, taskImages: true,
  }),
  'core-only': Object.freeze({
    core: true, diary: false, bucketList: false, social: false,
    alerts: false, chat: false, sharedTasks: false, taskImages: false,
  }),
  // Owner-private Diary + task photos; only verified private Storage may enable uploads.
  'core-diary': Object.freeze({
    core: true, diary: true, bucketList: false, social: false,
    alerts: false, chat: false, sharedTasks: false, taskImages: true,
  }),
};

export function resolveFeatureProfile(value: unknown): MosaicFeatureProfile {
  // Treat an unknown or missing profile as the existing Appwrite app, not
  // as consent to switch providers or erase data.
  return value === 'core-only' || value === 'core-diary' ? value : 'full';
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
 * The driver describes an API implementation, while the target identifies
 * the actual deployment option. Appwrite Cloud and Oracle-hosted Appwrite
 * share a driver but are different data authorities.
 * This is a source-only contract, NOT a runtime provider selector.
 */
export type CloudProvider = 'appwrite' | 'supabase';
export type BackendTarget = 'appwrite-cloud' | 'appwrite-oracle' | 'supabase-cloud';

export function driverForBackend(target: BackendTarget): CloudProvider {
  switch (target) {
    case 'appwrite-cloud':
    case 'appwrite-oracle':
      return 'appwrite';
    case 'supabase-cloud':
      return 'supabase';
    default:
      throw new Error('Unknown backend target: refuse provider selection');
  }
}

/**
 * canonicalOwnerId is the SAME signed-and-verified Mosaic owner across
 * installations, not the provider-local Auth user ID. deploymentId must
 * uniquely identify the installation/project (not merely its driver).
 *
 * This checks a proposed writer set; it CANNOT acquire or enforce an actual
 * cross-device/server lock, or verify an untrusted identity mapping.
 */
export interface DomainWriter {
  domain: string;
  canonicalOwnerId: string;
  /** Auth user ID native to the target deployment. */
  ownerId: string;
  target: BackendTarget;
  deploymentId: string;
}
export function assertSingleCloudWriter(writers: readonly DomainWriter[]): void {
  const canonicalClaims = new Set<string>();
  const remoteClaims = new Map<string, string>();
  for (const writer of writers) {
    driverForBackend(writer.target);
    if (![writer.canonicalOwnerId, writer.ownerId, writer.domain, writer.deploymentId]
      .every(value => typeof value === 'string' && value.trim().length > 0)) {
      throw new Error('Cloud writer must have explicit canonical owner, remote owner, domain and deployment');
    }
    const canonicalKey = JSON.stringify([writer.canonicalOwnerId, writer.domain]);
    if (canonicalClaims.has(canonicalKey))
      throw new Error('Two authoritative cloud writers for the same owner/domain');
    canonicalClaims.add(canonicalKey);

    // A provider-local principal cannot represent different canonical owners.
    const remoteKey = JSON.stringify([
      writer.target, writer.deploymentId, writer.ownerId, writer.domain,
    ]);
    const priorOwner = remoteClaims.get(remoteKey);
    if (priorOwner && priorOwner !== writer.canonicalOwnerId)
      throw new Error('Remote account is bound to more than one canonical owner');
    remoteClaims.set(remoteKey, writer.canonicalOwnerId);
  }
}

export type CutoverPhase = 'planning' | 'frozen' | 'verified' | 'active';
export interface ProviderReturnGate {
  from: BackendTarget;
  to: BackendTarget;
  /** Stable identifiers for source and destination backend installations. */
  fromDeploymentId: string;
  toDeploymentId: string;
  phase: CutoverPhase;
  sourceSnapshotVerified: boolean;
  unsyncedDraftsSettled: boolean;
  destinationReplayVerified: boolean;
  destinationRestoreVerified: boolean;
  oldClientWritersFenced: boolean;
  identityMappingVerified: boolean;
}
export function assertSafeProviderSwitch(gate: ProviderReturnGate): void {
  driverForBackend(gate.from);
  driverForBackend(gate.to);
  if (!gate.fromDeploymentId?.trim() || !gate.toDeploymentId?.trim())
    throw new Error('Cutover requires explicit source/destination backend installations');
  if (gate.from === gate.to && gate.fromDeploymentId === gate.toDeploymentId)
    throw new Error('Provider installation must actually change');
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
