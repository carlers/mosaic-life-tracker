import { describe, expect, it } from 'vitest';
import {
  fromCandidateDiaryRow, toCandidateDiaryWrite,
  type CandidateDiaryRow, type CandidateIdentity,
} from '../../supabase-poc/candidateMapping';
import type { DiaryDocument } from '../../src/db/schema';

const identity: CandidateIdentity = {
  legacyUserId: 'sb_11111111111141118111111111111111',
  supabaseUserId: '11111111-1111-4111-8111-111111111111',
};
const doc: DiaryDocument = {
  id: 'diary_20261021', date: '2026-10-21',
  content: 'Personal note', emoji: '🙂', photos: '[]',
  visibility: 'private', userId: identity.legacyUserId,
  createdAt: '2026-10-21T00:00:00Z', updatedAt: '2026-10-21T01:00:00Z', isDeleted: false,
};
const remote = (): CandidateDiaryRow => ({
  ...toCandidateDiaryWrite(doc, identity), change_seq: '42',
  server_updated_at: '2026-10-21T01:01:00Z',
});
describe('isolated private Supabase Diary transport mapping (#1029)', () => {
  it('preserves date, content, emoji, metadata, attachments and owner', () => {
    const signed = toCandidateDiaryWrite(doc, identity);
    expect(signed.owner_id).toBe(identity.supabaseUserId);
    expect(signed.entry_date).toBe(doc.date);
    expect(signed.visibility).toBe('private');
    expect(signed.photos).toBe('[]');
    expect(fromCandidateDiaryRow(remote(), identity)).toEqual(doc);
  });
  it('denies social visibility and foreign owner edits', () => {
    expect(() => toCandidateDiaryWrite({ ...doc, visibility: 'public' }, identity)).toThrow(/Diary cannot publish/);
    expect(() => toCandidateDiaryWrite({ ...doc, userId: 'foreign' }, identity)).toThrow(/different legacy account/);
    expect(() => fromCandidateDiaryRow({ ...remote(), owner_id: '22222222-2222-4222-8222-222222222222' }, identity))
      .toThrow(/unexpected owner/);
    expect(() => fromCandidateDiaryRow({ ...remote(), visibility: 'followers' as 'private' }, identity))
      .toThrow(/unapproved Supabase Diary/);
  });
  it('rejects invalid diary dates and never fabricates rows', () => {
    expect(() => toCandidateDiaryWrite({ ...doc, date: '2026-02-30' }, identity)).toThrow(/calendar date/);
    expect(() => fromCandidateDiaryRow({ ...remote(), entry_date: '2026-00-10' }, identity)).toThrow(/calendar date/);
  });
  it('preserves tombstones and does not revive deleted notes', () => {
    expect(fromCandidateDiaryRow({ ...remote(), is_deleted: true }, identity).isDeleted).toBe(true);
  });
});
