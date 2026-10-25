import { describe, expect, it } from 'vitest';
import type { SettingsDocument } from '../../src/db/schema';
import {
  classifyCandidateSettingKey, fromCandidateSettingRow, toCandidateSettingWrite,
} from '../../supabase-poc/candidateSettingsMapping';
import type { CandidateIdentity } from '../../supabase-poc/candidateMapping';

const owner: CandidateIdentity = {
  legacyUserId: 'appwrite_owner_A',
  supabaseUserId: '11111111-1111-4111-8111-111111111111',
};
const doc: SettingsDocument = {
  id: 's_1ab18', userId: owner.legacyUserId,
  key: 'calendarTaskPreviewLimit', value: '"unlimited"',
  updatedAt: '2026-10-25T11:20:11.123Z', isDeleted: false,
};
function remote(overrides = {}) {
  return {
    ...toCandidateSettingWrite(doc, owner), change_seq: '9007199254740993',
    server_updated_at: '2026-10-25T11:20:12Z', ...overrides,
  };
}

describe('isolated owner-private Supabase portable settings mapping', () => {
  it('preserves original owner/id/value/timestamp without transmitting server revisions', () => {
    const write = toCandidateSettingWrite(doc, owner);
    expect(write).toEqual({
      owner_id: owner.supabaseUserId, id: doc.id,
      setting_key: doc.key, setting_value: '"unlimited"',
      updated_at: doc.updatedAt, is_deleted: false,
    });
    expect(fromCandidateSettingRow(remote(), owner)).toEqual(doc);
  });
  it('keeps JSON, emoji, plain strings and empty string values byte-exact', () => {
    for (const value of ['dark', 'false', '{"theme":"black","label":"🌙"}', 'null', '']) {
      const expected = { ...doc, value };
      expect(fromCandidateSettingRow({ ...toCandidateSettingWrite(expected, owner),
        change_seq: 1, server_updated_at: '' }, owner)).toEqual(expected);
    }
  });
  it('keeps explicit tombstones, never physically deletes', () => {
    const deleted = { ...doc, value: '', isDeleted: true };
    expect(fromCandidateSettingRow({ ...toCandidateSettingWrite(deleted, owner),
      change_seq: 3, server_updated_at: '' }, owner)).toEqual(deleted);
  });
  it('fails closed on foreign Appwrite identity, remote owner and invalid UUID', () => {
    expect(() => toCandidateSettingWrite({ ...doc, userId: 'other' }, owner))
      .toThrow(/different legacy account/);
    expect(() => fromCandidateSettingRow(remote({ owner_id: '22222222-2222-4222-8222-222222222222' }), owner))
      .toThrow(/unexpected owner/);
    expect(() => toCandidateSettingWrite(doc, { ...owner, supabaseUserId: 'invalid' }))
      .toThrow(/Supabase Auth UUID/);
  });
  it('refuses provider-specific profile files and friend identities for separate migration', () => {
    for (const key of ['profileImageId', 'friend_carousel_prefs']) {
      expect(classifyCandidateSettingKey(key)).toBe('separate-migration');
      expect(() => toCandidateSettingWrite({ ...doc, key }, owner))
        .toThrow(/separate provider migration/);
      expect(() => fromCandidateSettingRow(remote({ setting_key: key }), owner))
        .toThrow(/separate provider migration/);
    }
  });
  it('rejects invalid IDs/keys, prototypes, oversized and invalid value types', () => {
    for (const id of ['id-with-hyphen', '_hidden', 'a'.repeat(37), ''])
      expect(() => toCandidateSettingWrite({ ...doc, id }, owner)).toThrow(/row ID/);
    for (const key of ['__proto__','constructor','prototype','bad-hyphen','a'.repeat(129),''])
      expect(() => toCandidateSettingWrite({ ...doc, key }, owner)).toThrow(/key/);
    expect(() => toCandidateSettingWrite({ ...doc, value: 'x'.repeat(65537) }, owner))
      .toThrow(/value/);
    expect(() => fromCandidateSettingRow(remote({ setting_value: null }), owner))
      .toThrow(/value/);
  });
  it('fails closed on invalid timestamps and missing tombstone metadata', () => {
    expect(() => toCandidateSettingWrite({ ...doc, updatedAt: 'invalid' }, owner))
      .toThrow(/timestamp/);
    expect(() => fromCandidateSettingRow(remote({ is_deleted: undefined }), owner))
      .toThrow(/tombstone/);
    expect(() => toCandidateSettingWrite({ ...doc, isDeleted: null } as unknown as SettingsDocument, owner))
      .toThrow(/tombstone/);
  });
  it('does not silently drop future portable preference keys', () => {
    const future = { ...doc, key: 'calendarFuturePreference' };
    expect(fromCandidateSettingRow({ ...toCandidateSettingWrite(future, owner),
      change_seq: 9, server_updated_at: '' }, owner)).toEqual(future);
  });
});
