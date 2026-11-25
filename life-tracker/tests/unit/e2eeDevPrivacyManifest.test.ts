import { describe, expect, it } from 'vitest';
import { ownerPrivacyFields, classifiedFields } from '../../src/lib/e2ee/fieldManifest';

describe('dev-based E2EE compile-time exhaustive owner field inventory', () => {
  it('classifies each new personal workout property without marking content public', () => {
    expect(ownerPrivacyFields.activities).toMatchObject({
      userId: 'routing', title: 'encrypted', sport: 'encrypted',
      localDate: 'encrypted', distanceMeters: 'encrypted',
      elapsedSeconds: 'encrypted', fingerprint: 'encrypted',
      categoryId: 'encrypted', order: 'encrypted',
    });
    expect(ownerPrivacyFields.activityTaskLinks).toMatchObject({
      activityId: 'encrypted', taskId: 'encrypted', userId: 'routing',
    });
    expect(classifiedFields('activities')).toContain('source');
    expect(Object.values(ownerPrivacyFields.activities)).not.toContain('public');
  });

  it('keeps new category, friendship and message request fields classified', () => {
    expect(ownerPrivacyFields.categories.startedOn).toBe('encrypted');
    expect(ownerPrivacyFields.friendships.acceptedAt).toBe('routing');
    expect(ownerPrivacyFields.messages.taskRequestId).toBe('encrypted');
    expect(ownerPrivacyFields.messages.taskRequestEvent).toBe('encrypted');
    for (const [domain, fields] of Object.entries(ownerPrivacyFields)) {
      expect(domain.length).toBeGreaterThan(0);
      expect(Object.values(fields).every(value => value === 'routing' || value === 'public' || value === 'encrypted')).toBe(true);
    }
  });
});
