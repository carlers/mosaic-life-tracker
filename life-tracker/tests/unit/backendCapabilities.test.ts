import { describe, expect, it } from 'vitest';
import {
  CORE_MVP_SYNC_COLLECTIONS, PERSONAL_MVP_SYNC_COLLECTIONS,
  assertSafeProviderSwitch,
  assertSingleCloudWriter,
  driverForBackend,
  hasCapability,
  isPageAvailable,
  requiredCapabilityForPage,
  resolveFeatureProfile,
  type ProviderReturnGate,
} from '../../src/lib/backendCapabilities';

describe('Mosaic core-only capability boundary (#1026 / #1027)', () => {
  it('keeps existing Appwrite behavior by default; core-only is explicit', () => {
    expect(resolveFeatureProfile(undefined)).toBe('full');
    expect(resolveFeatureProfile('supabase')).toBe('full');
    expect(resolveFeatureProfile('core-only')).toBe('core-only');
    expect(hasCapability('diary', 'full')).toBe(true);
    expect(hasCapability('social', 'full')).toBe(true);
    expect(CORE_MVP_SYNC_COLLECTIONS).toEqual(['tasks', 'categories']);
  });

  it('enables owner-private Diary and task images, while social remains disabled', () => {
    expect(resolveFeatureProfile('core-diary')).toBe('core-diary');
    expect(PERSONAL_MVP_SYNC_COLLECTIONS).toEqual(['tasks', 'categories', 'diary']);
    expect(hasCapability('core', 'core-diary')).toBe(true);
    expect(hasCapability('diary', 'core-diary')).toBe(true);
    expect(hasCapability('diary', 'core-diary', false)).toBe(false);
    expect(hasCapability('taskImages', 'core-diary')).toBe(true);
    expect(hasCapability('taskImages', 'core-diary', false)).toBe(false);
    for (const feature of ['bucketList', 'social', 'alerts', 'chat', 'sharedTasks'] as const) {
      expect(hasCapability(feature, 'core-diary', true)).toBe(false);
    }
    for (const page of ['explore', 'friendCalendar', 'messages', 'chat', 'notifications',
      'notificationSettings', 'bucketList', 'bucketListDetail']) {
      expect(isPageAvailable(page, 'core-diary')).toBe(false);
    }
  });

  it('preserves core features while fail-closing unsupported backend domains', () => {
    expect(hasCapability('core', 'core-only', false)).toBe(true);
    for (const feature of ['diary', 'bucketList', 'social', 'alerts', 'chat', 'sharedTasks', 'taskImages'] as const) {
      expect(hasCapability(feature, 'core-only')).toBe(false);
      expect(hasCapability(feature, 'core-only', true)).toBe(false);
    }
  });

  it('remote controls may disable supported experiments, not enable missing capabilities', () => {
    expect(hasCapability('social', 'full', false)).toBe(false);
    expect(hasCapability('social', 'full', true)).toBe(true);
    expect(hasCapability('social', 'core-only', true)).toBe(false);
    expect(hasCapability('core', 'core-only', false)).toBe(true);
  });

  it('every deferred core-only route fails closed including direct deep-links', () => {
    for (const page of ['explore', 'friendCalendar', 'messages', 'chat', 'notifications',
      'notificationSettings', 'bucketList', 'bucketListDetail']) {
      expect(isPageAvailable(page, 'core-only'), page).toBe(false);
      expect(isPageAvailable(page, 'full'), page).toBe(true);
    }
    for (const page of ['home', 'backlog', 'account', 'settings', 'preferences',
      'profile', 'releaseHistory']) {
      expect(requiredCapabilityForPage(page)).toBe('core');
      expect(isPageAvailable(page, 'core-only')).toBe(true);
    }
  });
});

