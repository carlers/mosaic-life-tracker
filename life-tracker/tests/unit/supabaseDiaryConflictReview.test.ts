import { describe, expect, it } from 'vitest';
import { presentSupabaseConflicts } from '../../src/lib/supabaseConflictReview';
import type { DiaryDocument } from '../../src/db/schema';
import type { CandidateConflictReview } from '../../supabase-poc/candidateRxdbPilot';

const original: DiaryDocument & { _deleted: false } = {
  id: 'd_20261022', userId: 'legacy_private', date: '2026-10-22',
  content: 'Cloud version', emoji: '😌', photos: '[]', visibility: 'private',
  createdAt: '2026-10-22T08:00:00Z', updatedAt: '2026-10-22T08:00:00Z',
  isDeleted: false, _deleted: false,
};
const pending: CandidateConflictReview<DiaryDocument> = {
  domain: 'diary', documentId: original.id, reason: 'divergent-master',
  local: { ...original, content: 'Offline private revision', updatedAt: '2026-10-22T09:00:00Z' },
  base: original, remote: original, remoteRevision: '89',
};
const present = (review: CandidateConflictReview<DiaryDocument>) =>
  presentSupabaseConflicts({ tasks: [], categories: [], diary: [review] })[0];

describe('private Diary conflict review (#1029)', () => {
  it('shows the date and two private versions without silently resolving divergent edits', () => {
    const conflict = present(pending);
    expect(conflict.domain).toBe('diary');
    expect(conflict.title).toBe('Diary 2026-10-22');
    expect(conflict.canKeepLocal).toBe(true);
    expect(conflict.revision).toBe('89');
    expect(conflict.fields).toContainEqual({
      label: 'Diary entry', local: 'Offline private revision', remote: 'Cloud version',
    });
  });
  it('blocks keep-local for attachment, privacy or creation-timestamp changes', () => {
    const malformed = [
      { ...pending, local: { ...pending.local, photos: '["lost"]' } },
      { ...pending, local: { ...pending.local, visibility: 'public' as const } },
      { ...pending, remote: { ...original, visibility: 'followers' as const } },
      { ...pending, local: { ...pending.local, createdAt: '2026-10-22T10:00:00Z' } },
      { ...pending, reason: 'protected-field-change' as const },
    ];
    for (const conflict of malformed) expect(present(conflict).canKeepLocal).toBe(false);
  });
});
