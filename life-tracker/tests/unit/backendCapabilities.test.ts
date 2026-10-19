import { describe, expect, it } from 'vitest';
import {
  CORE_MVP_SYNC_COLLECTIONS,
  assertSafeProviderSwitch,
  assertSingleCloudWriter,
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

describe('provider return invariants (#967 / #975 / #1027)', () => {
  it('rejects two authoritative providers writing the same owner and domain', () => {
    expect(() => assertSingleCloudWriter([
      { provider: 'appwrite', ownerId: 'a', domain: 'tasks' },
      { provider: 'supabase', ownerId: 'a', domain: 'tasks' },
    ])).toThrow('Two authoritative cloud writers');
    expect(() => assertSingleCloudWriter([
      { provider: 'appwrite', ownerId: 'a', domain: 'tasks' },
      { provider: 'supabase', ownerId: 'b', domain: 'tasks' },
    ])).not.toThrow();
    expect(() => assertSingleCloudWriter([
      { provider: 'appwrite', ownerId: 'a', domain: 'categories' },
      { provider: 'appwrite', ownerId: 'a', domain: 'tasks' },
    ])).not.toThrow();
    expect(() => assertSingleCloudWriter([
      { provider: 'supabase', ownerId: '', domain: 'tasks' },
    ])).toThrow('explicit owner');
  });

  const fullyVerified: ProviderReturnGate = {
    from: 'supabase', to: 'appwrite', phase: 'verified',
    sourceSnapshotVerified: true,
    unsyncedDraftsSettled: true,
    destinationReplayVerified: true,
    destinationRestoreVerified: true,
    oldClientWritersFenced: true,
    identityMappingVerified: true,
  };

  it('requires a source snapshot, settled drafts and identity/DR proof before return', () => {
    expect(() => assertSafeProviderSwitch(fullyVerified)).not.toThrow();
    expect(() => assertSafeProviderSwitch({ ...fullyVerified, phase: 'active' }))
      .toThrow('frozen and verified');
    expect(() => assertSafeProviderSwitch({ ...fullyVerified, to: 'supabase' }))
      .toThrow('actually change');
    for (const field of ['sourceSnapshotVerified', 'unsyncedDraftsSettled',
      'destinationReplayVerified', 'destinationRestoreVerified',
      'oldClientWritersFenced', 'identityMappingVerified'] as const) {
      expect(() => assertSafeProviderSwitch({ ...fullyVerified, [field]: false }),
        field).toThrow('prerequisites incomplete');
    }
    expect(() => assertSafeProviderSwitch({
      ...fullyVerified, from: 'appwrite', to: 'supabase',
    })).not.toThrow();
  });
});