describe('three backend installations and provider-return invariants (#967 / #975 / #1027)', () => {
  const appwriteCloud = {
    target: 'appwrite-cloud' as const,
    deploymentId: 'appwrite-cloud-project-a',
  };
  const appwriteOracle = {
    target: 'appwrite-oracle' as const,
    deploymentId: 'oracle-appwrite-project-b',
  };
  const supabaseCloud = {
    target: 'supabase-cloud' as const,
    deploymentId: 'supabase-project-c',
  };
  const writer = (
    canonicalOwnerId: string,
    ownerId: string,
    domain: string,
    installation = appwriteCloud,
  ) => ({ ...installation, canonicalOwnerId, ownerId, domain });

  it('routes cloud and self-hosted Appwrite to the same API driver, not same deployment', () => {
    expect(driverForBackend('appwrite-cloud')).toBe('appwrite');
    expect(driverForBackend('appwrite-oracle')).toBe('appwrite');
    expect(driverForBackend('supabase-cloud')).toBe('supabase');
    expect(() => driverForBackend('unsupported' as never)).toThrow('Unknown backend');
  });

  it('rejects simultaneous authoritative writers for a canonical owner across three installations', () => {
    // Different provider-native IDs still belong to the SAME Mosaic owner.
    expect(() => assertSingleCloudWriter([
      writer('mosaic_owner', 'appwrite_native_id', 'tasks'),
      writer('mosaic_owner', 'supabase_uuid', 'tasks', supabaseCloud),
    ])).toThrow('Two authoritative cloud writers');
    // Same Appwrite SDK does NOT imply a single cloud authority.
    expect(() => assertSingleCloudWriter([
      writer('mosaic_owner', 'native_id', 'categories'),
      writer('mosaic_owner', 'native_id', 'categories', appwriteOracle),
    ])).toThrow('Two authoritative cloud writers');
    // Two active leases to the very same provider instance are not safe.
    expect(() => assertSingleCloudWriter([
      writer('mosaic_owner', 'native_id', 'tasks'),
      writer('mosaic_owner', 'native_id', 'tasks'),
    ])).toThrow('Two authoritative cloud writers');
  });

  it('allows distinct owners/domains but rejects reused remote principals and unverified identity fields', () => {
    expect(() => assertSingleCloudWriter([
      writer('owner_a', 'remote_a', 'tasks'),
      writer('owner_b', 'remote_b', 'tasks'),
      writer('owner_a', 'remote_a', 'categories', supabaseCloud),
    ])).not.toThrow();
    expect(() => assertSingleCloudWriter([
      writer('owner_a', 'shared_native', 'tasks'),
      writer('owner_b', 'shared_native', 'tasks'),
    ])).toThrow('Remote account is bound');
    for (const field of ['canonicalOwnerId', 'ownerId', 'domain', 'deploymentId'] as const) {
      expect(() => assertSingleCloudWriter([
        { ...writer('owner_a', 'native_a', 'tasks'), [field]: '' },
      ]), field).toThrow('explicit canonical owner');
    }
    expect(() => assertSingleCloudWriter([
      { ...writer('owner_a', 'native_a', 'tasks'), target: 'unknown' as never },
    ])).toThrow('Unknown backend');
  });

  const fullyVerified: ProviderReturnGate = {
    from: 'supabase-cloud',
    to: 'appwrite-oracle',
    fromDeploymentId: 'supabase-project-c',
    toDeploymentId: 'oracle-appwrite-project-b',
    phase: 'verified',
    sourceSnapshotVerified: true,
    unsyncedDraftsSettled: true,
    destinationReplayVerified: true,
    destinationRestoreVerified: true,
    oldClientWritersFenced: true,
    identityMappingVerified: true,
  };

  it('models reversible movement between Supabase Cloud, Appwrite Cloud, and Appwrite on Oracle', () => {
    expect(() => assertSafeProviderSwitch(fullyVerified)).not.toThrow();
    expect(() => assertSafeProviderSwitch({
      ...fullyVerified,
      from: 'appwrite-cloud',
      to: 'appwrite-oracle',
      fromDeploymentId: 'appwrite-cloud-project-a',
    })).not.toThrow();
    expect(() => assertSafeProviderSwitch({
      ...fullyVerified, from: 'appwrite-oracle', to: 'supabase-cloud',
      fromDeploymentId: 'oracle-appwrite-project-b',
      toDeploymentId: 'supabase-project-c',
    })).not.toThrow();
    expect(() => assertSafeProviderSwitch({
      ...fullyVerified, from: 'appwrite-oracle', to: 'appwrite-oracle',
      fromDeploymentId: 'oracle-appwrite-project-a',
      toDeploymentId: 'oracle-appwrite-project-b',
    })).not.toThrow();
  });

  it('refuses switching an unchanged backend and fails closed without verified portability prerequisites', () => {
    expect(() => assertSafeProviderSwitch({
      ...fullyVerified, from: 'appwrite-oracle', to: 'appwrite-oracle',
      fromDeploymentId: 'same', toDeploymentId: 'same',
    })).toThrow('actually change');
    expect(() => assertSafeProviderSwitch({ ...fullyVerified, phase: 'active' }))
      .toThrow('frozen and verified');
    expect(() => assertSafeProviderSwitch({ ...fullyVerified, fromDeploymentId: '' }))
      .toThrow('explicit source/destination');
    expect(() => assertSafeProviderSwitch({ ...fullyVerified, toDeploymentId: '' }))
      .toThrow('explicit source/destination');
    for (const field of ['sourceSnapshotVerified', 'unsyncedDraftsSettled',
      'destinationReplayVerified', 'destinationRestoreVerified',
      'oldClientWritersFenced', 'identityMappingVerified'] as const) {
      expect(() => assertSafeProviderSwitch({ ...fullyVerified, [field]: false }),
        field).toThrow('prerequisites incomplete');
    }
    expect(() => assertSafeProviderSwitch({
      ...fullyVerified, to: 'unrecognized' as never,
    })).toThrow('Unknown backend');
  });
});
